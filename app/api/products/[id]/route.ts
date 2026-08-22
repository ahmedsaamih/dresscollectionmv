import { prisma } from '@/lib/prisma';
import { mapProduct } from '@/lib/catalog';
import { ok, fail, handleError } from '@/lib/http';

export const dynamic = 'force-dynamic';

/**
 * GET /api/products/[id]
 * Public single-product read. Drafts are hidden from the storefront.
 */
export async function GET(_request: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    const product = await prisma.product.findUnique({
      where: { id: params.id },
      include: { inventory: { include: { location: true } } },
    });
    if (!product || product.status === 'draft') return fail('Product not found', 404);
    return ok({ product: mapProduct(product) });
  } catch (err) {
    return handleError(err);
  }
}

/**
 * PATCH /api/products/[id]  (admin only — wired in Phase 6)
 */
export async function PATCH() {
  return fail('Not implemented', 501);
}

/**
 * DELETE /api/products/[id]  (admin only — wired in Phase 6)
 */
export async function DELETE() {
  return fail('Not implemented', 501);
}
