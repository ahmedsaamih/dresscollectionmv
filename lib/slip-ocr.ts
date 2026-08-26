import path from 'path';
import { createWorker } from 'tesseract.js';
import { parseSlipOcr, type ParsedSlip } from '@/lib/slip-ocr-parse';

// Self-hosted English trained-data — the only Tesseract asset still needed now that OCR is
// server-side (the core wasm resolves via plain `require()` inside tesseract.js-core, no
// asset staging needed for that part). Read via a runtime string path, which Next's build
// tracer can't follow — see next.config.mjs's outputFileTracingIncludes for the routes that
// call this.
const LANG_PATH = path.join(process.cwd(), 'public/tesseract/lang-data');

/**
 * Best-effort, server-side OCR of a slip image — never throws, returns null on any failure
 * (unsupported content type, OCR error) so callers can treat this as optional/informational,
 * same trust model as the rest of this feature: the slip image stays the source of truth an
 * admin verifies against, this is just a searchable convenience.
 *
 * cachePath is pinned to /tmp — tesseract.js writes a cache file next to cachePath (defaults
 * to the current working directory), which is read-only on Vercel's Node functions outside
 * /tmp; without this override every invocation would fail on the cache write.
 */
export async function ocrSlipImage(image: Buffer, contentType: string): Promise<(ParsedSlip & { rawText: string }) | null> {
  if (!contentType.startsWith('image/') || contentType === 'image/svg+xml') return null;
  try {
    const worker = await createWorker('eng', undefined, { langPath: LANG_PATH, cachePath: '/tmp' });
    try {
      const { data } = await worker.recognize(image);
      return { ...parseSlipOcr(data.text), rawText: data.text };
    } finally {
      await worker.terminate();
    }
  } catch {
    return null;
  }
}
