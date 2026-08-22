import { prisma } from '@/lib/prisma';
import { locationUpdateSchema } from '@/lib/validation';
import { requirePermission, audit } from '@/lib/admin-guard';
import { ok, fail, handleError } from '@/lib/http';

export const dynamic = 'force-dynamic';

/** PATCH /api/admin/locations/[id] — update a location */
export async function PATCH(request: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    const session = await requirePermission('settingsLocations', 'edit');
    const data = locationUpdateSchema.parse(await request.json());

    if (data.isWebDefault) {
      await prisma.location.updateMany({ where: { isWebDefault: true }, data: { isWebDefault: false } });
    }

    const location = await prisma.location.update({
      where: { id: params.id },
      data,
    });

    await audit(session.email, 'location.update', params.id, data as Record<string, unknown>);
    return ok({ location });
  } catch (err) {
    return handleError(err);
  }
}

/** DELETE /api/admin/locations/[id] — delete if no remaining inventory */
export async function DELETE(_: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    const session = await requirePermission('settingsLocations', 'edit');

    const nonZero = await prisma.inventory.count({
      where: { locationId: params.id, qty: { gt: 0 } },
    });
    if (nonZero > 0) {
      return fail('Transfer all stock out before deleting this location.', 409);
    }

    await prisma.inventory.deleteMany({ where: { locationId: params.id } });
    await prisma.location.delete({ where: { id: params.id } });
    await audit(session.email, 'location.delete', params.id);
    return ok({ deleted: true });
  } catch (err) {
    return handleError(err);
  }
}
