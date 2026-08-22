'use client';
import React, { useState, useRef } from 'react';
import { useStore } from '@/contexts/StoreContext';
import { Check, Upload } from 'lucide-react';

/**
 * Payment-slip uploader for the post-checkout order confirmation and status
 * pages. POSTs the uploaded file's storage URL to whatever `uploadUrl` the
 * caller supplies (e.g. `/api/orders/{ref}/receipts`).
 */
export function SlipUpload({ uploadUrl }: { uploadUrl: string }) {
  const { data } = useStore();
  const copy = data.settings.storefrontCopy.paymentCheckout;
  const [uploading, setUploading] = useState(false);
  const [done, setDone] = useState(false);
  const [err, setErr] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const upload = async (file: File) => {
    if (!file) return;
    if (file.size > 8 * 1024 * 1024) { setErr('File too large (max 8 MB).'); return; }
    setUploading(true); setErr('');
    try {
      const form = new FormData();
      form.append('file', file);
      form.append('kind', 'receipt');
      const up = await fetch('/api/upload', { method: 'POST', body: form });
      const { url } = await up.json();
      if (!up.ok || !url) throw new Error('Upload failed');
      const save = await fetch(uploadUrl, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
      });
      if (!save.ok) throw new Error('Could not attach receipt.');
      setDone(true);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Upload failed. Please try again.');
    } finally { setUploading(false); }
  };

  if (done) return (
    <div className="flex items-center gap-2 bg-[rgba(219,87,149,.06)] border border-[rgba(219,87,149,.25)] rounded-xl p-[14px_16px]">
      <span className="text-rose-700"><Check size={16} /></span>
      <span className="text-[13px] font-semibold text-[#705260]">{copy.slipReceived}</span>
    </div>
  );

  return (
    <div className="text-left bg-[rgba(0,0,0,.045)] border border-[rgba(0,0,0,.1)] rounded-[14px] p-[18px_20px]">
      <div className="text-[12.5px] font-bold text-[#705260] mb-[8px]">{copy.slipUploadTitle} <span className="text-muted font-normal">(optional)</span></div>
      <div className="text-[12px] text-sub leading-[1.55] mb-[12px]">{copy.slipUploadHelp}</div>
      <input ref={inputRef} type="file" accept="image/*,application/pdf" className="hidden"
        onChange={e => { const f = e.target.files?.[0]; if (f) upload(f); }} />
      <button onClick={() => inputRef.current?.click()} disabled={uploading}
        className="inline-flex items-center gap-1 border border-[rgba(219,87,149,.35)] bg-[rgba(219,87,149,.06)] text-rose-700 font-bold text-[13px] px-[18px] py-[10px] rounded-[10px] cursor-pointer disabled:opacity-50">
        {uploading ? 'Uploading…' : <><Upload size={13} /> Choose file</>}
      </button>
      {err && <div className="text-[11.5px] text-[#e81a2b] mt-[8px]">{err}</div>}
      <div className="text-[11px] text-muted mt-[8px]">{copy.receiptFileHint}</div>
    </div>
  );
}
