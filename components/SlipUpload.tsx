'use client';
import React, { useState, useRef } from 'react';
import { useStore } from '@/contexts/StoreContext';
import { Check, Upload } from 'lucide-react';
import { parseSlipOcr, type OcrBlock, type ParsedSlip } from '@/lib/slip-ocr-parse';

interface SlipUploadProps {
  /** Post-order mode: POSTs the uploaded file's storage URL to this endpoint (e.g. `/api/orders/{ref}/receipts`). */
  uploadUrl?: string;
  /** Pre-order mode: no order exists yet, so instead of POSTing anywhere this just hands the caller the uploaded
   *  storage URL to hold in form state and submit along with the rest of the checkout payload. Called immediately
   *  once the upload finishes — OCR is never awaited before this fires (see ocrImage's doc comment). */
  onUploaded?: (url: string) => void;
  /** Pre-order mode only: called later, in the background, once best-effort OCR extraction finishes (or not at
   *  all, if it fails). The checkout form should hold this in state and include it in its eventual submit —
   *  if the customer submits before this fires, the order is simply created without OCR data, which is fine. */
  onOcrReady?: (ocr: ParsedSlip) => void;
  /** Pre-order mode: drops the "(optional)" label, since checkout requires a slip up front. */
  required?: boolean;
  /** uploadUrl mode only: receipt kind to record — defaults to 'payment_slip' (the deposit/full-payment slip). */
  kind?: 'payment_slip' | 'balance_slip';
  /** uploadUrl mode only, required when kind is 'balance_slip': the contact (email/mobile) the customer looked
   *  up their order with — the balance-upload endpoint verifies it against the order on file. */
  contact?: string;
}

const MAX_DIMENSION = 1800;
const JPEG_QUALITY = 0.82;

/** Downscale + re-encode an uploaded slip image in-browser so R2 storage and admin viewing get a smaller file. Best-effort — falls back to the original file (HEIC in particular won't decode via createImageBitmap in most browsers, which is fine: the server still converts it). */
async function compressImage(file: File): Promise<File> {
  if (!file.type.startsWith('image/') || file.type === 'image/svg+xml') return file;
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, MAX_DIMENSION / Math.max(bitmap.width, bitmap.height));
    const w = Math.round(bitmap.width * scale);
    const h = Math.round(bitmap.height * scale);
    const canvas = document.createElement('canvas');
    canvas.width = w; canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) return file;
    ctx.drawImage(bitmap, 0, 0, w, h);
    const blob: Blob | null = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', JPEG_QUALITY));
    if (!blob || blob.size >= file.size) return file;
    return new File([blob], file.name.replace(/\.\w+$/, '') + '.jpg', { type: 'image/jpeg' });
  } catch {
    return file;
  }
}

/**
 * Best-effort, in-browser OCR of a slip image via Tesseract.js — zero server cost, but the
 * result is client-submitted data: treat it as an informational/searchable convenience next
 * to the real slip image, never as proof of payment. Returns null on any failure (unsupported
 * file type, OCR error) — never blocks the upload.
 *
 * This downloads a multi-megabyte WASM core + language data on first use and can take a real
 * while to run, so it is NEVER awaited before completing the upload — callers must kick this
 * off after the upload/onUploaded has already resolved and treat its result as arriving late,
 * in the background. (An earlier version of this awaited OCR before uploading, which left
 * customers stuck on a "Reading slip…" state for the full download+compute time — see git
 * history.)
 *
 * Tesseract.js defaults to fetching its worker/core/language files from a CDN and spawning
 * its worker via a blob: URL — both are blocked by this app's CSP (script-src/connect-src
 * 'self' only, no blob: worker-src). So its assets are self-hosted under public/tesseract/
 * and workerBlobURL is disabled so the worker loads from a plain same-origin URL instead —
 * the whole pipeline then stays same-origin and needs no CSP changes.
 */
async function ocrImage(file: File): Promise<ParsedSlip | null> {
  if (!file.type.startsWith('image/') || file.type === 'image/svg+xml') return null;
  try {
    const { createWorker } = await import('tesseract.js');
    const worker = await createWorker('eng', undefined, {
      workerPath: '/tesseract/worker.min.js',
      corePath: '/tesseract/tesseract-core-lstm.wasm.js',
      langPath: '/tesseract/lang-data',
      workerBlobURL: false,
    });
    try {
      const { data } = await worker.recognize(file, {}, { blocks: true });
      const blocks: OcrBlock[] = [];
      for (const block of data.blocks ?? []) {
        for (const para of block.paragraphs) {
          const text = para.text.trim();
          if (text) blocks.push({ text, x0: para.bbox.x0, y0: para.bbox.y0 });
        }
      }
      return parseSlipOcr(blocks);
    } finally {
      await worker.terminate();
    }
  } catch {
    return null;
  }
}

