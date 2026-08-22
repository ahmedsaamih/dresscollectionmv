import { prisma } from '@/lib/prisma';
import { transferStockSchema } from '@/lib/validation';
import { requirePermission, audit } from '@/lib/admin-guard';
import { ok, fail, handleError } from '@/lib/http';
import { InsufficientStockError } from '@/lib/inventory';

export const dynamic = 'force-dynamic';

/**
 * POST /api/admin/inventory/transfer
 *
 * Atomically moves qty units from one location to another.
 * Source inventory must have sufficient quantity.
 */
export async function POST(request: Request) {
  try {
    const session = await requirePermission('posTransfers', 'edit');
    const data = transferStockSchema.parse(await request.json());

    if (data.fromId === data.toId) return fail('Source and destination must differ', 400);

    const result = await prisma.$transaction(async (tx) => {
      const src = await tx.inventory.findUnique({
        where: { locationId_productId_size_color: { locationId: data.fromId, productId: data.productId, size: data.size, color: data.color } },
      });
      if (!src || src.qty < data.qty) throw new InsufficientStockError(data.productId, data.size, data.color, data.qty);

      await tx.inventory.update({
        where: { locationId_productId_size_color: { locationId: data.fromId, productId: data.productId, size: data.size, color: data.color } },
        data: { qty: { decrement: data.qty } },
      });

      await tx.inventory.upsert({
        where: { locationId_productId_size_color: { locationId: data.toId, productId: data.productId, size: data.size, color: data.color } },
        update: { qty: { increment: data.qty } },
        create: { locationId: data.toId, productId: data.productId, size: data.size, color: data.color, qty: data.qty },
      });

      return tx.stockTransfer.create({
        data: { fromId: data.fromId, toId: data.toId, productId: data.productId, size: data.size, color: data.color, qty: data.qty, note: data.note ?? null, actor: session.email },
      });
    });

    await audit(session.email, 'inventory.transfer', data.productId, { fromId: data.fromId, toId: data.toId, size: data.size, color: data.color, qty: data.qty });
    return ok({ transfer: result });
  } catch (err) {
    return handleError(err);
  }
}

/**
 * GET /api/admin/inventory/transfer — transfer audit log
 */
export async function GET(request: Request) {
  try {
    await requirePermission('posTransfers', 'read');
    const { searchParams } = new URL(request.url);
    const productId = searchParams.get('productId');
    const limit = Math.min(parseInt(searchParams.get('limit') ?? '50', 10), 200);

    const transfers = await prisma.stockTransfer.findMany({
      where: productId ? { productId } : undefined,
      include: {
        from: { select: { name: true } },
        to: { select: { name: true } },
        product: { select: { name: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });

    return ok({
      transfers: transfers.map((t) => ({
        id: t.id,
        fromId: t.fromId,
        fromName: t.from.name,
        toId: t.toId,
        toName: t.to.name,
        productId: t.productId,
        productName: t.product.name,
        size: t.size,
        color: t.color,
        qty: t.qty,
        note: t.note,
        actor: t.actor,
        date: t.createdAt.toISOString(),
      })),
    });
  } catch (err) {
    return handleError(err);
  }
}
