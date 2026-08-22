import { prisma } from '@/lib/prisma';
import { requireSuperAdmin } from '@/lib/admin-guard';
import { ok, handleError } from '@/lib/http';

export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/products/cost-prices — super-admin-only. Returns every
 * product (including draft/soldout/POS-only, unlike the public catalog) with
 * its cost price, for the POS "Cost Price" tab and the product edit modal.
 */
export async function GET() {
  try {
    await requireSuperAdmin();
    const products = await prisma.product.findMany({
      orderBy: { name: 'asc' },
      select: { id: true, name: true, price: true, status: true, showInWebStore: true, costPrice: true },
    });
    return ok({ products });
  } catch (err) {
    return handleError(err);
  }
}
