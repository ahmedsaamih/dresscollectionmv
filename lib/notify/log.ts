import { prisma } from '@/lib/prisma';

interface LogNotificationInput {
  channel: 'email' | 'sms' | 'telegram';
  event: string;
  orderRef?: string;
  recipient: string;
  provider: string;
  providerMessageId?: string;
  status: 'sent' | 'failed' | 'skipped';
  error?: string;
}

/** Best-effort delivery log write; never blocks the send path it records. */
export async function logNotification(input: LogNotificationInput): Promise<void> {
  try {
    await prisma.notificationLog.create({
      data: {
        channel: input.channel,
        event: input.event,
        orderRef: input.orderRef ?? null,
        recipient: input.recipient,
        provider: input.provider,
        providerMessageId: input.providerMessageId ?? null,
        status: input.status,
        error: input.error ?? null,
      },
    });
  } catch (e) {
    console.error('notification log write failed', e);
  }
}