/** Fire-and-forget: attach OCR data to an already-created receipt once it's ready. Never surfaced to the user — a failure here just means the slip stays without extracted details, same as if OCR itself had failed. */
function attachOcrInBackground(receiptId: string, ocr: ParsedSlip) {
  fetch(`/api/receipts/${receiptId}/ocr`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ocr }),
  }).catch(() => {});
}

/**
 * Payment-slip uploader. Two modes, mutually exclusive — pass exactly one of
 * `uploadUrl` (existing post-checkout confirmation / status-page use: an
 * order already exists) or `onUploaded` (pre-order use, from the checkout
 * form itself, before an order/ref exists).
 */
export function SlipUpload({ uploadUrl, onUploaded, onOcrReady, required = false, kind = 'payment_slip', contact }: SlipUploadProps) {
  const { data } = useStore();
  const copy = data.settings.storefrontCopy.paymentCheckout;
  const [uploading, setUploading] = useState(false);
  const [done, setDone] = useState(false);
  const [err, setErr] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const upload = async (file: File) => {
    if (!file) return;
    if (file.size > 8 * 1024 * 1024) { setErr('File too large (max 8 MB).'); return; }
    setErr(''); setUploading(true);
    try {
      const compressed = await compressImage(file);

      const form = new FormData();
      form.append('file', compressed);
      form.append('kind', 'receipt');
      const up = await fetch('/api/upload', { method: 'POST', body: form });
      const { url } = await up.json();
      if (!up.ok || !url) throw new Error('Upload failed');

      let receiptId: string | null = null;
      if (onUploaded) {
        onUploaded(url);
      } else if (uploadUrl) {
        const save = await fetch(uploadUrl, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url, kind, contact }),
        });
        if (!save.ok) throw new Error('Could not attach receipt.');
        const saved = await save.json().catch(() => null);
        receiptId = saved?.receipt?.id ?? null;
      }
      setDone(true);
      setUploading(false);

      // OCR runs after the upload is already done and visible — never blocks the UI above.
      ocrImage(compressed).then(ocr => {
        if (!ocr) return;
        if (onOcrReady) onOcrReady(ocr);
        else if (receiptId) attachOcrInBackground(receiptId, ocr);
      });
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Upload failed. Please try again.');
      setUploading(false);
    }
  };

  if (done) return (
    <div className="flex items-center justify-between gap-2 bg-[rgba(219,87,149,.06)] border border-[rgba(219,87,149,.25)] rounded-xl p-[14px_16px]">
      <div className="flex items-center gap-2">
        <span className="text-rose-700"><Check size={16} /></span>
        <span className="text-[13px] font-semibold text-[#705260]">{copy.slipReceived}</span>
      </div>
      {onUploaded && (
        <>
          <input ref={inputRef} type="file" accept="image/*,application/pdf" className="hidden"
            onChange={e => { const f = e.target.files?.[0]; if (f) upload(f); e.target.value = ''; }} />
          <button type="button" onClick={() => inputRef.current?.click()} disabled={uploading}
            className="border-none bg-transparent text-rose-700 font-bold text-[12px] cursor-pointer disabled:opacity-50">
            {uploading ? 'Uploading…' : 'Replace'}
          </button>
        </>
      )}
    </div>
  );

  return (
    <div className="text-left bg-[rgba(0,0,0,.045)] border border-[rgba(0,0,0,.1)] rounded-[14px] p-[18px_20px]">
      <div className="text-[12.5px] font-bold text-[#705260] mb-[8px]">{copy.slipUploadTitle} {!required && <span className="text-muted font-normal">(optional)</span>}</div>
      <div className="text-[12px] text-sub leading-[1.55] mb-[12px]">{copy.slipUploadHelp}</div>
      <input ref={inputRef} type="file" accept="image/*,application/pdf" className="hidden"
        onChange={e => { const f = e.target.files?.[0]; if (f) upload(f); e.target.value = ''; }} />
      <button type="button" onClick={() => inputRef.current?.click()} disabled={uploading}
        className="inline-flex items-center gap-1 border border-[rgba(219,87,149,.35)] bg-[rgba(219,87,149,.06)] text-rose-700 font-bold text-[13px] px-[18px] py-[10px] rounded-[10px] cursor-pointer disabled:opacity-50">
        {uploading ? 'Uploading…' : <><Upload size={13} /> Choose file</>}
      </button>
      {err && <div className="text-[11.5px] text-[#e81a2b] mt-[8px]">{err}</div>}
      <div className="text-[11px] text-muted mt-[8px]">{copy.receiptFileHint}</div>
    </div>
  );
}
