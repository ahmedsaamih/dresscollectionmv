import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { collectionUpdateSchema } from '@/lib/validation';
import { requirePermission, audit } from '@/lib/admin-guard';
import { ok, fail, handleError } from '@/lib/http';

export const dynamic = 'force-dynamic';

/** PATCH /api/admin/collections/[id] — rename (key is immutable). */
export async function PATCH(request: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    const session = await requirePermission('categories', 'edit');
    const { label, bespoke, sizeChartId } = collectionUpdateSchema.parse(await request.json());
    const data: Record<string, unknown> = { label };
    if (bespoke !== undefined) data.bespoke = bespoke;
    if (sizeChartId !== undefined) data.sizeChartId = sizeChartId;
    const updated = await prisma.collection.update({ where: { id: params.id }, data });
    await audit(session.email, 'collection.update', updated.key, { label, bespoke, sizeChartId });
    return ok({ collection: { id: updated.id, key: updated.key, label: updated.label, bespoke: updated.bespoke, sizeChartId: updated.sizeChartId } });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2025') {
      return fail('Collection not found', 404);
    }
    return handleError(err);
  }
}

/**
 * DELETE /api/admin/collections/[id].
 * Categories cascade via FK; products reference the collection by key string,
 * so we remove those explicitly (mirrors the original admin behaviour).
 */
export async function DELETE(_request: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    const session = await requirePermission('categories', 'edit');
    const collection = await prisma.collection.findUnique({ where: { id: params.id } });
    if (!collection) return fail('Collection not found', 404);

    await prisma.$transaction([
      prisma.product.deleteMany({ where: { collection: collection.key } }),
      prisma.collection.delete({ where: { id: params.id } }), // categories cascade
    ]);

    await audit(session.email, 'collection.delete', collection.key);
    return ok({ deleted: true });
  } catch (err) {
    return handleError(err);
  }
}
