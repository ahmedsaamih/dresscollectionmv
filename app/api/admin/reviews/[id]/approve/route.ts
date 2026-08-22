import { prisma } from '@/lib/prisma';
import { requirePermission, audit } from '@/lib/admin-guard';
import { ok, fail, handleError } from '@/lib/http';

export const dynamic = 'force-dynamic';

/** POST /api/admin/reviews/[id]/approve */
export async function POST(_request: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    const session = await requirePermission('reviews', 'edit');
    const review = await prisma.review.findUnique({ where: { id: params.id } });
    if (!review) return fail('Review not found', 404);
    if (review.status !== 'pending') return fail('This review has already been resolved.', 409);

    const updated = await prisma.review.update({
      where: { id: params.id },
      data: { status: 'approved', resolvedBy: session.email, resolvedAt: new Date() },
    });
    await audit(session.email, 'review.approve', params.id);
    return ok({ review: { id: updated.id, status: updated.status } });
  } catch (err) {
    return handleError(err);
  }
}
