import { prisma } from '@/lib/prisma';
import { locationCreateSchema } from '@/lib/validation';
import { requirePermission, audit, genId } from '@/lib/admin-guard';
import { ok, handleError } from '@/lib/http';

export const dynamic = 'force-dynamic';

/** GET /api/admin/locations — list all locations */
export async function GET() {
  try {
    await requirePermission('settingsLocations', 'read');
    const locations = await prisma.location.findMany({ orderBy: { sortOrder: 'asc' } });
    return ok({ locations });
  } catch (err) {
    return handleError(err);
  }
}

/** POST /api/admin/locations — create a location */
export async function POST(request: Request) {
  try {
    const session = await requirePermission('settingsLocations', 'edit');
    const data = locationCreateSchema.parse(await request.json());

    if (data.isWebDefault) {
      await prisma.location.updateMany({ where: { isWebDefault: true }, data: { isWebDefault: false } });
    }

    const id = genId('loc');
    const location = await prisma.location.create({
      data: { id, name: data.name, showOnWeb: data.showOnWeb, isWebDefault: data.isWebDefault, sortOrder: data.sortOrder },
    });

    await audit(session.email, 'location.create', id, { name: data.name });
    return ok({ location }, 201);
  } catch (err) {
    return handleError(err);
  }
}
