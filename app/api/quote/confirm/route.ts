import { prisma } from '@/lib/prisma';
import { ok, fail, handleError } from '@/lib/http';
import { rateLimitResponse } from '@/lib/rate-limit';
import { quoteConfirmDecisionSchema } from '@/lib/validation';
import { canSendSms } from '@/lib/notify/sms-guard';
import { notifier } from '@/lib/notify';

export const dynamic = 'force-dynamic';

/** A token that's missing, expired, or already responded to all look identical to the caller. */
const invalidLink = () => fail('This confirmation link is invalid or has expired.', 404);

function quoteConfirmationIsUsable(quote: { customerDecision: string; confirmationTokenExpiresAt: Date | null } | null): boolean {
  if (!quote) return false;
  if (quote.customerDecision !== 'pending') return false;
  if (!quote.confirmationTokenExpiresAt || quote.confirmationTokenExpiresAt.getTime() < Date.now()) return false;
  return true;
}

/**
 * GET /api/quote/confirm?token=...
 *
 * Public, no login — looks up the quote by confirmation token so the
 * confirm/reject page can show the price and confirm the link is still usable.
 */
export async function GET(request: Request) {
  try {
    const ipLimit = await rateLimitResponse(request, { scope: 'quote-confirm:ip', limit: 30, windowMs: 60 * 1000 });
    if (ipLimit) return ipLimit;

    const { searchParams } = new URL(request.url);
    const token = (searchParams.get('token') || '').trim();
    if (!token) return fail('Missing confirmation link token.', 400);

    const quote = await prisma.quote.findUnique({ where: { confirmationToken: token } });
    if (!quote) return invalidLink();

    return ok({
      ref: quote.id,
      customerName: quote.customer,
      contact: quote.email,
      price: quote.price,
      decision: quote.customerDecision,
      expired: !quote.confirmationTokenExpiresAt || quote.confirmationTokenExpiresAt.getTime() < Date.now(),
      expiresAt: quote.confirmationTokenExpiresAt,
    });
  } catch (err) {
    return handleError(err);
  }
}

/**
 * POST /api/quote/confirm — customer confirms or rejects a priced quote.
 * Confirming advances an unapproved quote to stage 3 (Approved); rejecting
 * leaves `stage` untouched. Single-use: `customerDecision` moving away from
 * `pending` invalidates the link for any further visits.
 */
export async function POST(request: Request) {
  try {
    const ipLimit = await rateLimitResponse(request, { scope: 'quote-confirm:ip', limit: 30, windowMs: 60 * 1000 });
    if (ipLimit) return ipLimit;

    const body = quoteConfirmDecisionSchema.parse(await request.json());

    const quote = await prisma.quote.findUnique({ where: { confirmationToken: body.token } });
    if (!quoteConfirmationIsUsable(quote)) return invalidLink();

    const updated = await prisma.quote.update({
      where: { id: quote!.id },
      data: {
        customerDecision: body.decision,
        respondedAt: new Date(),
        ...(body.decision === 'confirmed' && quote!.stage < 3 ? { stage: 3 } : {}),
      },
    });

    const smsAllowed = await canSendSms(request, updated.mobile);
    const decisionEvent = { ref: updated.id, email: updated.email, name: updated.customer, mobile: updated.mobile, smsAllowed };
    if (body.decision === 'confirmed') {
      await notifier.quoteConfirmed(decisionEvent);
    } else {
      await notifier.quoteRejected(decisionEvent);
    }

    return ok({ ok: true, decision: body.decision });
  } catch (err) {
    return handleError(err);
  }
}
