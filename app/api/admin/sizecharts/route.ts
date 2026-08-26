import { revalidateTag } from 'next/cache';
import { prisma } from '@/lib/prisma';
import { sizeChartCreateSchema } from '@/lib/validation';
import { requirePermission, audit, genId } from '@/lib/admin-guard';
import { ok, handleError } from '@/lib/http';

export const dynamic = 'force-dynamic';

/** GET /api/admin/sizecharts — list all size charts. */
export async function GET() {
  try {
    await requirePermission('sizechart', 'read');
    const sizeCharts = await prisma.sizeChart.findMany({ orderBy: { createdAt: 'asc' } });
    return ok({ sizeCharts });
  } catch (err) {
    return handleError(err);
  }
}

/** POST /api/admin/sizecharts — create a size chart. */
export async function POST(request: Request) {
  try {
    const session = await requirePermission('sizechart', 'edit');
    const body = sizeChartCreateSchema.parse(await request.json());
    const id = genId('sc');

    const created = body.isDefault
      ? (await prisma.$transaction([
          prisma.sizeChart.updateMany({ where: { isDefault: true }, data: { isDefault: false } }),
          prisma.sizeChart.create({ data: { id, ...body } }),
        ]))[1]
      : await prisma.sizeChart.create({ data: { id, ...body } });

    await audit(session.email, 'sizechart.create', id, { name: body.name });
    revalidateTag('catalog', { expire: 0 });
    return ok({ sizeChart: created }, 201);
  } catch (err) {
    return handleError(err);
  }
}
