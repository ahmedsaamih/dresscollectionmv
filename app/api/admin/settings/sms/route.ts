import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { requirePermission, audit } from '@/lib/admin-guard';
import { ok, fail, handleError } from '@/lib/http';
import { encryptSecret, decryptSecret } from '@/lib/crypto';
import { MsgOwlSmsProvider } from '@/lib/notify/providers';
import { rateLimitResponse } from '@/lib/rate-limit';
import { requiredMobile } from '@/lib/validation';

export const dynamic = 'force-dynamic';

const bodySchema = z.object({
  apiKey: z.string().trim().optional(),
  senderId: z.string().trim().min(1, 'Enter a sender ID'),
  testRecipient: requiredMobile,
});

/**
 * POST /api/admin/settings/sms
 * Sends a real test SMS via MsgOwl to verify the API key + sender ID work,
 * saving them (key encrypted) on success. `apiKey` may be omitted to re-test
 * a new sender ID against the already-saved key.
 */
export async function POST(request: Request) {
  try {
    const session = await requirePermission('settingsGeneral', 'edit');
    const limited = await rateLimitResponse(request, { scope: 'settings:sms:test', limit: 5, windowMs: 60 * 60 * 1000, identifiers: [session.email], perIp: false });
    if (limited) return limited;
    const data = bodySchema.parse(await request.json());

    const existing = await prisma.setting.findUnique({ where: { id: 'singleton' } });
    let apiKey = data.apiKey || '';
    if (!apiKey && existing?.msgowlApiKey) {
      try {
        apiKey = decryptSecret(existing.msgowlApiKey);
      } catch (e) {
        console.error('[settings/sms] failed to decrypt saved MsgOwl key', e);
        return fail('Could not read the saved MsgOwl key — SETTINGS_ENCRYPTION_KEY may have changed since it was saved. Re-enter your API key to reconnect.', 400);
      }
    }
    if (!apiKey) return fail('Enter your MsgOwl API key.', 400);

    const provider = new MsgOwlSmsProvider(apiKey, data.senderId);
    try {
      await provider.send({ to: data.testRecipient, text: 'Dress Collection: test SMS. If you can read this, MsgOwl is connected.' });
    } catch (e) {
      return fail(e instanceof Error ? e.message : 'Could not send a test SMS via MsgOwl.', 400);
    }

    let encryptedKey: string;
    try {
      encryptedKey = encryptSecret(apiKey);
    } catch (e) {
      console.error('[settings/sms] failed to encrypt MsgOwl key for storage', e);
      return fail('MsgOwl connected, but the server could not save the key — SETTINGS_ENCRYPTION_KEY is not configured. Contact an administrator.', 500);
    }

    const updated = await prisma.setting.update({
      where: { id: 'singleton' },
      data: {
        msgowlApiKey: encryptedKey,
        msgowlSenderId: data.senderId,
        smsLastTestAt: new Date(),
      },
    });
    await audit(session.email, 'settings.sms.test', 'singleton', { testRecipient: data.testRecipient });
    return ok({
      senderId: updated.msgowlSenderId,
      lastTestAt: updated.smsLastTestAt?.toISOString() ?? null,
      enabled: updated.smsAlertsEnabled,
    });
  } catch (err) {
    return handleError(err);
  }
}

/**
 * DELETE /api/admin/settings/sms — clears the stored MsgOwl key.
 * Leaves msgowlSenderId intact since it isn't a secret and is annoying to
 * retype if the admin reconnects shortly after.
 */
export async function DELETE() {
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
