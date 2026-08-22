import { checkRateLimit } from '@/lib/rate-limit';

const digits = (s: string) => s.replace(/\D/g, '');

/**
 * Gate for whether an order-placed SMS should be attempted at all. Never
 * blocks the order itself — callers only use the result to decide whether to
 * dispatch. Three independent, IP-independent budgets:
 *
 *  - per-phone: stops repeated harassment of one fixed number even if the
 *    attacker rotates email/IP per order.
 *  - global per-minute: keeps us comfortably under MsgOwl's own account cap
 *    (50 POST/60s).
 *  - global per-day: the real backstop — an attacker submitting many orders
 *    with many *different* phone numbers can't be stopped by the per-phone
 *    bucket, only by a shared daily budget.
 *
 * All three are always checked (no short-circuit) so exhaustion is visible
 * in whichever bucket trips first.
 */
export async function canSendSms(request: Request, mobile: string | null | undefined): Promise<boolean> {
  const phone = digits(mobile ?? '');
  if (!phone) return false;

  const phoneLimit = await checkRateLimit(request, {
    scope: 'sms:phone',
    perIp: false,
    identifiers: [phone],
    limit: Number(process.env.SMS_PER_PHONE_DAILY_LIMIT ?? 3),
    windowMs: 24 * 60 * 60 * 1000,
  });

  const minuteLimit = await checkRateLimit(request, {
    scope: 'sms:global:minute',
    perIp: false,
    limit: Number(process.env.SMS_RATE_LIMIT_PER_MIN ?? 10),
    windowMs: 60 * 1000,
  });

  const dailyLimit = await checkRateLimit(request, {
    scope: 'sms:global:daily',
    perIp: false,
    limit: Number(process.env.SMS_DAILY_LIMIT ?? 60),
    windowMs: 24 * 60 * 60 * 1000,
  });

  const allowed = phoneLimit.allowed && minuteLimit.allowed && dailyLimit.allowed;
  if (!allowed) {
    console.warn('[notify:sms] send skipped by rate limit', {
      phone: phoneLimit.allowed, minute: minuteLimit.allowed, daily: dailyLimit.allowed,
    });
  }
  return allowed;
}
