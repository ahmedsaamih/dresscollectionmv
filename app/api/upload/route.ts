import convertHeic from 'heic-convert';
import { storage, type Bucket } from '@/lib/storage';
import { ok, fail, handleError } from '@/lib/http';
import { requirePermission } from '@/lib/admin-guard';
import { rateLimitResponse } from '@/lib/rate-limit';

/**
 * POST /api/upload
 *
 * Stores an uploaded file and returns its URL. Accepts either:
 *
 *  • JSON: { dataUrl: "data:image/jpeg;base64,…", fileName?, kind? }
 *      — used by client-compressed image uploads
 *  • multipart/form-data: file=<File>, kind=<bucket>
 *      — used for bank-transfer receipts / product photos
 *
 * `kind` ∈ receipt | product | site (default: product).
 */
const ALLOWED_TYPES = new Set([
  'image/png', 'image/jpeg', 'image/webp', 'image/gif', 'image/svg+xml', 'application/pdf',
  'application/postscript', 'application/illustrator', 'image/vnd.adobe.photoshop',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
]);
// Browsers report inconsistent (often generic/empty) MIME types for design-app and
// spreadsheet formats — fall back to the extension when the MIME type isn't recognized.
const DESIGN_FILE_EXTENSIONS = /\.(pdf|ai|psd|eps|xlsx|xls)$/i;
const HEIC_TYPES = new Set([
  'image/heic', 'image/heif', 'image/heic-sequence', 'image/heif-sequence',
]);
const MAX_BYTES = 100 * 1024 * 1024; // 100MB — native Illustrator/Photoshop files can be large
const BUCKETS: Bucket[] = ['receipt', 'product', 'site'];
const PUBLIC_BUCKETS = new Set<Bucket>(['receipt']);

function normalizeKind(v: unknown): Bucket {
  return BUCKETS.includes(v as Bucket) ? (v as Bucket) : 'product';
}

/** iPhone/Android cameras default to HEIC/HEIF, which most browsers can't render — convert to JPEG on upload. */
function isHeic(mime: string, filename: string): boolean {
  return HEIC_TYPES.has(mime) || /\.hei[cf]$/i.test(filename);
}

function isAllowedType(mime: string, filename: string): boolean {
  return ALLOWED_TYPES.has(mime) || DESIGN_FILE_EXTENSIONS.test(filename);
}

function sameOrigin(request: Request): boolean {
  const origin = request.headers.get('origin');
  if (!origin) return true;
  try {
    return new URL(origin).host === new URL(request.url).host;
  } catch {
    return false;
  }
}

async function requireBucketAccess(request: Request, bucket: Bucket) {
  if (PUBLIC_BUCKETS.has(bucket)) return null;
  if (!sameOrigin(request)) return fail('Invalid request origin', 403);
  await requirePermission('products', 'edit');
  return null;
}

export async function POST(request: Request) {
  try {
    const ipLimit = await rateLimitResponse(request, { scope: 'upload:ip', limit: 20, windowMs: 60 * 60 * 1000 });
    if (ipLimit) return ipLimit;

    const requestContentType = request.headers.get('content-type') || '';

    let data: Buffer;
    let filename: string;
    let mime: string;
    let bucket: Bucket;

    if (requestContentType.includes('multipart/form-data')) {
      const form = await request.formData();
      const file = form.get('file');
      if (!(file instanceof File)) return fail('No file provided', 400);
      mime = file.type || 'application/octet-stream';
      filename = file.name || 'upload';
      bucket = normalizeKind(form.get('kind'));
      data = Buffer.from(await file.arrayBuffer());
    } else {
      const body = await request.json();
      const { dataUrl, fileName } = body as { dataUrl?: string; fileName?: string };
      if (!dataUrl || !/^data:[^;]*;base64,/.test(dataUrl)) return fail('Invalid data URL', 400);
      mime = dataUrl.slice(5, dataUrl.indexOf(';')) || 'application/octet-stream';
      filename = fileName || `upload.${mime.split('/')[1] || 'bin'}`;
      bucket = normalizeKind(body.kind);
      data = Buffer.from(dataUrl.slice(dataUrl.indexOf(',') + 1), 'base64');
    }

    const accessError = await requireBucketAccess(request, bucket);
    if (accessError) return accessError;

    if (isHeic(mime, filename)) {
      try {
        data = Buffer.from(await convertHeic({ buffer: data, format: 'JPEG', quality: 0.9 }));
      } catch {
        return fail('Could not process this image', 400);
      }
      mime = 'image/jpeg';
      filename = filename.replace(/\.hei[cf]$/i, '') + '.jpg';
    }

    if (!isAllowedType(mime, filename)) return fail(`Unsupported file type: ${mime}`, 415);
    if (data.length === 0) return fail('Empty file', 400);
    if (data.length > MAX_BYTES) return fail('File too large (max 100MB)', 413);

    const byteLimit = await rateLimitResponse(request, {
      scope: 'upload:bytes',
      limit: 200 * 1024 * 1024,
      windowMs: 60 * 60 * 1000,
      cost: data.length,
    });
    if (byteLimit) return byteLimit;

    const storedContentType = mime === 'image/svg+xml' ? 'application/octet-stream' : mime;
    const { url } = await storage.put({ bucket, filename, data, contentType: storedContentType });
    return ok({ url, key: url });
  } catch (err) {
    return handleError(err);
  }
}
