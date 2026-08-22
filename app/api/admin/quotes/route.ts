import { prisma } from '@/lib/prisma';
import { requirePermission, audit } from '@/lib/admin-guard';
import { ok, fail, handleError, displayDate } from '@/lib/http';
import { nextRef } from '@/lib/ref';
import { computeUnitPrice } from '@/lib/pricing';
import { recomputeQuoteComputedPrice } from '@/lib/quotes';
import type { Quote } from '@/lib/types';
import { upsertCustomerFromContact } from '@/lib/customers';
import { notifier } from '@/lib/notify';
import { canSendSms } from '@/lib/notify/sms-guard';
import { optionalMobile } from '@/lib/validation';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

/** GET /api/admin/quotes — all quote requests, newest first, with items. */
export async function GET() {
  try {
    await requirePermission('quotes', 'read');
    const rows = await prisma.quote.findMany({
      orderBy: { createdAt: 'desc' },
      include: { lineItems: true, artworks: { orderBy: { createdAt: 'asc' } }, changeRequests: { where: { status: 'pending' }, select: { id: true } } },
    });
    const quotes: Quote[] = rows.map((q) => ({
      id: q.id,
      customer: q.customer,
      email: q.email,
      mobile: (q as any).mobile ?? null,
      message: (q as any).message ?? null,
      configs: q.configs,
      units: q.units,
      summary: q.summary,
      stage: q.stage as Quote['stage'],
      price: q.price ?? null,
      computedPrice: q.computedPrice,
      date: q.date,
      pdfUrl: (q as any).pdfUrl ?? null,
      customerDecision: q.customerDecision as Quote['customerDecision'],
      sentForConfirmationAt: q.sentForConfirmationAt ? q.sentForConfirmationAt.toISOString() : null,
      confirmationTokenExpiresAt: q.confirmationTokenExpiresAt ? q.confirmationTokenExpiresAt.toISOString() : null,
      respondedAt: q.respondedAt ? q.respondedAt.toISOString() : null,
      paymentSlipUrl: q.paymentSlipUrl ?? null,
      paymentSlipUploadedAt: q.paymentSlipUploadedAt ? q.paymentSlipUploadedAt.toISOString() : null,
      artworks: (q.artworks ?? []).map((a) => ({
        id: a.id,
        url: a.url,
        name: a.name ?? null,
        provider: a.provider,
        fileId: a.fileId ?? null,
        mimeType: a.mimeType ?? null,
        size: a.size ?? null,
        createdAt: a.createdAt.toISOString(),
      })),
      hasPendingRequest: q.changeRequests.length > 0,
      lineItems: (q.lineItems ?? []).map((i: any) => ({
        id: i.id,
        kind: i.kind ?? 'jersey',
        name: i.name ?? '',
        specs: i.specs ?? '',
        units: i.units ?? 1,
        sizesLabel: i.sizesLabel ?? '',
        sizes: (i.sizes as Record<string, number>) ?? {},
        swatch: i.swatch ?? '#888888',
        type: i.type ?? null,
        fabric: i.fabric ?? null,
        sleeve: i.sleeve ?? null,
        neck: i.neck ?? null,
        collar: i.collar ?? null,
        accent: i.accent ?? null,
        logoName: i.logoName ?? null,
        notes: i.notes ?? null,
        placement: i.placement ?? null,
        artName: i.artName ?? null,
        builder: (i.builder as Record<string, unknown>) ?? null,
        customizationProfileId: i.customizationProfileId ?? null,
        customizationProfileName: i.customizationProfileName ?? null,
        customizationAnswers: (i.customizationAnswers as Record<string, unknown>) ?? {},
        productId: i.productId ?? null,
        unitPrice: i.unitPrice ?? 0,
        customizationLines: (i.customizationLines as { label: string; cost: number }[] | null) ?? [],
        customizationCost: i.customizationCost ?? 0,
      })),
    }));
    return ok({ quotes, total: quotes.length });
  } catch (err) {
    return handleError(err);
  }
}

const quoteCustomizationLine = z.object({
  label: z.string().trim().min(1),
  cost: z.coerce.number().int().nonnegative(),
});

const quoteItemDraftSchema = z.object({
  name: z.string().trim().min(1),
  kind: z.enum(['jersey', 'casual', 'office', 'office-full', 'profile']).default('jersey'),
  specs: z.string().trim().default(''),
  units: z.coerce.number().int().positive().default(1),
  sizesLabel: z.string().trim().default(''),
  sizes: z.record(z.string(), z.number()).default({}),
  swatch: z.string().trim().default('#888888'),
  color: z.string().trim().default(''),
  type: z.string().trim().optional(),
  fabric: z.string().trim().optional(),
  sleeve: z.string().trim().optional(),
  neck: z.string().trim().optional(),
  notes: z.string().trim().optional(),
  productId: z.string().trim().nullish(),
  manualUnitPrice: z.coerce.number().int().nonnegative().optional(),
  customizationLines: z.array(quoteCustomizationLine).optional().default([]),
});

