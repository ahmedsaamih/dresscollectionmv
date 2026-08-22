import { prisma } from '@/lib/prisma';
import { requirePermission, audit } from '@/lib/admin-guard';
import { ok, handleError } from '@/lib/http';
import { decryptSecret } from '@/lib/crypto';

export const dynamic = 'force-dynamic';

/** POST /api/admin/settings/google-drive/oauth/disconnect — revokes the stored refresh token. */
export async function POST() {
  try {
    const session = await requirePermission('settingsGeneral', 'edit');
    const setting = await prisma.setting.findUnique({ where: { id: 'singleton' } });
    if (setting?.googleDriveRefreshToken) {
      const token = decryptSecret(setting.googleDriveRefreshToken);
      await fetch(`https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(token)}`, { method: 'POST' }).catch(() => {});
    }
    await prisma.setting.update({
      where: { id: 'singleton' },
      data: { googleDriveRefreshToken: '', googleDriveConnectedEmail: '' },
    });
    await audit(session.email, 'settings.google_drive.disconnect', 'singleton');
    return ok({ disconnected: true });
  } catch (err) {
    return handleError(err);
  }
}
