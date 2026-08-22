import { prisma } from '@/lib/prisma';
import { decryptSecret } from '@/lib/crypto';

const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const DRIVE_UPLOAD_URL = 'https://www.googleapis.com/upload/drive/v3/files';
const DRIVE_FILES_URL = 'https://www.googleapis.com/drive/v3/files';
// Service accounts have no storage quota and can't create files in a
// personal (non-Workspace) Drive folder even when it's shared with them —
// Google requires OAuth delegation to a real user's own storage instead.
const DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive';

export const OAUTH_STATE_COOKIE = 'mm_gdrive_oauth_state';

let cachedToken: { token: string; expiresAt: number } | null = null;

export interface DriveFileRef {
  provider: 'google_drive';
  fileId: string;
  name: string;
  mimeType: string;
  size: number;
  url: string;
  webViewLink?: string;
  webContentLink?: string;
}

function oauthClientConfig() {
  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID || '';
  const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET || '';
  if (!clientId || !clientSecret) throw new Error('Google OAuth client is not configured.');
  return { clientId, clientSecret };
}

function oauthRedirectUri(): string {
  const appUrl = (process.env.APP_URL || 'http://localhost:3000').replace(/\/$/, '');
  return `${appUrl}/api/admin/settings/google-drive/oauth/callback`;
}

/** Build the Google consent-screen URL that starts the OAuth delegation flow. */
export function buildGoogleAuthUrl(state: string): string {
  const { clientId } = oauthClientConfig();
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: oauthRedirectUri(),
    response_type: 'code',
    scope: DRIVE_SCOPE,
    access_type: 'offline',
    prompt: 'consent',
    state,
  });
  return `${AUTH_URL}?${params.toString()}`;
}

/** Exchange an OAuth authorization code for a refresh token + the connected account's email. */
export async function exchangeGoogleAuthCode(code: string): Promise<{ refreshToken: string; email: string }> {
  const { clientId, clientSecret } = oauthClientConfig();
  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: oauthRedirectUri(),
    }),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || !json.access_token) throw new Error(json.error_description || json.error || 'Could not authenticate with Google.');
  if (!json.refresh_token) throw new Error('Google did not return a refresh token — try disconnecting and reconnecting.');
  const aboutRes = await fetch('https://www.googleapis.com/drive/v3/about?fields=user', {
    headers: { Authorization: `Bearer ${json.access_token}` },
  });
  const about = await aboutRes.json().catch(() => ({}));
  if (!aboutRes.ok) throw new Error(about.error?.message || 'Could not read the connected Google account.');
  return { refreshToken: json.refresh_token, email: about.user?.emailAddress || '' };
}

export function normalizeDriveFolderId(input: string): string {
  const value = input.trim();
  if (!value) return '';
  const folderMatch = value.match(/\/folders\/([a-zA-Z0-9_-]+)/);
  if (folderMatch) return folderMatch[1];
  const idParam = value.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  if (idParam) return idParam[1];
  return value.replace(/^https?:\/\/drive\.google\.com\/.*$/i, '').trim() || value;
}

async function accessToken(): Promise<string> {
  if (cachedToken && cachedToken.expiresAt > Date.now() + 60000) return cachedToken.token;
  const setting = await prisma.setting.findUnique({ where: { id: 'singleton' } });
  if (!setting?.googleDriveRefreshToken) throw new Error('Google Drive is not connected. Connect it in Admin → Settings.');
  const refreshToken = decryptSecret(setting.googleDriveRefreshToken);
  const { clientId, clientSecret } = oauthClientConfig();
  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      client_id: clientId,
      client_secret: clientSecret,
    }),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || !json.access_token) throw new Error(json.error_description || json.error || 'Could not authenticate with Google Drive.');
  cachedToken = { token: json.access_token, expiresAt: Date.now() + Number(json.expires_in || 3600) * 1000 };
  return cachedToken.token;
}

async function driveFetch(url: string, init: RequestInit = {}) {
  const token = await accessToken();
  return fetch(url, {
    ...init,
    headers: {
      ...(init.headers || {}),
      Authorization: `Bearer ${token}`,
    },
  });
}

