import { prisma } from '@/lib/prisma';
import { adjustStockSchema } from '@/lib/validation';
import { ok, fail, handleError } from '@/lib/http';
import { requirePermission, audit } from '@/lib/admin-guard';

export const dynamic = 'force-dynamic';

/**
 * POST /api/admin/inventory/adjust
 *
 * Applies a signed qty delta to a location's inventory.
 * Positive = found/correction-up; negative = write-off/damage.
 * Creates a StockAdjustment audit record.
 */
export async function POST(request: Request) {
  try {
    const session = await requirePermission('posInventory', 'edit');

    const body = await request.json();
    const data = adjustStockSchema.parse(body);

    const location = await prisma.location.findUnique({ where: { id: data.locationId } });
    if (!location) return fail('Location not found', 404);

    const product = await prisma.product.findUnique({ where: { id: data.productId } });
    if (!product) return fail('Product not found', 404);

    const row = await prisma.$transaction(async (tx) => {
      const existing = await tx.inventory.findUnique({
        where: { locationId_productId_size_color: { locationId: data.locationId, productId: data.productId, size: data.size, color: data.color } },
      });

      const currentQty = existing?.qty ?? 0;
      const newQty = Math.max(0, currentQty + data.qty);

      const updated = await tx.inventory.upsert({
        where: { locationId_productId_size_color: { locationId: data.locationId, productId: data.productId, size: data.size, color: data.color } },
        create: { locationId: data.locationId, productId: data.productId, size: data.size, color: data.color, qty: newQty },
        update: { qty: newQty },
      });

      await tx.stockAdjustment.create({
        data: {
          locationId: data.locationId,
          productId: data.productId,
          size: data.size,
          color: data.color,
          qty: data.qty,
          reason: data.reason,
          note: data.note ?? null,
          actor: session.email,
        },
      });

      return updated;
    });

    await audit(session.email, 'inventory.adjust', `${data.productId}@${data.locationId}`, {
      size: data.size, color: data.color, qty: data.qty, reason: data.reason,
    });

    return ok({ row: { locationId: row.locationId, productId: row.productId, size: row.size, color: row.color, qty: row.qty } });
  } catch (err) {
    return handleError(err);
  }
}
