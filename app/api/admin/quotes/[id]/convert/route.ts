import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { requirePermission, audit } from '@/lib/admin-guard';
import { ok, fail, handleError } from '@/lib/http';
import { nextRef } from '@/lib/ref';
import { displayDate } from '@/lib/http';
import { decrementStock, InsufficientStockError } from '@/lib/inventory';
import { RECEIPT_TTL_MS } from '@/lib/receipts';
import { orderConfirmationPdf } from '@/lib/pdf';
import { storage } from '@/lib/storage';

export const dynamic = 'force-dynamic';

/**
 * POST /api/admin/quotes/[id]/convert
 * Converts an Approved quote (stage 3 with a price) into a new Order.
 * The order is linked back via quoteRef so it can be visually identified.
 * Line items carry the quote's real per-item pricing (product-derived unit
 * price + manually-entered extra costs) so the resulting order/invoice show
 * real item rows instead of a blank list.
 */
export async function POST(_request: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    const session = await requirePermission('quotes', 'edit');

    const { order, lineItems: orderLineItems, subtotal, discount, total } = await prisma.$transaction(async (tx) => {
      const quote = await tx.quote.findUnique({ where: { id: params.id }, include: { lineItems: true } });
      if (!quote) throw new Error('Quote not found');
      if (quote.stage !== 3) throw new Error('Only approved quotes (stage 3) can be converted.');
      if (quote.price == null) throw new Error('Quote must have a price set before converting.');

      // Prevent double-conversion.
      const existing = await tx.order.findFirst({ where: { quoteRef: quote.id } });
      if (existing) throw new Error(`ALREADY_CONVERTED:${existing.id}`);

      const productIds = [...new Set(quote.lineItems.map(i => i.productId).filter((id): id is string => !!id))];
      const products = productIds.length > 0
        ? await tx.product.findMany({ where: { id: { in: productIds } } })
        : [];
      const productById = new Map(products.map(p => [p.id, p]));

      // Web-facing intake, no location of its own — decrement from the same
      // location web checkout uses. If none is configured, skip decrementing
      // entirely (mirrors checkout's existing tolerance for that misconfiguration).
      const webLoc = await tx.location.findFirst({ where: { isWebDefault: true } });

      const lineItems = [];
      for (const qi of quote.lineItems) {
        const product = qi.productId ? productById.get(qi.productId) : undefined;
        let stockDecremented = false;
        let sizeBreakdown: Record<string, number> | null = null;

        if (qi.productId && product && webLoc) {
          const canResolveColor = qi.colorName != null || product.colors.length === 0;
          if (canResolveColor) {
            const color = qi.colorName ?? '';
            const sizes = (qi.sizes as Record<string, number>) ?? {};
            const entries = Object.entries(sizes).filter(([, qty]) => qty > 0);
            if (entries.length > 0) {
              for (const [size, qty] of entries) {
                await decrementStock(tx, { locationId: webLoc.id, productId: qi.productId, size, color, qty });
              }
              sizeBreakdown = Object.fromEntries(entries);
            } else {
              // No per-size breakdown recorded — fall back to a single blank-size decrement of the total.
              await decrementStock(tx, { locationId: webLoc.id, productId: qi.productId, size: '', color, qty: qi.units });
            }
            stockDecremented = true;
          } else {
            console.warn(`Quote ${quote.id} item ${qi.id}: no resolvable color, skipping inventory decrement`);
          }
        }
        // qi.productId === null (fully custom item) -> stockDecremented stays false, nothing to decrement.

        lineItems.push({
          sku: qi.productId ?? `quote-item-${qi.id}`,
          name: qi.name,
          meta: [qi.specs, qi.sizesLabel].filter(Boolean).join(' · '),
          price: qi.unitPrice,
          img: product?.img ?? '',
          size: '',
          color: qi.swatch ?? '',
          sleeve: qi.sleeve ?? '',
          neck: qi.neck ?? '',
          qty: qi.units,
          customizationNote: qi.notes ?? '',
          customizationLines: (qi.customizationLines as { label: string; cost: number }[] | null) ?? [],
          customizationCost: qi.customizationCost,
          stockDecremented,
          sizeBreakdown: (sizeBreakdown ?? undefined) as Prisma.InputJsonValue | undefined,
        });
      }

      const subtotal = lineItems.reduce((s, i) => s + i.price * i.qty + i.customizationCost, 0);
      // quote.price is the admin's real, negotiated total (checked non-null above) —
      // it's what the customer actually agreed to pay, and may differ from the
      // line-item-derived subtotal. Any shortfall shows as a discount so
      // receipts/ledgers reflect it instead of silently losing the negotiation.
      const total = quote.price!;
      const discount = Math.max(0, subtotal - total);

      const ref = await nextRef('DC', tx);
      const created = await tx.order.create({
        data: {
          id: ref,
          customer: quote.customer,
          email: quote.email,
          mobile: quote.mobile ?? null,
          items: quote.summary,
          subtotal,
          deliveryFee: 0,
          discount,
          total,
          method: 'Pickup',
          stage: 0,
          paid: false,
          source: 'web',
          origin: 'quote_conversion',
          locationId: webLoc?.id ?? null,
          date: displayDate(),
          quoteRef: quote.id,
          lineItems: { create: lineItems },
        },
      });

      // Carry over a payment slip the customer already uploaded on the quote
      // (before this Order existed) so it shows up on the resulting Order too.
      // expiresAt mirrors the R2 lifecycle deletion window, which runs from the
      // original upload time — not from this conversion — so the object's real
      // deletion date is what's reflected here.
      if (quote.paymentSlipUrl) {
        const uploadedAt = quote.paymentSlipUploadedAt ?? new Date();
        await tx.receipt.create({
          data: {
            kind: 'payment_slip',
            url: quote.paymentSlipUrl,
            orderId: created.id,
            expiresAt: new Date(uploadedAt.getTime() + RECEIPT_TTL_MS),
          },
        });
      }

      return { order: created, lineItems, subtotal, discount, total };
    });

    await audit(session.email, 'order.create_from_quote', order.id, { quoteRef: order.quoteRef });

    try {
      const settings = await prisma.setting.findUnique({ where: { id: 'singleton' } });
      if (settings) {
        const bankAccounts = (settings.bankAccounts as { name: string; accountNumber: string }[] | null) ?? [];
        const pdf = await orderConfirmationPdf({
          ref: order.id, customer: order.customer, email: order.email, mobile: order.mobile ?? null,
          date: order.date, method: order.method, address: order.address ?? null, notes: order.notes ?? null,
          subtotal, deliveryFee: 0, discount, total,
          items: orderLineItems,
          storeName: settings.storeName, storeAddress: settings.address,
          storePhone: settings.phone, storeEmail: settings.email,
          taxId: settings.taxId, bankAccounts,
          taxRate: settings.taxRate, taxLabel: settings.taxLabel,
          termsConditions: settings.termsConditions,
        });
        const stored = await storage.put({ bucket: 'pdf', filename: `${order.id}.pdf`, data: pdf, contentType: 'application/pdf' });
        await prisma.order.update({ where: { id: order.id }, data: { pdfUrl: stored.url } });
      }
    } catch (e) {
      console.error('quote-conversion order PDF generation failed', e);
    }

    return ok({ order: { id: order.id, quoteRef: order.quoteRef } }, 201);
  } catch (err) {
    if (err instanceof InsufficientStockError) {
      // Stock may have sold via another channel between quote approval and conversion.
      const variant = [err.size, err.color].filter(Boolean).join(' / ');
      return fail(`Insufficient stock to convert this quote (${err.productId}${variant ? ` — ${variant}` : ''}).`, 409);
    }
    if (err instanceof Error) {
      if (err.message === 'Quote not found') return fail(err.message, 404);
      if (err.message.startsWith('ALREADY_CONVERTED:')) {
        return fail(`This quote was already converted to order ${err.message.split(':')[1]}.`, 409);
      }
      if (err.message === 'Only approved quotes (stage 3) can be converted.' || err.message === 'Quote must have a price set before converting.') {
        return fail(err.message, 400);
      }
    }
    return handleError(err);
  }
}
