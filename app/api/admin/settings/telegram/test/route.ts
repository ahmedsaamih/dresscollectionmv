import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { requirePermission, audit } from '@/lib/admin-guard';
import { ok, fail, handleError } from '@/lib/http';
import { encryptSecret, decryptSecret } from '@/lib/crypto';
import { testTelegramConnection } from '@/lib/telegram';

export const dynamic = 'force-dynamic';

const bodySchema = z.object({
  botToken: z.string().trim().optional(),
  chatId: z.string().trim().min(1, 'Enter a chat ID'),
});

/**
 * POST /api/admin/settings/telegram/test
 * Sends a real test message to verify the bot token + chat ID both work,
 * saving them (encrypted) on success. `botToken` may be omitted to re-test
 * with a newly-picked chat ID against the already-saved token.
 */
export async function POST(request: Request) {
  try {
    const session = await requirePermission('settingsGeneral', 'edit');
    const data = bodySchema.parse(await request.json());

    const existing = await prisma.setting.findUnique({ where: { id: 'singleton' } });
    let botToken = data.botToken || '';
    if (!botToken && existing?.telegramBotToken) {
      try {
        botToken = decryptSecret(existing.telegramBotToken);
      } catch (e) {
        console.error('[settings/telegram] failed to decrypt saved bot token', e);
        return fail('Could not read the saved bot token — SETTINGS_ENCRYPTION_KEY may have changed since it was saved. Re-enter your bot token to reconnect.', 400);
      }
    }
    if (!botToken) return fail('Enter your Telegram bot token.', 400);

    let username: string;
    try {
      ({ username } = await testTelegramConnection(botToken, data.chatId));
    } catch (e) {
      return fail(e instanceof Error ? e.message : 'Could not connect to Telegram.', 400);
    }

    let encryptedToken: string;
    try {
      encryptedToken = encryptSecret(botToken);
    } catch (e) {
      console.error('[settings/telegram] failed to encrypt bot token for storage', e);
      return fail('Telegram connected, but the server could not save the token — SETTINGS_ENCRYPTION_KEY is not configured. Contact an administrator.', 500);
    }

    const updated = await prisma.setting.update({
      where: { id: 'singleton' },
      data: {
        telegramBotToken: encryptedToken,
        telegramChatId: data.chatId,
        telegramBotUsername: username,
        telegramLastTestAt: new Date(),
      },
    });
    await audit(session.email, 'settings.telegram.test', 'singleton', { chatId: data.chatId });
    return ok({
      username: updated.telegramBotUsername,
      chatId: updated.telegramChatId,
      lastTestAt: updated.telegramLastTestAt?.toISOString() ?? null,
      enabled: updated.telegramAlertsEnabled,
    });
  } catch (err) {
    return handleError(err);
  }
}
