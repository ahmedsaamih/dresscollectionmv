import { prisma } from '@/lib/prisma';
import { requirePermission, audit } from '@/lib/admin-guard';
import { ok, handleError } from '@/lib/http';
import { customizationProfileSchema } from '@/lib/validation';
import {
  customizationProfileInclude,
  saveCustomizationProfile,
  serializeCustomizationProfile,
} from '@/lib/customization-profiles';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    await requirePermission('customization', 'read');
    const profiles = await prisma.customizationProfile.findMany({
      include: customizationProfileInclude,
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    });
    return ok({ profiles: profiles.map(serializeCustomizationProfile) });
  } catch (err) {
    return handleError(err);
  }
}

export async function POST(request: Request) {
  try {
    const session = await requirePermission('customization', 'edit');
    const data = customizationProfileSchema.parse(await request.json());
    const profile = await saveCustomizationProfile(data);
    await audit(session.email, 'customizationProfile.create', profile.id, { name: profile.name });
    return ok({ profile }, 201);
  } catch (err) {
    return handleError(err);
  }
}
