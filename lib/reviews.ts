import crypto from 'crypto';
import { prisma } from '@/lib/prisma';
import { notifier } from '@/lib/notify';

const APP_URL = process.env.APP_URL || 'http://localhost:3000';
const REVIEW_TOKEN_TTL_MS = 3 * 24 * 60 * 60 * 1000; // 3 days

/**
 * Creates a review request (token + 3-day expiry) for a completed order and
 * notifies the customer (email and/or SMS, per Admin → Settings → Notification
 * preferences) with a link to leave a review. No-op if the order has no email
 * on file, or a review row already exists for it (idempotent — this can be
 * called from more than one completion trigger, or stage can be toggled back
 * to Completed more than once).
 */
export async function requestReview(
  order: { id: string; email: string; customer: string; mobile: string | null },
  ctx: { smsAllowed: boolean },
): Promise<void> {
  if (!order.email) return;

  const existing = await prisma.review.findUnique({ where: { orderId: order.id } });
  if (existing) return;

  const token = crypto.randomBytes(32).toString('hex');
  const tokenExpiresAt = new Date(Date.now() + REVIEW_TOKEN_TTL_MS);

  await prisma.review.create({
    data: { orderId: order.id, token, tokenExpiresAt },
  });

  await notifier.reviewRequested({
    ref: order.id,
    email: order.email,
    name: order.customer,
    mobile: order.mobile,
    smsAllowed: ctx.smsAllowed,
    reviewUrl: `${APP_URL}/review?token=${token}`,
  });
}
