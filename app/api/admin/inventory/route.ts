import { z } from 'zod';
import { revalidateTag } from 'next/cache';
import { prisma } from '@/lib/prisma';
import { inventoryPlacementSchema, adjustStockSchema, receiveStockSchema } from '@/lib/validation';
import { requirePermission, audit } from '@/lib/admin-guard';
import { ok, fail, handleError } from '@/lib/http';

export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/inventory?locationId=xxx
 *
 * Returns all inventory rows for a location, joined with product name.
 * If locationId is omitted, returns rows for all locations.
 */
export async function GET(request: Request) {
  try {
    await requirePermission('posInventory', 'read');
    const { searchParams } = new URL(request.url);
    const locationId = searchParams.get('locationId');

    const rows = await prisma.inventory.findMany({
      where: locationId ? { locationId } : undefined,
      include: { product: { select: { id: true, name: true, img: true } }, location: { select: { id: true, name: true } } },
      orderBy: [{ product: { name: 'asc' } }, { size: 'asc' }, { color: 'asc' }],
    });

    const placements = await prisma.inventoryPlacement.findMany({
      where: locationId ? { locationId } : undefined,
      select: { locationId: true, productId: true, physicalLocation: true },
    });
    const placementByProductLocation = new Map(
      placements.map((p) => [`${p.locationId}:${p.productId}`, p.physicalLocation])
    );

    const inventory = rows.map((r) => ({
      locationId: r.locationId,
      locationName: r.location.name,
      productId: r.productId,
      productName: r.product.name,
      productImg: r.product.img,
      size: r.size,
      color: r.color,
      qty: r.qty,
      physicalLocation: placementByProductLocation.get(`${r.locationId}:${r.productId}`) ?? '',
    }));

    return ok({ inventory });
  } catch (err) {
    return handleError(err);
  }
}

export async function PATCH(request: Request) {
  try {
    await requirePermission('posInventory', 'edit');
    const data = inventoryPlacementSchema.parse(await request.json());

    const location = await prisma.location.findUnique({ where: { id: data.locationId } });
    if (!location) return fail('Location not found', 404);

    const product = await prisma.product.findUnique({ where: { id: data.productId } });
    if (!product) return fail('Product not found', 404);

    const placement = await prisma.inventoryPlacement.upsert({
      where: { locationId_productId: { locationId: data.locationId, productId: data.productId } },
      update: { physicalLocation: data.physicalLocation },
      create: { locationId: data.locationId, productId: data.productId, physicalLocation: data.physicalLocation },
      select: { locationId: true, productId: true, physicalLocation: true },
    });

    return ok({ placement });
  } catch (err) {
    return handleError(err);
  }
}

const adjustBodySchema = adjustStockSchema.and(z.object({ action: z.literal('adjust') }));
const receiveBodySchema = receiveStockSchema.and(z.object({ action: z.literal('receive') }));

/**
 * POST /api/admin/inventory
 * `action: 'adjust'` applies a signed qty delta to a location's inventory
 * (positive = found/correction-up, negative = write-off/damage) and records a
 * StockAdjustment audit row. `action: 'receive'` adds stock to a location's
 * inventory (upsert — creates the row if missing).
 */
export async function POST(request: Request) {
  try {
    const session = await requirePermission('posInventory', 'edit');
    const body = await request.json();
    const action = body?.action;

    if (action === 'receive') {
      const data = receiveBodySchema.parse(body);
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
      revalidateTag('catalog', { expire: 0 });
      return ok({ row });
    }

    if (action === 'adjust') {
      const data = adjustBodySchema.parse(body);
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
      revalidateTag('catalog', { expire: 0 });

      return ok({ row: { locationId: row.locationId, productId: row.productId, size: row.size, color: row.color, qty: row.qty } });
    }

    return fail('Unknown action — expected "adjust" or "receive".', 400);
  } catch (err) {
    return handleError(err);
  }
}
