import { prisma } from '@/lib/prisma';
import { deliveryAreaUpdateSchema } from '@/lib/validation';
import { requirePermission, audit } from '@/lib/admin-guard';
import { ok, fail, handleError } from '@/lib/http';

export const dynamic = 'force-dynamic';

/** PATCH /api/admin/delivery-areas/[id] — update a delivery area */
export async function PATCH(request: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    const session = await requirePermission('settingsGeneral', 'edit');
    const data = deliveryAreaUpdateSchema.parse(await request.json());

    const deliveryArea = await prisma.deliveryArea.update({ where: { id: params.id }, data });

    await audit(session.email, 'deliveryArea.update', params.id, data as Record<string, unknown>);
    return ok({ deliveryArea });
  } catch (err) {
    return handleError(err);
  }
}

/** DELETE /api/admin/delivery-areas/[id] — remove a delivery area */
export async function DELETE(_: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    const session = await requirePermission('settingsGeneral', 'edit');

    const inUse = await prisma.order.count({ where: { deliveryAreaId: params.id } });
    if (inUse > 0) {
      return fail('This delivery area is used by existing orders and cannot be deleted. Mark it inactive instead.', 409);
    }

    await prisma.deliveryArea.delete({ where: { id: params.id } });
    await audit(session.email, 'deliveryArea.delete', params.id);
    return ok({ deleted: true });
  } catch (err) {
    return handleError(err);
  }
}
