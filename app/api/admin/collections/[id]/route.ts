import { Prisma } from '@prisma/client';
import { revalidateTag } from 'next/cache';
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
    const { label, sizeChartId } = collectionUpdateSchema.parse(await request.json());
    const data: Record<string, unknown> = { label };
    if (sizeChartId !== undefined) data.sizeChartId = sizeChartId;
    const updated = await prisma.collection.update({ where: { id: params.id }, data });
    await audit(session.email, 'collection.update', updated.key, { label, sizeChartId });
    revalidateTag('catalog', { expire: 0 });
    return ok({ collection: { id: updated.id, key: updated.key, label: updated.label, sizeChartId: updated.sizeChartId } });
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
    revalidateTag('catalog', { expire: 0 });
    return ok({ deleted: true });
  } catch (err) {
    return handleError(err);
  }
}
