import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { categoryCreateSchema } from '@/lib/validation';
import { requirePermission, audit, genId } from '@/lib/admin-guard';
import { ok, fail, handleError } from '@/lib/http';

export const dynamic = 'force-dynamic';

/** POST /api/admin/categories — create a category under a collection. */
export async function POST(request: Request) {
  try {
    const session = await requirePermission('categories', 'edit');
    const { name, collection } = categoryCreateSchema.parse(await request.json());

    const created = await prisma.category.create({
      data: { id: genId('c'), name, collectionKey: collection, count: 0 },
    });
    await audit(session.email, 'category.create', created.id, { name, collection });
    return ok({ category: { id: created.id, name: created.name, collection: created.collectionKey, count: 0 } }, 201);
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2003') {
      return fail('Collection does not exist', 400);
    }
    return handleError(err);
  }
}
