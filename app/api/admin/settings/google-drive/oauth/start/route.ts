import { randomUUID } from 'node:crypto';
import { NextResponse } from 'next/server';
import { requirePermission } from '@/lib/admin-guard';
import { handleError } from '@/lib/http';
import { buildGoogleAuthUrl, OAUTH_STATE_COOKIE } from '@/lib/google-drive';

export const dynamic = 'force-dynamic';

/** GET /api/admin/settings/google-drive/oauth/start — redirects to Google's consent screen. */
export async function GET() {
  try {
    await requirePermission('settingsGeneral', 'edit');
    const state = randomUUID();
    const res = NextResponse.redirect(buildGoogleAuthUrl(state));
    res.cookies.set(OAUTH_STATE_COOKIE, state, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: 600,
    });
    return res;
  } catch (err) {
    return handleError(err);
  }
}
