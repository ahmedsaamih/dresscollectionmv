import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { mapProduct, productListSelect } from '@/lib/catalog';
import { ok, fail, handleError } from '@/lib/http';
import { rateLimitResponse } from '@/lib/rate-limit';

export const dynamic = 'force-dynamic';

/**
 * GET /api/products
 * Public product listing with optional filters.
 *
 * Query params:
 *   collection  — e.g. "ready" | "casual" | "accessories"
 *   category    — e.g. "Football"
 *   status      — "active" | "soldout" | "draft" | "all" (default: active only)
 *   sort        — "new" | "price_asc" | "price_desc"
 *   limit       — integer (default 50, max 100)
 *   offset      — integer (default 0)
 */
export async function GET(request: Request) {
  try {
    const ipLimit = await rateLimitResponse(request, { scope: 'products:ip', limit: 120, windowMs: 60 * 1000 });
    if (ipLimit) return ipLimit;

    const { searchParams } = new URL(request.url);
    const collection = searchParams.get('collection');
    const category = searchParams.get('category');
    const status = searchParams.get('status') ?? 'active';
    const sort = searchParams.get('sort') ?? 'new';
    const limit = Math.min(Math.max(parseInt(searchParams.get('limit') ?? '50', 10) || 50, 1), 100);
    const offset = Math.max(parseInt(searchParams.get('offset') ?? '0', 10) || 0, 0);

    const where: Prisma.ProductWhereInput = {};
    if (collection) where.collection = collection;
    if (category) where.category = category;
    if (status !== 'all') where.status = status as 'active' | 'soldout' | 'draft';

    const orderBy: Prisma.ProductOrderByWithRelationInput =
      sort === 'price_asc' ? { price: 'asc' } : sort === 'price_desc' ? { price: 'desc' } : { name: 'asc' };

    const [rows, total] = await Promise.all([
      prisma.product.findMany({ where, orderBy, take: limit, skip: offset, select: productListSelect }),
      prisma.product.count({ where }),
    ]);

    return ok({ products: rows.map(mapProduct), total, limit, offset });
  } catch (err) {
    return handleError(err);
  }
}

/**
 * POST /api/products  (admin only — wired in Phase 6)
 */
export async function POST() {
  return fail('Not implemented', 501);
}
