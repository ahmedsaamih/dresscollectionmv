import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { revalidateTag } from 'next/cache';
import { prisma } from '@/lib/prisma';
import { requirePermission, audit } from '@/lib/admin-guard';
import { ok, fail, handleError } from '@/lib/http';
import { rejectNoteSchema } from '@/lib/validation';

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
    revalidateTag('catalog', { expire: 0 });
    return ok({ review: { id: updated.id, featured: updated.featured } });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2025') {
      return fail('Review not found', 404);
    }
    return handleError(err);
  }
}

const approveSchema = z.object({ action: z.literal('approve') });
const rejectSchema = z.object({ action: z.literal('reject'), note: rejectNoteSchema.shape.note });
const moderateSchema = z.discriminatedUnion('action', [approveSchema, rejectSchema]);

/** POST /api/admin/reviews/[id] — moderate a pending review: approve or reject. */
export async function POST(request: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    const session = await requirePermission('reviews', 'edit');
    const data = moderateSchema.parse(await request.json().catch(() => ({})));

    const review = await prisma.review.findUnique({ where: { id: params.id } });
    if (!review) return fail('Review not found', 404);
    if (review.status !== 'pending') return fail('This review has already been resolved.', 409);

    if (data.action === 'approve') {
      const updated = await prisma.review.update({
        where: { id: params.id },
        data: { status: 'approved', resolvedBy: session.email, resolvedAt: new Date() },
      });
      await audit(session.email, 'review.approve', params.id);
      revalidateTag('catalog', { expire: 0 });
      return ok({ review: { id: updated.id, status: updated.status } });
    }

    const updated = await prisma.review.update({
      where: { id: params.id },
      data: { status: 'rejected', resolvedBy: session.email, resolvedAt: new Date(), rejectionNote: data.note ?? null },
    });
    await audit(session.email, 'review.reject', params.id, { note: data.note ?? null });
    revalidateTag('catalog', { expire: 0 });
    return ok({ review: { id: updated.id, status: updated.status } });
  } catch (err) {
    return handleError(err);
  }
}
