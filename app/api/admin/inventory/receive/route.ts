import { prisma } from '@/lib/prisma';
import { receiveStockSchema } from '@/lib/validation';
import { requirePermission, audit } from '@/lib/admin-guard';
import { ok, fail, handleError } from '@/lib/http';

export const dynamic = 'force-dynamic';

/**
 * POST /api/admin/inventory/receive
 *
 * Adds stock to a location's inventory (upsert — creates row if missing).
 */
export async function POST(request: Request) {
  try {
    const session = await requirePermission('posInventory', 'edit');
    const data = receiveStockSchema.parse(await request.json());

    const location = await prisma.location.findUnique({ where: { id: data.locationId } });
    if (!location) return fail('Location not found', 404);

    const product = await prisma.product.findUnique({ where: { id: data.productId } });
    if (!product) return fail('Product not found', 404);

    const row = await prisma.inventory.upsert({
      where: { locationId_productId_size_color: { locationId: data.locationId, productId: data.productId, size: data.size, color: data.color } },
      update: { qty: { increment: data.qty } },
      create: { locationId: data.locationId, productId: data.productId, size: data.size, color: data.color, qty: data.qty },
    });

    await audit(session.email, 'inventory.receive', data.productId, { locationId: data.locationId, size: data.size, color: data.color, qty: data.qty });
    return ok({ row });
  } catch (err) {
    return handleError(err);
  }
}
