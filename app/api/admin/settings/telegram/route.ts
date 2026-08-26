import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { requirePermission, audit } from '@/lib/admin-guard';
import { ok, fail, handleError } from '@/lib/http';
import { encryptSecret, decryptSecret } from '@/lib/crypto';
import { testTelegramConnection, detectTelegramChats } from '@/lib/telegram';

export const dynamic = 'force-dynamic';

async function resolveBotToken(provided: string | undefined): Promise<string | null> {
  if (provided) return provided;
  const existing = await prisma.setting.findUnique({ where: { id: 'singleton' } });
  if (!existing?.telegramBotToken) return null;
  return decryptSecret(existing.telegramBotToken);
}

const testSchema = z.object({
  action: z.literal('test'),
  botToken: z.string().trim().optional(),
  chatId: z.string().trim().min(1, 'Enter a chat ID'),
});
const detectSchema = z.object({
  action: z.literal('detectChatId'),
  botToken: z.string().trim().optional(),
});
const bodySchema = z.discriminatedUnion('action', [testSchema, detectSchema]);

/**
 * POST /api/admin/settings/telegram
 * `action: 'test'` sends a real test message to verify the bot token + chat
 * ID both work, saving them (encrypted) on success. `action: 'detectChatId'`
 * scans recent bot updates for group chats it has seen, so the admin doesn't
 * have to look up the numeric chat ID by hand. In both cases `botToken` may
 * be omitted to reuse the already-saved token.
 */
export async function POST(request: Request) {
  try {
    const session = await requirePermission('settingsGeneral', 'edit');
    const data = bodySchema.parse(await request.json());

    let botToken: string | null;
    try {
      botToken = await resolveBotToken(data.botToken);
    } catch (e) {
      console.error('[settings/telegram] failed to decrypt saved bot token', e);
      return fail('Could not read the saved bot token — SETTINGS_ENCRYPTION_KEY may have changed since it was saved. Re-enter your bot token to reconnect.', 400);
    }
    if (!botToken) return fail('Enter your Telegram bot token.', 400);

    if (data.action === 'detectChatId') {
      let chats;
      try {
        chats = await detectTelegramChats(botToken);
      } catch (e) {
        return fail(e instanceof Error ? e.message : 'Could not reach Telegram.', 400);
      }
      if (chats.length === 0) {
        return fail('No chats found yet — add the bot to your staff group and send a message there, then try again.', 404);
      }
      return ok({ chats });
    }

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

/** DELETE /api/admin/settings/telegram — clears the stored bot token/chat ID. */
export async function DELETE() {
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
