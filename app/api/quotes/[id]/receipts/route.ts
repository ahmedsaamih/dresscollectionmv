import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { ok, fail, handleError } from '@/lib/http';
import { rateLimitResponse } from '@/lib/rate-limit';
import { storageUrl } from '@/lib/validation';

export const dynamic = 'force-dynamic';

const body = z.object({ url: storageUrl() });

// This route is unauthenticated by design (the customer has no login yet
// before an Order exists), but the gate here is actually stronger than the
// orders route's time-window approach: reaching `customerDecision ===
// 'confirmed'` already required possessing the single-use confirmation
// token from the email/SMS link. So instead of a short attach window, we
// just require the quote to be confirmed and not already have a slip —
// a customer may reasonably pay days after confirming.
/** POST /api/quotes/[id]/receipts — attach a payment-slip URL to a confirmed quote (public). */
export async function POST(request: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    const ipLimit = await rateLimitResponse(request, { scope: 'quote-receipt:ip', limit: 20, windowMs: 60 * 60 * 1000 });
    if (ipLimit) return ipLimit;

    const { url } = body.parse(await request.json());
    const quote = await prisma.quote.findUnique({ where: { id: params.id } });
    if (!quote) return fail('Quote not found', 404);
    if (quote.customerDecision !== 'confirmed') {
      return fail('This quote must be confirmed before a payment slip can be uploaded.', 403);
    }
    if (quote.paymentSlipUrl) {
      return fail('A payment slip has already been attached to this quote.', 409);
    }

    await prisma.quote.update({ where: { id: quote.id }, data: { paymentSlipUrl: url, paymentSlipUploadedAt: new Date() } });
    return ok({ receipt: { url } }, 201);
  } catch (err) {
    return handleError(err);
  }
}
