import { prisma } from '@/lib/prisma';
import { deliveryAreaCreateSchema } from '@/lib/validation';
import { requirePermission, audit } from '@/lib/admin-guard';
import { ok, handleError } from '@/lib/http';

export const dynamic = 'force-dynamic';

/** GET /api/admin/delivery-areas — list all delivery areas */
export async function GET() {
  try {
    await requirePermission('settingsGeneral', 'read');
    const deliveryAreas = await prisma.deliveryArea.findMany({ orderBy: { sortOrder: 'asc' } });
    return ok({ deliveryAreas });
  } catch (err) {
    return handleError(err);
  }
}

/** POST /api/admin/delivery-areas — create a delivery area */
export async function POST(request: Request) {
  try {
    const session = await requirePermission('settingsGeneral', 'edit');
    const data = deliveryAreaCreateSchema.parse(await request.json());

    const deliveryArea = await prisma.deliveryArea.create({ data });

    await audit(session.email, 'deliveryArea.create', deliveryArea.id, { name: data.name, rate: data.rate });
    return ok({ deliveryArea }, 201);
  } catch (err) {
    return handleError(err);
  }
}
