import { prisma } from '@/lib/prisma';
import { ok, fail, handleError } from '@/lib/http';
import { rateLimitResponse } from '@/lib/rate-limit';
import { reviewSubmitSchema } from '@/lib/validation';

export const dynamic = 'force-dynamic';

/** A token that's missing, expired, or already used all look identical to the caller. */
const invalidLink = () => fail('This review link is invalid or has expired.', 404);

function reviewIsUsable(review: { tokenExpiresAt: Date; submittedAt: Date | null } | null): boolean {
  if (!review) return false;
  if (review.submittedAt) return false;
  if (review.tokenExpiresAt.getTime() < Date.now()) return false;
  return true;
}

/**
 * GET /api/review?token=...
 *
 * Public, no login — looks up the review request by token so the review page
 * can prefill the customer's name and confirm the link is still usable.
 */
export async function GET(request: Request) {
  try {
    const ipLimit = await rateLimitResponse(request, { scope: 'review:ip', limit: 30, windowMs: 60 * 1000 });
    if (ipLimit) return ipLimit;

    const { searchParams } = new URL(request.url);
    const token = (searchParams.get('token') || '').trim();
    if (!token) return fail('Missing review link token.', 400);

    const review = await prisma.review.findUnique({
      where: { token },
      include: { order: { select: { id: true, customer: true, date: true } } },
    });
    if (!reviewIsUsable(review)) return invalidLink();

    return ok({ ref: review!.order.id, customerName: review!.order.customer, date: review!.order.date });
  } catch (err) {
    return handleError(err);
  }
}

/**
 * POST /api/review — submit a rating + quote for a completed online order.
 * Leaves the row `pending` for admin moderation.
 */
export async function POST(request: Request) {
  try {
    const ipLimit = await rateLimitResponse(request, { scope: 'review:ip', limit: 30, windowMs: 60 * 1000 });
    if (ipLimit) return ipLimit;

    const body = reviewSubmitSchema.parse(await request.json());

    const review = await prisma.review.findUnique({
      where: { token: body.token },
      include: { order: { select: { customer: true } } },
    });
    if (!reviewIsUsable(review)) return invalidLink();

    await prisma.review.update({
      where: { id: review!.id },
      data: {
        rating: body.rating,
        quote: body.quote,
        authorName: body.authorName || review!.order.customer,
        authorRole: body.authorRole || null,
        submittedAt: new Date(),
      },
    });

    return ok({ submitted: true });
  } catch (err) {
    return handleError(err);
  }
}
