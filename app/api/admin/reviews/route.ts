import { prisma } from '@/lib/prisma';
import { requirePermission } from '@/lib/admin-guard';
import { ok, handleError } from '@/lib/http';
import type { Review } from '@/lib/types';

export const dynamic = 'force-dynamic';

/** GET /api/admin/reviews — submitted reviews, newest first (reviews module). */
export async function GET() {
  try {
    await requirePermission('reviews', 'read');
    const rows = await prisma.review.findMany({
      where: { submittedAt: { not: null } },
      orderBy: { submittedAt: 'desc' },
      take: 200,
      include: { order: { select: { customer: true, email: true } } },
    });
    const reviews: Review[] = rows.map((r) => ({
      id: r.id,
      orderId: r.orderId,
      orderCustomer: r.order.customer,
      orderEmail: r.order.email,
      rating: r.rating,
      quote: r.quote,
      authorName: r.authorName,
      authorRole: r.authorRole,
      submittedAt: r.submittedAt ? r.submittedAt.toISOString() : null,
      status: r.status,
      featured: r.featured,
      resolvedBy: r.resolvedBy ?? null,
      resolvedAt: r.resolvedAt ? r.resolvedAt.toISOString() : null,
      rejectionNote: r.rejectionNote ?? null,
      createdAt: r.createdAt.toISOString(),
    }));
    return ok({ reviews });
  } catch (err) {
    return handleError(err);
  }
}
