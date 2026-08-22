import { prisma } from '@/lib/prisma';
import { requirePermission, audit } from '@/lib/admin-guard';
import { ok, handleError } from '@/lib/http';
import { customizationProfileSchema } from '@/lib/validation';
import { saveCustomizationProfile } from '@/lib/customization-profiles';

export const dynamic = 'force-dynamic';

export async function PATCH(request: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    const session = await requirePermission('customization', 'edit');
    const data = customizationProfileSchema.parse(await request.json());
    const profile = await saveCustomizationProfile(data, params.id);
    await audit(session.email, 'customizationProfile.update', profile.id, { name: profile.name });
    return ok({ profile });
  } catch (err) {
    return handleError(err);
  }
}

export async function DELETE(_request: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    const session = await requirePermission('customization', 'edit');
    await prisma.customizationProfile.delete({ where: { id: params.id } });
    await audit(session.email, 'customizationProfile.delete', params.id);
    return ok({ ok: true });
  } catch (err) {
    return handleError(err);
  }
}
