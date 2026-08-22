import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { quoteUpdateSchema } from '@/lib/validation';
import { requirePermission, audit } from '@/lib/admin-guard';
import { hasPermission } from '@/lib/permissions';
import { notifier } from '@/lib/notify';
import { canSendSms } from '@/lib/notify/sms-guard';
import { ok, fail, handleError } from '@/lib/http';
import { quotationPdf } from '@/lib/pdf';
import { storage } from '@/lib/storage';

export const dynamic = 'force-dynamic';

/**
 * PATCH /api/admin/quotes/[id] — set the quoted price and/or stage.
 * When the quote reaches "Quote sent" (stage 2) with a price, the customer is
 * notified (provider-agnostic; Noop in dev, Resend once configured).
 */
export async function PATCH(request: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    const session = await requirePermission('quotes', 'edit');
    const data = quoteUpdateSchema.parse(await request.json());

    const before = await prisma.quote.findUnique({ where: { id: params.id } });
    if (!before) return fail('Quote not found', 404);

    // Once a quote is Approved (stage 3), changes are queued as a change
    // request instead of applied directly — only admin or someone with edit
    // access to the Quote Approvals module can act on it directly.
    const isRestrictedRole = !hasPermission(session, 'quoteApprovals', 'edit');
    if (before.stage === 3 && isRestrictedRole) {
      const existingPending = await prisma.quoteChangeRequest.findFirst({
        where: { quoteId: params.id, status: 'pending' },
      });
      if (existingPending) {
        return fail('A change request for this quote is already pending approval.', 409);
      }

      const request = await prisma.quoteChangeRequest.create({
        data: {
          quoteId: params.id,
          requestedBy: session.email,
          currentStage: before.stage,
          currentPrice: before.price ?? null,
          requestedStage: data.stage ?? null,
          requestedPrice: data.price !== undefined ? data.price : null,
        },
      });
      await audit(session.email, 'quote.change_request.create', params.id, data);
      return ok({ queued: true, request: { id: request.id, status: request.status, createdAt: request.createdAt } }, 202);
    }

    const update: Prisma.QuoteUpdateInput = {};
    if (data.stage !== undefined) update.stage = data.stage;
    if (data.price !== undefined) update.price = data.price;

    const updated = await prisma.quote.update({ where: { id: params.id }, data: update });
    await audit(session.email, 'quote.update', params.id, data);

    if (data.stage !== undefined && data.stage !== before.stage) {
      await notifier.adminQuoteStageAlert({ ref: updated.id, customer: updated.customer, fromStage: before.stage, toStage: updated.stage });
    }

    // Fire the priced notification once, on the transition into "Quote sent".
    const justSent = before.stage !== 2 && updated.stage === 2 && updated.price != null;
    if (justSent) {
      const quotePricedSmsAllowed = await canSendSms(request, updated.mobile);
      await notifier.quotePriced({ ref: updated.id, email: updated.email, price: updated.price!, mobile: updated.mobile, smsAllowed: quotePricedSmsAllowed });

      // Generate the priced Quotation PDF (best-effort).
      try {
        const settings = await prisma.setting.findUnique({ where: { id: 'singleton' } });
        const lineItems = await prisma.quoteItem.findMany({ where: { quoteId: updated.id } });
        if (settings) {
          const bankAccounts = (settings.bankAccounts as { name: string; accountNumber: string }[] | null) ?? [];
          const pdf = await quotationPdf({
            ref: updated.id, customer: updated.customer, email: updated.email, mobile: updated.mobile ?? null,
            date: updated.date, message: updated.message ?? null,
            items: lineItems.map(i => {
              const parts = [i.type && `Type: ${i.type}`, i.fabric && `Fabric: ${i.fabric}`, i.sleeve && `Sleeve: ${i.sleeve}`, i.neck && `Neck: ${i.neck}`, i.accent && `Accent: ${i.accent}`, i.notes && `Notes: ${i.notes}`].filter(Boolean);
              return {
                name: i.name, specs: i.specs?.trim() ? i.specs : parts.join(' · '), units: i.units, sizesLabel: i.sizesLabel,
                unitPrice: i.unitPrice, customizationLines: (i.customizationLines as { label: string; cost: number }[] | null) ?? [], customizationCost: i.customizationCost,
              };
            }),
            price: updated.price!,
            storeName: settings.storeName, storeAddress: settings.address,
            storePhone: settings.phone, storeEmail: settings.email,
            taxId: settings.taxId, bankAccounts,
            taxRate: settings.taxRate, taxLabel: settings.taxLabel,
            termsConditions: settings.termsConditions,
          });
          const stored = await storage.put({ bucket: 'pdf', filename: `${updated.id}-quote.pdf`, data: pdf, contentType: 'application/pdf' });
          await prisma.quote.update({ where: { id: updated.id }, data: { pdfUrl: stored.url } });
        }
      } catch (e) {
        console.error('quotation PDF generation failed', e);
      }
    }

    return ok({
      queued: false,
      quote: {
        id: updated.id, customer: updated.customer, email: updated.email, configs: updated.configs,
        units: updated.units, summary: updated.summary, stage: updated.stage, price: updated.price ?? null,
        computedPrice: updated.computedPrice, date: updated.date,
        customerDecision: updated.customerDecision,
        sentForConfirmationAt: updated.sentForConfirmationAt ? updated.sentForConfirmationAt.toISOString() : null,
        confirmationTokenExpiresAt: updated.confirmationTokenExpiresAt ? updated.confirmationTokenExpiresAt.toISOString() : null,
        respondedAt: updated.respondedAt ? updated.respondedAt.toISOString() : null,
      },
    });
  } catch (err) {
    return handleError(err);
  }
}
