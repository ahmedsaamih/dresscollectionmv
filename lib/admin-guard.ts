import { cookies } from 'next/headers';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { SESSION_COOKIE, verifySession, type SessionPayload, type AdminRole } from '@/lib/auth';
import { hasPermission, type ModuleKey } from '@/lib/permissions';

/**
 * Route-handler auth helpers (Node runtime). Middleware already blocks
 * unauthenticated requests to /api/admin/*; these add the actor identity for
 * audit logging and act as defense-in-depth.
 */

export async function getAdminSession(): Promise<SessionPayload | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  return verifySession(token);
}

/** Thrown when a handler is hit without a valid admin session. */
export class UnauthorizedError extends Error {
  constructor() {
    super('Unauthorized');
    this.name = 'UnauthorizedError';
  }
}

export async function requireAdmin(): Promise<SessionPayload> {
  const session = await getAdminSession();
  if (!session) throw new UnauthorizedError();
  return session;
}

/** Thrown when the session role doesn't have permission. */
export class ForbiddenError extends Error {
  constructor() { super('Forbidden'); this.name = 'ForbiddenError'; }
}

/** Require the session to be one of the specified roles (admin always passes). */
export async function requireRole(roles: AdminRole[]): Promise<SessionPayload> {
  const session = await requireAdmin();
  if (!roles.includes(session.role)) throw new ForbiddenError();
  return session;
}

/** Require the session to be an admin (most-privileged role). */
export async function requireSuperAdmin(): Promise<SessionPayload> {
  return requireRole(['admin']);
}

/** Require at least `need` access to `module` (admin always passes). */
export async function requirePermission(module: ModuleKey, need: 'read' | 'edit'): Promise<SessionPayload> {
  const session = await requireAdmin();
  if (!hasPermission(session, module, need)) throw new ForbiddenError();
  return session;
}

/** Best-effort audit trail; never blocks the mutation. */
export async function audit(actor: string, action: string, target?: string, meta?: Record<string, unknown>) {
  try {
    await prisma.auditLog.create({
      data: { actor, action, target: target ?? null, meta: (meta ?? undefined) as Prisma.InputJsonValue | undefined },
    });
  } catch (e) {
    console.error('audit log failed', e);
  }
}

/** Short, readable id for newly created catalog rows (matches seed style). */
export function genId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;
}
