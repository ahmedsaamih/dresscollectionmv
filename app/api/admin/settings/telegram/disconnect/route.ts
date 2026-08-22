import { prisma } from '@/lib/prisma';
import { requirePermission, audit } from '@/lib/admin-guard';
import { ok, handleError } from '@/lib/http';

export const dynamic = 'force-dynamic';

/** POST /api/admin/settings/telegram/disconnect — clears the stored bot token/chat ID. */
export async function POST() {
  try {
    const session = await requirePermission('settingsGeneral', 'edit');
    await prisma.setting.update({
      where: { id: 'singleton' },
      data: {
        telegramBotToken: '',
        telegramChatId: '',
        telegramBotUsername: '',
        telegramAlertsEnabled: false,
        telegramLastTestAt: null,
      },
    });
    await audit(session.email, 'settings.telegram.disconnect', 'singleton');
    return ok({ disconnected: true });
  } catch (err) {
    return handleError(err);
  }
}
