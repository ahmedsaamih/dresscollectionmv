import { prisma } from '@/lib/prisma';
import { requirePermission, audit } from '@/lib/admin-guard';
import { ok, handleError } from '@/lib/http';

export const dynamic = 'force-dynamic';

/**
 * POST /api/admin/settings/email/disconnect — clears the stored Resend key.
 * Leaves emailFromUser/emailFromName intact since they aren't secrets and
 * are annoying to retype if the admin reconnects shortly after.
 */
export async function POST() {
  try {
    const session = await requirePermission('settingsGeneral', 'edit');
    await prisma.setting.update({
      where: { id: 'singleton' },
      data: {
        emailApiKey: '',
        emailAlertsEnabled: false,
        emailLastTestAt: null,
      },
    });
    await audit(session.email, 'settings.email.disconnect', 'singleton');
    return ok({ disconnected: true });
  } catch (err) {
    return handleError(err);
  }
}
