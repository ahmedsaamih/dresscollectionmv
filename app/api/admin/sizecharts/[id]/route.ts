import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { sizeChartUpdateSchema } from '@/lib/validation';
import { requirePermission, audit } from '@/lib/admin-guard';
import { ok, fail, handleError } from '@/lib/http';

export const dynamic = 'force-dynamic';

/** PATCH /api/admin/sizecharts/[id] — update a chart (name/note/columns/rows/isDefault). */
export async function PATCH(request: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    const session = await requirePermission('sizechart', 'edit');
    const body = sizeChartUpdateSchema.parse(await request.json());

    const updated = body.isDefault
      ? (await prisma.$transaction([
          prisma.sizeChart.updateMany({ where: { isDefault: true, NOT: { id: params.id } }, data: { isDefault: false } }),
          prisma.sizeChart.update({ where: { id: params.id }, data: body }),
        ]))[1]
      : await prisma.sizeChart.update({ where: { id: params.id }, data: body });

    await audit(session.email, 'sizechart.update', params.id, { keys: Object.keys(body) });
    return ok({ sizeChart: updated });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2025') {
      return fail('Size chart not found', 404);
    }
    return handleError(err);
  }
}

/**
 * DELETE /api/admin/sizecharts/[id].
 * Blocked for the current default chart (there must always be one). Otherwise,
 * collections referencing this chart fall back to the default via onDelete: SetNull.
 */
export async function DELETE(_request: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    const session = await requirePermission('sizechart', 'edit');
    const chart = await prisma.sizeChart.findUnique({ where: { id: params.id }, include: { collections: true } });
    if (!chart) return fail('Size chart not found', 404);
    if (chart.isDefault) return fail('Cannot delete the default size chart — set another chart as default first', 400);

    await prisma.sizeChart.delete({ where: { id: params.id } });
    await audit(session.email, 'sizechart.delete', params.id, { collectionsAffected: chart.collections.length });
    return ok({ deleted: true });
  } catch (err) {
    return handleError(err);
  }
}
