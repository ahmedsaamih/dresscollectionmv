import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { requirePermission, audit } from '@/lib/admin-guard';
import { ok, fail, handleError } from '@/lib/http';
import { encryptSecret, decryptSecret } from '@/lib/crypto';
import { ResendEmailProvider } from '@/lib/notify/providers';
import { rateLimitResponse } from '@/lib/rate-limit';

export const dynamic = 'force-dynamic';

const bodySchema = z.object({
  apiKey: z.string().trim().optional(),
  emailFromUser: z.string().trim().min(1, 'Enter a "send from" username')
    .regex(/^[a-zA-Z0-9._%+-]+$/, 'Use letters, numbers, dots, underscores, %, + or - only'),
  emailFromName: z.string().trim().optional(),
  testRecipient: z.string().trim().email('Enter a valid email address'),
});

/**
 * POST /api/admin/settings/email/test
 * Sends a real test email to verify the Resend API key works, saving it
 * (encrypted) on success. `apiKey` may be omitted to re-test with a newly
 * edited "from" name/user against the already-saved key.
 */
export async function POST(request: Request) {
  try {
    const session = await requirePermission('settingsGeneral', 'edit');
    const limited = await rateLimitResponse(request, { scope: 'settings:email:test', limit: 5, windowMs: 60 * 60 * 1000, identifiers: [session.email], perIp: false });
    if (limited) return limited;
    const data = bodySchema.parse(await request.json());

    const existing = await prisma.setting.findUnique({ where: { id: 'singleton' } });
    let apiKey = data.apiKey || '';
    if (!apiKey && existing?.emailApiKey) {
      try {
        apiKey = decryptSecret(existing.emailApiKey);
      } catch (e) {
        console.error('[settings/email] failed to decrypt saved Resend key', e);
        return fail('Could not read the saved Resend key — SETTINGS_ENCRYPTION_KEY may have changed since it was saved. Re-enter your Resend key to reconnect.', 400);
      }
    }
    if (!apiKey) return fail('Enter your Resend API key.', 400);

    const domain = process.env.EMAIL_SENDING_DOMAIN;
    if (!domain) return fail('EMAIL_SENDING_DOMAIN is not configured on the server — set it in Vercel env vars first.', 500);

    const from = `${data.emailFromUser}@${domain}`;
    const provider = new ResendEmailProvider(apiKey, from, data.emailFromName || undefined);

    try {
      await provider.send({
        to: data.testRecipient,
        subject: 'Dress Collection — test email',
        html: `<p>This is a test email from Dress Collection admin settings.</p><p>If you can read this, Resend is connected and sending as <strong>${from}</strong>.</p>`,
        text: `This is a test email from Dress Collection admin settings. If you can read this, Resend is connected and sending as ${from}.`,
      });
    } catch (e) {
      return fail(e instanceof Error ? e.message : 'Could not send a test email via Resend.', 400);
    }

    let encryptedKey: string;
    try {
      encryptedKey = encryptSecret(apiKey);
    } catch (e) {
      console.error('[settings/email] failed to encrypt Resend key for storage', e);
      return fail('Resend connected, but the server could not save the key — SETTINGS_ENCRYPTION_KEY is not configured. Contact an administrator.', 500);
    }

    const updated = await prisma.setting.update({
      where: { id: 'singleton' },
      data: {
        emailApiKey: encryptedKey,
        emailFromUser: data.emailFromUser,
        emailFromName: data.emailFromName ?? existing?.emailFromName ?? '',
        emailLastTestAt: new Date(),
      },
    });
    await audit(session.email, 'settings.email.test', 'singleton', { testRecipient: data.testRecipient });
    return ok({
      emailFromUser: updated.emailFromUser,
      emailFromName: updated.emailFromName,
      lastTestAt: updated.emailLastTestAt?.toISOString() ?? null,
      enabled: updated.emailAlertsEnabled,
    });
  } catch (err) {
    return handleError(err);
  }
}
