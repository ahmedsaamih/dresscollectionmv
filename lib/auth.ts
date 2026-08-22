import { SignJWT, jwtVerify } from 'jose';
import type { Permissions } from '@/lib/permissions';

/**
 * Stateless admin session — a signed JWT in an httpOnly cookie.
 * This module is edge-safe (pure `jose`, no `next/headers`/Prisma) so it can be
 * imported from middleware. Cookie + DB helpers for route handlers live in
 * lib/admin-guard.ts (Node runtime only).
 */

const DEV_SECRET = 'dev-only-insecure-secret-change-me';
const ALG = 'HS256';

function sessionSecret() {
  const rawSecret = process.env.JWT_SECRET || DEV_SECRET;
  if (process.env.NODE_ENV === 'production' && rawSecret === DEV_SECRET) {
    throw new Error('JWT_SECRET must be set to a strong production value.');
  }
  return new TextEncoder().encode(rawSecret);
}

export const SESSION_COOKIE = 'mm_admin';
export const SESSION_MAX_AGE = 60 * 60 * 8; // 8 hours

export type AdminRole = 'admin' | 'staff';

const VALID_ROLES: Set<string> = new Set(['admin', 'staff']);

export interface SessionPayload {
  email: string;
  role: AdminRole;
  // Ignored for role: 'admin' (always full access). Not live-updated within
  // an existing session — same staleness model as `role` already had: a
  // permission change takes effect on the user's next login.
  permissions: Permissions;
}

export async function signSession(payload: SessionPayload): Promise<string> {
  return new SignJWT({ email: payload.email, role: payload.role, permissions: payload.permissions })
    .setProtectedHeader({ alg: ALG })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_MAX_AGE}s`)
    .sign(sessionSecret());
}

export async function verifySession(token: string | undefined | null): Promise<SessionPayload | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, sessionSecret(), { algorithms: [ALG] });
    if (!VALID_ROLES.has(payload.role as string) || typeof payload.email !== 'string') return null;
    const permissions = (payload.permissions && typeof payload.permissions === 'object') ? payload.permissions as Permissions : {};
    return { email: payload.email, role: payload.role as AdminRole, permissions };
  } catch {
    return null;
  }
}
