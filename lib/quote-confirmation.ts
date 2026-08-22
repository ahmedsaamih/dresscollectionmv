import crypto from 'crypto';
import { prisma } from '@/lib/prisma';
import { notifier } from '@/lib/notify';

const APP_URL = process.env.APP_URL || 'http://localhost:3000';
const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Sends (or resends) a priced quote's confirm/reject link to the customer —
 * a fresh token + admin-chosen 1/2/3-day expiry, resetting any prior decision
 * back to pending so a resend can reopen a declined quote. Mirrors the
 * review-token pattern in lib/reviews.ts, but the TTL is per-send here
 * (admin-chosen) rather than a fixed constant.
 */
export async function sendQuoteForConfirmation(
  quote: { id: string; email: string; customer: string; mobile: string | null; price: number },
  ttlDays: 1 | 2 | 3,
  ctx: { smsAllowed: boolean }
): Promise<void> {
  const token = crypto.randomBytes(32).toString('hex');
  const confirmationTokenExpiresAt = new Date(Date.now() + ttlDays * DAY_MS);

  await prisma.quote.update({
    where: { id: quote.id },
    data: {
      confirmationToken: token,
      confirmationTokenExpiresAt,
      sentForConfirmationAt: new Date(),
      customerDecision: 'pending',
      respondedAt: null,
    },
  });

  await notifier.quoteConfirmationRequested({
    ref: quote.id,
    email: quote.email,
    name: quote.customer,
    price: quote.price,
    mobile: quote.mobile,
    smsAllowed: ctx.smsAllowed,
    confirmUrl: `${APP_URL}/quote/confirm?token=${token}`,
    ttlDays,
  });
}
