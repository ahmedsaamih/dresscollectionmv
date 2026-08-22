import crypto from 'crypto';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export interface RateLimitRule {
  scope: string;
  limit: number;
  windowMs: number;
  cost?: number;
  identifiers?: Array<string | null | undefined>;
  /** Set false for a bucket that must be IP-independent (e.g. an account-wide
   * or phone-only budget an attacker could otherwise bypass by rotating IPs).
   * Defaults to true, preserving every existing call site's bucket keys. */
  perIp?: boolean;
}

function clientIp(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim();
  return forwarded || request.headers.get('x-real-ip') || 'unknown';
}

function bucketKey(parts: string[]): string {
  return crypto.createHash('sha256').update(parts.join(':')).digest('hex');
}

export async function checkRateLimit(request: Request, rule: RateLimitRule) {
  const now = new Date();
  const cost = Math.max(1, Math.floor(rule.cost ?? 1));
  const identity = [
    ...(rule.perIp === false ? [] : [clientIp(request)]),
    ...(rule.identifiers ?? []).filter(Boolean).map(String),
  ];
  const key = bucketKey([rule.scope, ...identity]);
  const resetAt = new Date(now.getTime() + rule.windowMs);

  const existing = await prisma.rateLimitBucket.findUnique({ where: { key } });
  if (!existing || existing.resetAt <= now) {
    const bucket = await prisma.rateLimitBucket.upsert({
      where: { key },
      create: { key, count: cost, resetAt },
      update: { count: cost, resetAt },
    });
    return { allowed: true, remaining: Math.max(rule.limit - bucket.count, 0), resetAt: bucket.resetAt, retryAfter: 0 };
  }

  const bucket = await prisma.rateLimitBucket.update({
    where: { key },
    data: { count: { increment: cost } },
  });
  const retryAfter = Math.max(1, Math.ceil((bucket.resetAt.getTime() - now.getTime()) / 1000));
  return {
    allowed: bucket.count <= rule.limit,
    remaining: Math.max(rule.limit - bucket.count, 0),
    resetAt: bucket.resetAt,
    retryAfter,
  };
}

export async function rateLimitResponse(request: Request, rule: RateLimitRule): Promise<NextResponse | null> {
  const result = await checkRateLimit(request, rule);
  if (result.allowed) return null;
  return NextResponse.json(
    { error: 'Too many requests. Try again later.' },
    { status: 429, headers: { 'Retry-After': String(result.retryAfter) } }
  );
}
