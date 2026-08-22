import { prisma } from '@/lib/prisma';
import { requirePermission, audit } from '@/lib/admin-guard';
import { ok, fail, handleError } from '@/lib/http';
import { rejectNoteSchema } from '@/lib/validation';

export const dynamic = 'force-dynamic';

/** POST /api/admin/reviews/[id]/reject */
export async function POST(request: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    const session = await requirePermission('reviews', 'edit');
    const body = await request.json().catch(() => ({}));
    const { note } = rejectNoteSchema.parse(body);

    const review = await prisma.review.findUnique({ where: { id: params.id } });
    if (!review) return fail('Review not found', 404);
    if (review.status !== 'pending') return fail('This review has already been resolved.', 409);

    const updated = await prisma.review.update({
      where: { id: params.id },
      data: { status: 'rejected', resolvedBy: session.email, resolvedAt: new Date(), rejectionNote: note ?? null },
    });
    await audit(session.email, 'review.reject', params.id, { note: note ?? null });
    return ok({ review: { id: updated.id, status: updated.status } });
  } catch (err) {
    return handleError(err);
  }
}
