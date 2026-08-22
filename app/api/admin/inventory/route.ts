import { prisma } from '@/lib/prisma';
import { inventoryPlacementSchema } from '@/lib/validation';
import { requirePermission } from '@/lib/admin-guard';
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
