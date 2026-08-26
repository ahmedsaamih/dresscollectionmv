import { prisma } from '@/lib/prisma';
import { mapProduct, productListSelect } from '@/lib/catalog';
import { ok, handleError } from '@/lib/http';
import { rateLimitResponse } from '@/lib/rate-limit';

export const dynamic = 'force-dynamic';

/**
 * GET /api/search?q=…
 * Public product search across name, subtitle, category and collection.
 * Drafts are excluded. Case-insensitive substring match.
 */
export async function GET(request: Request) {
  try {
    const ipLimit = await rateLimitResponse(request, { scope: 'search:ip', limit: 120, windowMs: 60 * 1000 });
    if (ipLimit) return ipLimit;

    const { searchParams } = new URL(request.url);
    const q = (searchParams.get('q') || '').trim().slice(0, 80);
    const limit = Math.min(Math.max(parseInt(searchParams.get('limit') ?? '40', 10) || 40, 1), 100);

    if (q.length < 2) return ok({ query: q, products: [], total: 0 });

    const where = {
      status: { not: 'draft' as const },
      OR: [
        { name: { contains: q, mode: 'insensitive' as const } },
        { sub: { contains: q, mode: 'insensitive' as const } },
        { category: { contains: q, mode: 'insensitive' as const } },
        { collection: { contains: q, mode: 'insensitive' as const } },
      ],
    };

    const rows = await prisma.product.findMany({ where, orderBy: { name: 'asc' }, take: limit, select: productListSelect });
    return ok({ query: q, products: rows.map(mapProduct), total: rows.length });
  } catch (err) {
    return handleError(err);
  }
}
