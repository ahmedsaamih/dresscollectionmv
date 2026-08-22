import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { mapPromo } from '@/lib/promo';
import { promoCreateSchema } from '@/lib/validation';
import { requirePermission, audit } from '@/lib/admin-guard';
import { ok, fail, handleError } from '@/lib/http';

export const dynamic = 'force-dynamic';

/** GET /api/admin/promos — all codes, newest first. */
export async function GET() {
  try {
    await requirePermission('promos', 'read');
    const rows = await prisma.promoCode.findMany({ orderBy: { createdAt: 'desc' } });
    return ok({ promos: rows.map(mapPromo) });
  } catch (err) {
    return handleError(err);
  }
}

/** POST /api/admin/promos — create a code. */
export async function POST(request: Request) {
  try {
    const session = await requirePermission('promos', 'edit');
    const data = promoCreateSchema.parse(await request.json());
    const created = await prisma.promoCode.create({
      data: {
        code: data.code.toUpperCase(),
        description: data.description ?? null,
        discountType: data.discountType,
        discountValue: data.discountValue,
        scope: data.scope,
        scopeValue: data.scope === 'all' ? null : (data.scopeValue ?? null),
        minSubtotal: data.minSubtotal,
        maxRedemptions: data.maxRedemptions ?? null,
        expiresAt: data.expiresAt ?? null,
        active: data.active,
        referrer: data.referrer ?? null,
        commissionType: data.commissionType,
        commissionValue: data.commissionValue,
      },
    });
    await audit(session.email, 'promo.create', created.code);
    return ok({ promo: mapPromo(created) }, 201);
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      return fail('A code with that name already exists.', 409);
    }
    return handleError(err);
  }
}