const manualQuoteSchema = z.object({
  customer: z.string().trim().min(1),
  email: z.string().trim().default(''),
  mobile: optionalMobile.default(''),
  message: z.string().trim().default(''),
  units: z.coerce.number().int().positive().default(1),
  lineItems: z.array(quoteItemDraftSchema).default([]),
});

/** POST /api/admin/quotes — admin creates a quote on behalf of a customer. */
export async function POST(request: Request) {
  try {
    const session = await requirePermission('quotes', 'edit');
    const data = manualQuoteSchema.parse(await request.json());

    const totalUnits = data.lineItems.length > 0
      ? data.lineItems.reduce((s, i) => s + i.units, 0)
      : data.units;

    const summary = data.message
      || (data.lineItems.length > 0
        ? data.lineItems.map(i => `${i.name} ×${i.units}${i.sizesLabel ? ` (${i.sizesLabel})` : ''}`).join(', ')
        : `${totalUnits} unit${totalUnits !== 1 ? 's' : ''} — manual quote`);

    // Real per-item pricing: derive from the actual catalog product when one
    // is selected (never trust a client-sent price for it); otherwise fall
    // back to the admin's manually-entered unit price for bespoke items.
    const productIds = [...new Set(data.lineItems.map(i => i.productId).filter((id): id is string => !!id))];
    const products = productIds.length > 0
      ? await prisma.product.findMany({ where: { id: { in: productIds } } })
      : [];
    const productById = new Map(products.map(p => [p.id, p]));
    for (const id of productIds) {
      if (!productById.has(id)) return fail(`Product not found: ${id}`, 400);
    }
    const pricedItems = data.lineItems.map(item => {
      const product = item.productId ? productById.get(item.productId) : undefined;
      const unitPrice = product ? computeUnitPrice(product, { sleeve: item.sleeve }) : (item.manualUnitPrice ?? 0);
      const customizationCost = item.customizationLines.reduce((s, l) => s + l.cost, 0);
      return { ...item, unitPrice, customizationCost };
    });

    let computedPrice = 0;
    const quote = await prisma.$transaction(async (tx) => {
      const ref = await nextRef('QT', tx);
      const created = await tx.quote.create({
        data: {
          id: ref,
          customer: data.customer,
          email: data.email,
          mobile: data.mobile || null,
          message: data.message || null,
          configs: data.lineItems.length,
          units: totalUnits,
          summary,
          stage: 0,
          date: displayDate(),
        },
      });
      if (pricedItems.length > 0) {
        await tx.quoteItem.createMany({
          data: pricedItems.map(item => ({
            quoteId: ref,
            kind: item.kind,
            name: item.name,
            specs: [item.specs, item.color].filter(Boolean).join(' · '),
            units: item.units,
            sizesLabel: item.sizesLabel,
            sizes: item.sizes as any,
            swatch: '#888888',
            type: item.type,
            fabric: item.fabric,
            sleeve: item.sleeve,
            neck: item.neck,
            notes: item.notes,
            productId: item.productId ?? null,
            unitPrice: item.unitPrice,
            customizationLines: item.customizationLines as any,
            customizationCost: item.customizationCost,
          })),
        });
        computedPrice = await recomputeQuoteComputedPrice(tx, ref);
      }
      return created;
    });

    await upsertCustomerFromContact({ name: data.customer, phone: data.mobile, email: data.email });

    await audit(session.email, 'quote.manual.create', quote.id, { customer: data.customer, items: data.lineItems.length });

    // Acknowledge receipt the same way the self-serve quote flow does — the
    // customer didn't submit this themselves, but they still should know
    // it's on file. No adminQuoteAlert here: this is the admin's own action,
    // pinging them about it would just be noise.
    const manualQuoteSmsAllowed = await canSendSms(request, data.mobile || null);
    await notifier.quoteRequested({ ref: quote.id, email: quote.email, name: quote.customer, mobile: data.mobile || null, smsAllowed: manualQuoteSmsAllowed });

    // Mirrors the shape GET /api/admin/quotes returns (and what the
    // QuoteItem rows were just created with above) — this is the optimistic
    // response the admin UI drops straight into its quote list/drawer, so it
    // has to match QuoteItemDetail or the drawer renders blank names and
    // NaN totals until the next full reload.
    const lineItems = pricedItems.map((item, idx) => ({
      id: `pending-${idx}`,
      kind: item.kind,
      name: item.name,
      specs: [item.specs, item.color].filter(Boolean).join(' · '),
      units: item.units,
      sizesLabel: item.sizesLabel,
      sizes: item.sizes,
      swatch: '#888888',
      type: item.type ?? null,
      fabric: item.fabric ?? null,
      sleeve: item.sleeve ?? null,
      neck: item.neck ?? null,
      productId: item.productId ?? null,
      unitPrice: item.unitPrice,
      customizationLines: item.customizationLines,
      customizationCost: item.customizationCost,
    }));

    return ok({
      quote: {
        id: quote.id, customer: quote.customer, email: quote.email,
        mobile: data.mobile || null, message: data.message || null,
        configs: data.lineItems.length, units: totalUnits, summary,
        stage: 0, price: null, computedPrice, date: quote.date, pdfUrl: null, lineItems,
      },
    }, 201);
  } catch (err) {
    return handleError(err);
  }
}
