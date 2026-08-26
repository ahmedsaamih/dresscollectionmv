import { revalidateTag } from 'next/cache';
import { prisma } from '@/lib/prisma';
import { collectionCreateSchema } from '@/lib/validation';
import { requirePermission, audit, genId } from '@/lib/admin-guard';
import { ok, handleError } from '@/lib/http';

export const dynamic = 'force-dynamic';

/** Slugify a label into a unique collection key. */
async function uniqueKey(label: string): Promise<string> {
  const base = label.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'collection';
  const existing = new Set((await prisma.collection.findMany({ select: { key: true } })).map((c) => c.key));
  let key = base;
  let i = 2;
  while (existing.has(key)) key = `${base}-${i++}`;
  return key;
}

/** POST /api/admin/collections — create a collection. */
export async function POST(request: Request) {
  try {
    const session = await requirePermission('categories', 'edit');
    const { label, sizeChartId } = collectionCreateSchema.parse(await request.json());
    const key = await uniqueKey(label);

    const created = await prisma.collection.create({ data: { id: genId('cl'), key, label, sizeChartId: sizeChartId ?? null } });
    await audit(session.email, 'collection.create', key, { label, sizeChartId });
    revalidateTag('catalog', { expire: 0 });
    return ok({ collection: { id: created.id, key: created.key, label: created.label, sizeChartId: created.sizeChartId } }, 201);
  } catch (err) {
    return handleError(err);
  }
}
