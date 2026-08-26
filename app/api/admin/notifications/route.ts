import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { requirePermission } from '@/lib/admin-guard';
import { ok, handleError } from '@/lib/http';
import { decryptSecret } from '@/lib/crypto';

export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/notifications — recent email/SMS delivery log, newest first
 * (read-only). Optional query params narrow the result: orderRef (partial,
 * case-insensitive), event, channel, status.
 */
export async function GET(request: Request) {
  try {
    await requirePermission('customers', 'read');
    const params = new URL(request.url).searchParams;
    const orderRef = params.get('orderRef');
    const event = params.get('event');
    const channel = params.get('channel');
    const status = params.get('status');
    const where: Prisma.NotificationLogWhereInput = {
      ...(orderRef ? { orderRef: { contains: orderRef, mode: 'insensitive' } } : {}),
      ...(event ? { event } : {}),
      ...(channel ? { channel } : {}),
      ...(status ? { status } : {}),
    };
    const logs = await prisma.notificationLog.findMany({ where, orderBy: { createdAt: 'desc' }, take: 200 });
    return ok({ logs, total: logs.length });
  } catch (err) {
    return handleError(err);
  }
}

const SMS_DELIVERED = new Set([1, 7]); // Delivered, Delivered (Duplicate)
const SMS_FAILED = new Set([6, 8]); // Failed, Scam

// Resend's Retrieve Email API reports a `last_event` string per email
// (https://resend.com/docs/api-reference/emails/retrieve-email). "delivered"/
// "opened"/"clicked" mean it reached the recipient's mailbox; "sent"/
// "queued"/"scheduled"/"delivery_delayed" are still in flight (left
// untouched); anything else is a hard failure/rejection.
const EMAIL_DELIVERED = new Set(['delivered', 'opened', 'clicked']);
const EMAIL_FAILED = new Set(['bounced', 'complained', 'failed', 'canceled', 'suppressed']);

async function refreshSms(): Promise<{ checked: number; updated: number }> {
  const setting = await prisma.setting.findUnique({ where: { id: 'singleton' } });
  const key = setting?.msgowlApiKey ? decryptSecret(setting.msgowlApiKey) : process.env.MSGOWL_API_KEY;
  if (!key) return { checked: 0, updated: 0 };

  const pending = await prisma.notificationLog.findMany({
    where: { channel: 'sms', status: 'sent', providerMessageId: { not: null } },
    orderBy: { createdAt: 'asc' },
    take: 20,
  });

  let checked = 0;
  let updated = 0;
  for (const log of pending) {
    checked++;
    try {
      const res = await fetch(`https://rest.msgowl.com/messages/${log.providerMessageId}`, {
        headers: { Authorization: `AccessKey ${key}` },
      });
      if (res.status === 429) break;
      if (!res.ok) continue;

      const json = await res.json() as { recipients?: { delivery_status?: number; delivered_on?: string }[] };
      const status = json.recipients?.[0]?.delivery_status;
      if (status === undefined) continue;

      if (SMS_DELIVERED.has(status)) {
        await prisma.notificationLog.update({
          where: { id: log.id },
          data: { status: 'delivered', deliveredAt: json.recipients?.[0]?.delivered_on ? new Date(json.recipients[0].delivered_on!) : new Date() },
        });
        updated++;
      } else if (SMS_FAILED.has(status)) {
        await prisma.notificationLog.update({ where: { id: log.id }, data: { status: 'failed' } });
        updated++;
      }
    } catch (e) {
      console.error(`[notifications] sms status check failed for ${log.id}`, e);
    }
  }
  return { checked, updated };
}

async function refreshEmail(): Promise<{ checked: number; updated: number }> {
  const setting = await prisma.setting.findUnique({ where: { id: 'singleton' } });
  const key = setting?.emailApiKey ? decryptSecret(setting.emailApiKey) : process.env.RESEND_API_KEY;
  if (!key) return { checked: 0, updated: 0 };

  const pending = await prisma.notificationLog.findMany({
    where: { channel: 'email', status: 'sent', providerMessageId: { not: null } },
    orderBy: { createdAt: 'asc' },
    take: 20,
  });

  let checked = 0;
  let updated = 0;
  for (const log of pending) {
    checked++;
    try {
      const res = await fetch(`https://api.resend.com/emails/${log.providerMessageId}`, {
        headers: { Authorization: `Bearer ${key}` },
      });
      if (res.status === 429) break;
      if (!res.ok) continue;

      const json = await res.json() as { last_event?: string };
      const status = json.last_event?.toLowerCase();
      if (!status) continue;

      if (EMAIL_DELIVERED.has(status)) {
        await prisma.notificationLog.update({
          where: { id: log.id },
          data: { status: 'delivered', deliveredAt: new Date() },
        });
        updated++;
      } else if (EMAIL_FAILED.has(status)) {
        await prisma.notificationLog.update({ where: { id: log.id }, data: { status: 'failed' } });
        updated++;
      }
    } catch (e) {
      console.error(`[notifications] email status check failed for ${log.id}`, e);
    }
  }
  return { checked, updated };
}

/**
 * POST /api/admin/notifications
 *
 * Neither provider pushes delivery status to us, so this polls both APIs for
 * rows still marked "sent" and updates them to delivered/failed. Sequential
 * (not parallel) per channel to stay well under each provider's rate limit;
 * stops early on a 429. Missing credentials for a channel are treated as
 * "nothing to check" for that channel rather than a hard error, so refreshing
 * still works when only one of the two is configured.
 */
export async function POST() {
  try {
    await requirePermission('customers', 'edit');

    const [sms, email] = await Promise.all([refreshSms(), refreshEmail()]);

    return ok({
      checked: sms.checked + email.checked,
      updated: sms.updated + email.updated,
      sms,
      email,
    });
  } catch (err) {
    return handleError(err);
  }
}
