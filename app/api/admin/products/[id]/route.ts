import { Prisma } from '@prisma/client';
import { revalidateTag } from 'next/cache';
import { prisma } from '@/lib/prisma';
import { mapProduct } from '@/lib/catalog';
import { productUpdateSchema } from '@/lib/validation';
import { requirePermission, audit } from '@/lib/admin-guard';
import { ok, fail, handleError } from '@/lib/http';
import { incrementStock } from '@/lib/inventory';

export const dynamic = 'force-dynamic';

/**
 * PATCH /api/admin/products/[id] — partial update of product fields only.
 * Never touches existing Inventory — stock changes go through product creation
 * or the Inventory menu (Receive/Adjust/Transfer) instead. The one exception is
 * `newColorSizeStock`: additive-only seeding for colour/size combos the edit
 * form just introduced (e.g. a newly added colour) so they don't render as a
 * false 0-stock on the storefront — it only ever inserts/increments, never
 * touches a combo that already carries Inventory.
 */
export async function PATCH(request: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    const session = await requirePermission('products', 'edit');
    const { newColorSizeStock, newStockLocationId, ...data } = productUpdateSchema.parse(await request.json());
    if (session.role !== 'admin') delete data.costPrice;

    const update: Prisma.ProductUpdateInput = {};
    for (const [k, v] of Object.entries(data)) {
      if (v !== undefined) (update as Record<string, unknown>)[k] = v;
    }

    const hasNewStock = !!newColorSizeStock && Object.values(newColorSizeStock).some((bySize) => Object.values(bySize).some((qty) => qty > 0));
    if (hasNewStock) {
      if (!newStockLocationId) return fail('Select a location for the new colour/size stock.', 400);
      const location = await prisma.location.findUnique({ where: { id: newStockLocationId } });
      if (!location) return fail('Selected location does not exist.', 400);
    }

    const updated = await prisma.$transaction(async (tx) => {
      await tx.product.update({ where: { id: params.id }, data: update });
      if (hasNewStock) {
        for (const [color, bySize] of Object.entries(newColorSizeStock!)) {
          for (const [size, qty] of Object.entries(bySize)) {
            if (qty > 0) await incrementStock(tx, { locationId: newStockLocationId!, productId: params.id, size, color, qty });
          }
        }
      }
      return tx.product.findUniqueOrThrow({ where: { id: params.id }, include: { inventory: { include: { location: true } } } });
    });
    await audit(session.email, 'product.update', params.id, data);
    revalidateTag('catalog', { expire: 0 });
    const product = session.role === 'admin' ? { ...mapProduct(updated), costPrice: updated.costPrice } : mapProduct(updated);
    return ok({ product });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2025') {
      return fail('Product not found', 404);
    }
    return handleError(err);
  }
}

/** DELETE /api/admin/products/[id]. */
export async function DELETE(_request: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    const session = await requirePermission('products', 'edit');
    await prisma.product.delete({ where: { id: params.id } });
    await audit(session.email, 'product.delete', params.id);
    revalidateTag('catalog', { expire: 0 });
    return ok({ deleted: true });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2025') {
      return fail('Product not found', 404);
    }
    return handleError(err);
  }
}
