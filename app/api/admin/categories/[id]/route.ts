import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { categoryUpdateSchema } from '@/lib/validation';
import { requirePermission, audit } from '@/lib/admin-guard';
import { ok, fail, handleError } from '@/lib/http';

export const dynamic = 'force-dynamic';

/** PATCH /api/admin/categories/[id]. */
export async function PATCH(request: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    const session = await requirePermission('categories', 'edit');
    const data = categoryUpdateSchema.parse(await request.json());

    const update: Prisma.CategoryUpdateInput = {};
    if (data.name !== undefined) update.name = data.name;
    if (data.collection !== undefined) update.collection = { connect: { key: data.collection } };

    if (data.name !== undefined) {
      const old = await prisma.category.findUnique({ where: { id: params.id }, select: { name: true } });
      if (old && old.name !== data.name) {
        await prisma.product.updateMany({ where: { category: old.name }, data: { category: data.name } });
      }
    }

    const updated = await prisma.category.update({ where: { id: params.id }, data: update });
    await audit(session.email, 'category.update', params.id, data);
    return ok({ category: { id: updated.id, name: updated.name, collection: updated.collectionKey, count: updated.count } });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2025') {
      return fail('Category not found', 404);
    }
    return handleError(err);
  }
}

/** DELETE /api/admin/categories/[id]. */
export async function DELETE(_request: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    const session = await requirePermission('categories', 'edit');
    await prisma.category.delete({ where: { id: params.id } });
    await audit(session.email, 'category.delete', params.id);
    return ok({ deleted: true });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2025') {
      return fail('Category not found', 404);
    }
    return handleError(err);
  }
}
