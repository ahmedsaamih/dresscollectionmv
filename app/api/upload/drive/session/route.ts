import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { ok, fail, handleError } from '@/lib/http';
import { initiateDriveUpload } from '@/lib/google-drive';
import { rateLimitResponse } from '@/lib/rate-limit';

export const dynamic = 'force-dynamic';

const MAX_BYTES = 100 * 1024 * 1024;

const schema = z.object({
  filename: z.string().trim().min(1).max(180),
  mimeType: z.string().trim().max(120).optional().default('application/octet-stream'),
  size: z.coerce.number().int().positive().max(MAX_BYTES),
});

/**
 * POST /api/upload/drive/session
 *
 * Initiates a Google Drive resumable-upload session and returns the session
 * URI so the browser can PUT the file bytes straight to Google — the bytes
 * never touch our server. This replaces the old chunk-relay-through-local-disk
 * flow, which only worked in dev because Vercel's serverless functions don't
 * share a filesystem across invocations.
 */
export async function POST(request: Request) {
  try {
    const ipLimit = await rateLimitResponse(request, { scope: 'drive-upload:ip', limit: 20, windowMs: 60 * 60 * 1000 });
    if (ipLimit) return ipLimit;

    const settings = await prisma.setting.findUnique({ where: { id: 'singleton' } });
    if (!settings?.googleDriveUploadsEnabled) return fail('Google Drive uploads are disabled', 400);
    if (!settings.googleDriveFolderId) return fail('Google Drive folder is not configured', 400);
    if (!settings.googleDriveRefreshToken) return fail('Google Drive is not connected', 500);

    const data = schema.parse(await request.json());
    const byteLimit = await rateLimitResponse(request, {
      scope: 'drive-upload:bytes',
      limit: 200 * 1024 * 1024,
      windowMs: 60 * 60 * 1000,
      cost: data.size,
    });
    if (byteLimit) return byteLimit;

    const { uploadUrl } = await initiateDriveUpload({
      folderId: settings.googleDriveFolderId,
      filename: data.filename,
      mimeType: data.mimeType,
      size: data.size,
    });
    return ok({ uploadUrl });
  } catch (err) {
    return handleError(err);
  }
}
