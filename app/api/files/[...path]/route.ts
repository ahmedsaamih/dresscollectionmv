import { readStored } from '@/lib/storage';

/**
 * GET /api/files/<bucket>/<name>
 *
 * Serves files written by the local storage driver (dev only). In production
 * these URLs are replaced by the CDN URLs returned by the Blob/R2 drivers,
 * so this route is a dev convenience, not a production code path.
 */
const CONTENT_TYPES: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.svg': 'application/octet-stream',
  '.pdf': 'application/pdf',
};

export async function GET(_request: Request, props: { params: Promise<{ path: string[] }> }) {
  const params = await props.params;
  const [bucket, ...rest] = params.path;
  const name = rest.join('/');
  if (!bucket || !name) return new Response('Not found', { status: 404 });

  const data = await readStored(bucket, name);
  if (!data) return new Response('Not found', { status: 404 });

  const ext = name.slice(name.lastIndexOf('.')).toLowerCase();
  const contentType = CONTENT_TYPES[ext] || 'application/octet-stream';
  return new Response(new Uint8Array(data), {
    headers: { 'Content-Type': contentType, 'Cache-Control': 'public, max-age=31536000, immutable' },
  });
}
