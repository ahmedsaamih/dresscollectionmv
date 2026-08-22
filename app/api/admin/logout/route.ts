import { SESSION_COOKIE } from '@/lib/auth';
import { ok } from '@/lib/http';

export const dynamic = 'force-dynamic';

/** POST /api/admin/logout — clears the session cookie. */
export async function POST() {
  const res = ok({ ok: true });
  res.cookies.set(SESSION_COOKIE, '', {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 0,
  });
  return res;
}
