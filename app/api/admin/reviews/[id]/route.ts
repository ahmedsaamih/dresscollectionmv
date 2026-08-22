import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { requirePermission, audit } from '@/lib/admin-guard';
import { ok, fail, handleError } from '@/lib/http';

export const dynamic = 'force-dynamic';

const featuredSchema = z.object({ featured: z.boolean() });

/** PATCH /api/admin/reviews/[id] — toggle homepage-featured (approved reviews only). */
export async function PATCH(request: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    const session = await requirePermission('reviews', 'edit');
    const { featured } = featuredSchema.parse(await request.json());

    const review = await prisma.review.findUnique({ where: { id: params.id } });
    if (!review) return fail('Review not found', 404);
    if (review.status !== 'approved') return fail('Only approved reviews can be featured.', 409);

    const updated = await prisma.review.update({ where: { id: params.id }, data: { featured } });
    await audit(session.email, 'review.feature', params.id, { featured });
    return ok({ review: { id: updated.id, featured: updated.featured } });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2025') {
      return fail('Review not found', 404);
    }
    return handleError(err);
  }
}
