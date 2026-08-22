import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { requirePermission } from '@/lib/admin-guard';
import { ok, fail, handleError } from '@/lib/http';
import { decryptSecret } from '@/lib/crypto';
import { detectTelegramChats } from '@/lib/telegram';

export const dynamic = 'force-dynamic';

const bodySchema = z.object({ botToken: z.string().trim().optional() });

/**
 * POST /api/admin/settings/telegram/detect-chat-id
 * Scans recent bot updates for group chats it has seen, so the admin doesn't
 * have to look up the numeric chat ID by hand. `botToken` may be omitted to
 * reuse the already-saved token.
 */
export async function POST(request: Request) {
  try {
    await requirePermission('settingsGeneral', 'edit');
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
    if (!botToken) return fail('Enter your Telegram bot token first.', 400);

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
  } catch (err) {
    return handleError(err);
  }
}
