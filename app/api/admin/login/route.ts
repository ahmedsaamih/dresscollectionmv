import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { signSession, SESSION_COOKIE, SESSION_MAX_AGE, type AdminRole } from '@/lib/auth';
import type { Permissions } from '@/lib/permissions';
import { ok, fail, handleError } from '@/lib/http';
import { rateLimitResponse } from '@/lib/rate-limit';

export const dynamic = 'force-dynamic';

const loginSchema = z.object({
  email: z.string().trim().min(1),
  password: z.string().min(1),
});

/**
 * POST /api/admin/login
 * Verifies credentials against AdminUser and sets the session cookie.
 * Always returns the same generic error on bad email OR password.
 */
export async function POST(request: Request) {
  try {
    const ipLimit = await rateLimitResponse(request, { scope: 'admin-login:ip', limit: 5, windowMs: 15 * 60 * 1000 });
    if (ipLimit) return ipLimit;

    const { email, password } = loginSchema.parse(await request.json());
    const emailLimit = await rateLimitResponse(request, {
      scope: 'admin-login:email',
      limit: 5,
      windowMs: 15 * 60 * 1000,
      identifiers: [email.toLowerCase()],
    });
    if (emailLimit) return emailLimit;

    const user = await prisma.adminUser.findUnique({ where: { email: email.toLowerCase() } });
    const valid = user ? await bcrypt.compare(password, user.passwordHash) : false;
    if (!user || !valid) return fail('Invalid email or password', 401);

    const token = await signSession({
      email: user.email,
      role: (user.role as AdminRole) ?? 'admin',
      permissions: (user.permissions as Permissions) ?? {},
    });
    const res = ok({ email: user.email });
    res.cookies.set(SESSION_COOKIE, token, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: SESSION_MAX_AGE,
    });
    return res;
  } catch (err) {
    return handleError(err);
  }
}
