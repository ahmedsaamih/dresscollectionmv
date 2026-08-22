import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requirePermission, audit } from '@/lib/admin-guard';
import { exchangeGoogleAuthCode, OAUTH_STATE_COOKIE } from '@/lib/google-drive';
import { encryptSecret } from '@/lib/crypto';

export const dynamic = 'force-dynamic';

function redirectToAdmin(request: Request, params: Record<string, string>) {
  const url = new URL('/admin', request.url);
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
  const res = NextResponse.redirect(url);
  res.cookies.delete(OAUTH_STATE_COOKIE);
  return res;
}

/** GET /api/admin/settings/google-drive/oauth/callback — completes the Google consent flow. */
export async function GET(request: Request) {
  const session = await requirePermission('settingsGeneral', 'edit').catch(() => null);
  if (!session) return redirectToAdmin(request, { gdrive: 'error', gdriveMessage: 'Your admin session expired — sign in and try again.' });

  const url = new URL(request.url);
  const error = url.searchParams.get('error');
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const expectedState = (await cookies()).get(OAUTH_STATE_COOKIE)?.value;

  if (error) return redirectToAdmin(request, { gdrive: 'error', gdriveMessage: `Google Drive connection was cancelled (${error}).` });
  if (!state || !expectedState || state !== expectedState) {
    return redirectToAdmin(request, { gdrive: 'error', gdriveMessage: 'Could not verify the Google Drive connection request. Try again.' });
  }
  if (!code) return redirectToAdmin(request, { gdrive: 'error', gdriveMessage: 'Google did not return an authorization code.' });

  try {
    const { refreshToken, email } = await exchangeGoogleAuthCode(code);
    await prisma.setting.update({
      where: { id: 'singleton' },
      data: { googleDriveRefreshToken: encryptSecret(refreshToken), googleDriveConnectedEmail: email },
    });
    await audit(session.email, 'settings.google_drive.connect', 'singleton', { connectedEmail: email });
    return redirectToAdmin(request, { gdrive: 'connected' });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Could not connect Google Drive.';
    return redirectToAdmin(request, { gdrive: 'error', gdriveMessage: message });
  }
}
