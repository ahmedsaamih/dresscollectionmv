import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { mapPromo } from '@/lib/promo';
import { promoUpdateSchema } from '@/lib/validation';
import { requirePermission, audit } from '@/lib/admin-guard';
import { ok, fail, handleError } from '@/lib/http';

export const dynamic = 'force-dynamic';

/** PATCH /api/admin/promos/[id] — partial update. */
export async function PATCH(request: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    const session = await requirePermission('promos', 'edit');
    const data = promoUpdateSchema.parse(await request.json());

    const update: Prisma.PromoCodeUpdateInput = {};
    if (data.code !== undefined) update.code = data.code.toUpperCase();
    if (data.description !== undefined) update.description = data.description ?? null;
    if (data.discountType !== undefined) update.discountType = data.discountType;
    if (data.discountValue !== undefined) update.discountValue = data.discountValue;
    if (data.scope !== undefined) update.scope = data.scope;
    if (data.scopeValue !== undefined) update.scopeValue = data.scopeValue ?? null;
    if (data.minSubtotal !== undefined) update.minSubtotal = data.minSubtotal;
    if (data.maxRedemptions !== undefined) update.maxRedemptions = data.maxRedemptions ?? null;
    if (data.expiresAt !== undefined) update.expiresAt = data.expiresAt ?? null;
    if (data.active !== undefined) update.active = data.active;
    if (data.referrer !== undefined) update.referrer = data.referrer ?? null;
    if (data.commissionType !== undefined) update.commissionType = data.commissionType;
    if (data.commissionValue !== undefined) update.commissionValue = data.commissionValue;
    // Keep scopeValue consistent when switching to "all".
    if (data.scope === 'all') update.scopeValue = null;

    const updated = await prisma.promoCode.update({ where: { id: params.id }, data: update });
    await audit(session.email, 'promo.update', updated.code, data);
    return ok({ promo: mapPromo(updated) });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError) {
      if (err.code === 'P2002') return fail('A code with that name already exists.', 409);
      if (err.code === 'P2025') return fail('Code not found', 404);
    }
    return handleError(err);
  }
}

/** DELETE /api/admin/promos/[id]. Redemption records survive (codeId set null). */
export async function DELETE(_request: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    const session = await requirePermission('promos', 'edit');
    await prisma.promoCode.delete({ where: { id: params.id } });
    await audit(session.email, 'promo.delete', params.id);
    return ok({ deleted: true });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2025') {
      return fail('Code not found', 404);
    }
    return handleError(err);
  }
}
