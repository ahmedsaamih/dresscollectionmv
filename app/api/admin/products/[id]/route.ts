import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { mapProduct } from '@/lib/catalog';
import { productUpdateSchema } from '@/lib/validation';
import { requirePermission, audit } from '@/lib/admin-guard';
import { ok, fail, handleError } from '@/lib/http';

export const dynamic = 'force-dynamic';

/**
 * PATCH /api/admin/products/[id] — partial update of product fields only.
 * Never touches Inventory — stock changes go through product creation or the
 * Inventory menu (Receive/Adjust/Transfer) instead.
 */
export async function PATCH(request: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    const session = await requirePermission('products', 'edit');
    const data = productUpdateSchema.parse(await request.json());
    if (session.role !== 'admin') delete data.costPrice;

    const update: Prisma.ProductUpdateInput = {};
    for (const [k, v] of Object.entries(data)) {
      if (v !== undefined) (update as Record<string, unknown>)[k] = v;
    }

    const updated = await prisma.product.update({
      where: { id: params.id },
      data: update,
      include: { inventory: { include: { location: true } } },
    });
    await audit(session.email, 'product.update', params.id, data);
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
    return ok({ deleted: true });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2025') {
      return fail('Product not found', 404);
    }
    return handleError(err);
  }
}
