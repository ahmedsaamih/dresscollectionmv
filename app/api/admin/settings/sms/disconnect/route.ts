import { prisma } from '@/lib/prisma';
import { requirePermission, audit } from '@/lib/admin-guard';
import { ok, handleError } from '@/lib/http';

export const dynamic = 'force-dynamic';

/**
 * POST /api/admin/settings/sms/disconnect — clears the stored MsgOwl key.
 * Leaves msgowlSenderId intact since it isn't a secret and is annoying to
 * retype if the admin reconnects shortly after.
 */
export async function POST() {
  try {
    const session = await requirePermission('settingsGeneral', 'edit');
    await prisma.setting.update({
      where: { id: 'singleton' },
      data: {
        msgowlApiKey: '',
        smsAlertsEnabled: false,
        smsLastTestAt: null,
      },
    });
    await audit(session.email, 'settings.sms.disconnect', 'singleton');
    return ok({ disconnected: true });
  } catch (err) {
    return handleError(err);
  }
}