export async function getDriveFolder(folderId: string): Promise<{ id: string; name: string }> {
  const id = normalizeDriveFolderId(folderId);
  if (!id) throw new Error('Google Drive folder ID is required.');
  const url = `${DRIVE_FILES_URL}/${encodeURIComponent(id)}?supportsAllDrives=true&fields=id,name,mimeType`;
  const res = await driveFetch(url);
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error?.message || 'Could not access Google Drive folder.');
  if (json.mimeType !== 'application/vnd.google-apps.folder') throw new Error('The configured Google Drive ID is not a folder.');
  return { id: json.id, name: json.name || json.id };
}

/**
 * Starts a Google Drive resumable-upload session and returns the session URI
 * Google hands back in the `Location` header. That URI is itself the upload
 * credential from this point on (Google's resumable-upload protocol) — the
 * caller can PUT the file bytes straight to it without ever needing our
 * OAuth access token, which is what lets the browser upload design files
 * directly to Drive instead of relaying them through our server.
 */
export async function initiateDriveUpload(opts: {
  folderId: string;
  filename: string;
  mimeType: string;
  size: number;
}): Promise<{ uploadUrl: string }> {
  const folderId = normalizeDriveFolderId(opts.folderId);
  if (!folderId) throw new Error('Google Drive folder ID is required.');
  const metadata = { name: opts.filename || 'upload', parents: [folderId] };
  const start = await driveFetch(`${DRIVE_UPLOAD_URL}?uploadType=resumable&supportsAllDrives=true&fields=id,name,mimeType,size,webViewLink,webContentLink`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json; charset=UTF-8',
      'X-Upload-Content-Type': opts.mimeType,
      'X-Upload-Content-Length': String(opts.size),
    },
    body: JSON.stringify(metadata),
  });
  if (!start.ok) {
    const json = await start.json().catch(() => ({}));
    throw new Error(json.error?.message || 'Could not create Google Drive upload session.');
  }
  const uploadUrl = start.headers.get('location');
  if (!uploadUrl) throw new Error('Google Drive did not return an upload session.');
  return { uploadUrl };
}

/** Server-side full upload (initiate + PUT the bytes ourselves) — used for the admin "Test folder" check. */
export async function uploadDriveFile(opts: {
  folderId: string;
  filename: string;
  mimeType: string;
  data: Buffer;
}): Promise<DriveFileRef> {
  const { uploadUrl } = await initiateDriveUpload({
    folderId: opts.folderId,
    filename: opts.filename,
    mimeType: opts.mimeType,
    size: opts.data.length,
  });
  const finish = await fetch(uploadUrl, {
    method: 'PUT',
    headers: {
      'Content-Type': opts.mimeType,
      'Content-Length': String(opts.data.length),
    },
    body: new Uint8Array(opts.data),
  });
  const file = await finish.json().catch(() => ({}));
  if (!finish.ok) throw new Error(file.error?.message || 'Could not upload file to Google Drive.');
  const url = file.webViewLink || `https://drive.google.com/file/d/${file.id}/view`;
  return {
    provider: 'google_drive',
    fileId: file.id,
    name: file.name || opts.filename,
    mimeType: file.mimeType || opts.mimeType,
    size: Number(file.size || opts.data.length),
    url,
    webViewLink: file.webViewLink,
    webContentLink: file.webContentLink,
  };
}

async function deleteDriveFile(fileId: string): Promise<void> {
  if (!fileId) return;
  await driveFetch(`${DRIVE_FILES_URL}/${encodeURIComponent(fileId)}?supportsAllDrives=true`, { method: 'DELETE' });
}

export async function testDriveFolder(folderId: string): Promise<{ id: string; name: string }> {
  const folder = await getDriveFolder(folderId);
  const file = await uploadDriveFile({
    folderId: folder.id,
    filename: `many-maldives-drive-test-${Date.now()}.txt`,
    mimeType: 'text/plain',
    data: Buffer.from('Dress Collection Google Drive upload test'),
  });
  await deleteDriveFile(file.fileId);
  return folder;
}
