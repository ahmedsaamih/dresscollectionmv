import { prisma } from '@/lib/prisma';
import { ok, handleError } from '@/lib/http';

export const dynamic = 'force-dynamic';

/** GET /api/reviews — all approved reviews, newest-approved first, for the public /reviews page. */
export async function GET() {
  try {
    const rows = await prisma.review.findMany({
      where: { status: 'approved' },
      orderBy: { resolvedAt: 'desc' },
      select: { id: true, rating: true, quote: true, authorName: true, authorRole: true, resolvedAt: true },
    });
    return ok({
      reviews: rows.map((r) => ({
        id: r.id,
        rating: r.rating,
        quote: r.quote ?? '',
        name: r.authorName ?? '',
        role: r.authorRole ?? '',
      })),
    });
  } catch (err) {
    return handleError(err);
  }
}
