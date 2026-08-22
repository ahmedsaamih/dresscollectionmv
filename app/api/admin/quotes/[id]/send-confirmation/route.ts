import { prisma } from '@/lib/prisma';
import { sendQuoteConfirmationSchema } from '@/lib/validation';
import { requirePermission, audit } from '@/lib/admin-guard';
import { canSendSms } from '@/lib/notify/sms-guard';
import { sendQuoteForConfirmation } from '@/lib/quote-confirmation';
import { ok, fail, handleError } from '@/lib/http';

export const dynamic = 'force-dynamic';

/**
 * POST /api/admin/quotes/[id]/send-confirmation
 * Sends (or resends) a self-serve confirm/reject link for an already-priced
 * quote (stage 2). Distinct from the implicit stage->2 "Quote sent" email —
 * this is an explicit admin action so the TTL is chosen per-send rather than
 * fired automatically on every price/stage edit.
 */
export async function POST(request: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    const session = await requirePermission('quotes', 'edit');
    const data = sendQuoteConfirmationSchema.parse(await request.json());

    const quote = await prisma.quote.findUnique({ where: { id: params.id } });
    if (!quote) return fail('Quote not found', 404);
    if (quote.customerDecision === 'confirmed') {
      return fail('This quote was already confirmed by the customer — no need to resend.', 400);
    }
    if (quote.price == null) return fail('Set a price before sending for confirmation.', 400);

    const smsAllowed = await canSendSms(request, quote.mobile);
    await sendQuoteForConfirmation(
      { id: quote.id, email: quote.email, customer: quote.customer, mobile: quote.mobile, price: quote.price },
      data.ttlDays as 1 | 2 | 3,
      { smsAllowed }
    );
    await audit(session.email, 'quote.send_confirmation', params.id, { ttlDays: data.ttlDays });

    const updated = await prisma.quote.findUnique({ where: { id: params.id } });
    return ok({
      quote: {
        id: updated!.id,
        customerDecision: updated!.customerDecision,
        sentForConfirmationAt: updated!.sentForConfirmationAt,
        confirmationTokenExpiresAt: updated!.confirmationTokenExpiresAt,
        respondedAt: updated!.respondedAt,
      },
    });
  } catch (err) {
    return handleError(err);
  }
}
