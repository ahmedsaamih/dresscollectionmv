'use client';
import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { STAGE_META, formatMVR } from '@/lib/utils';
import { useStore } from '@/contexts/StoreContext';
import { SlipUpload } from '@/components/SlipUpload';
import { Check, Circle, Info } from 'lucide-react';

export default function StatusPage() {
  const [ref, setRef]       = useState('');
  const [contact, setContact] = useState('');
  const [searched, setSearched] = useState('');
  const [result, setResult] = useState<any>(undefined);
  const [error, setError]   = useState('');
  const [loading, setLoading] = useState(false);
  const { data } = useStore();
  const copy = data.settings.storefrontCopy.cartQuoteStatus;

  const track = async (refOverride?: string, contactOverride?: string) => {
    const key = (refOverride ?? ref).trim().toUpperCase();
    const contactVal = contactOverride ?? contact;
    if (!key) { setError('Enter a reference number.'); return; }
    if (!/^(DC|QT)-/.test(key)) { setError('References start with DC- (orders) or QT- (quotes).'); return; }
    if (!contactVal.trim()) { setError('Enter the email or mobile on your confirmation.'); return; }
    setError(''); setLoading(true);
    try {
      const res = await fetch(`/api/status?ref=${encodeURIComponent(key)}&contact=${encodeURIComponent(contactVal.trim())}`);
      setSearched(key);
      if (res.status === 404) { setResult(null); }
      else if (!res.ok) { const j = await res.json(); setError(j.error || 'Something went wrong.'); setResult(undefined); }
      else { setResult(await res.json()); }
    } catch {
      setError('Network error. Please try again.');
      setResult(undefined);
    } finally {
      setLoading(false);
    }
  };

  // Prefill from a shared/SMS/email tracking link (?ref=DC-26-48213). Read via
  // window.location instead of useSearchParams so this page can stay static.
  // If a ?contact= is also present (e.g. a future "Proceed to Payment" link),
  // auto-track so results render without requiring a manual "Track →" click.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const refParam = params.get('ref');
    const contactParam = params.get('contact');
    if (refParam) setRef(refParam.toUpperCase());
    if (contactParam) setContact(contactParam);
    if (refParam && contactParam) {
      track(refParam.toUpperCase(), contactParam);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const r = result;
  const isOrder = r?.type === 'order';
  const color = isOrder ? '#600a32' : '#e63387';
  // r.ref is the entity actually being displayed — usually equal to what was
  // searched, but diverges when a QT- lookup hands off to its converted order
  // (see /api/status), so slip uploads and the displayed number must key off it.
  const displayedRef = r?.ref ?? searched;

  return (
    <div className="min-h-screen bg-page text-body font-archivo">
      <Header/>
      <div className="max-w-[760px] mx-auto px-5 sm:px-8 py-10 pb-[90px]">
        <div className="text-center mb-[30px]">
          <div className="inline-flex items-center gap-[9px] text-[12px] font-bold tracking-[.18em] uppercase text-rose-600 mb-[14px]">
            <span className="w-[22px] h-[2px] bg-rose-500" style={{ transform:'skewX(-24deg)' }}/>{copy.statusEyebrow}
          </div>
          <h1 className="font-archivo-narrow font-bold text-[30px] sm:text-[40px] tracking-[.01em]">{copy.statusTitle}</h1>
          <p className="text-[14.5px] text-sub mt-[11px] max-w-[480px] mx-auto leading-[1.6]">
            {copy.statusIntro}
          </p>
        </div>

        <div className="bg-surface border border-[rgba(0,0,0,.08)] rounded-2xl p-[18px] sm:p-[22px] flex flex-col sm:flex-row gap-3 items-stretch sm:items-start">
          <div className="flex-1">
            <input value={ref} onChange={e=>{ setRef(e.target.value); setError(''); }}
              onKeyDown={e=>{ if(e.key==='Enter') track(); }}
              placeholder="e.g. DC-26-48213"
              className="w-full bg-well border rounded-xl px-4 py-[14px] text-body font-archivo text-[15px] outline-none tracking-[.02em]"
              style={{ borderColor:error?'#ff3d4d':'rgba(0,0,0,.12)' }}/>
            <input value={contact} onChange={e=>{ setContact(e.target.value); setError(''); }}
              onKeyDown={e=>{ if(e.key==='Enter') track(); }}
              placeholder="Email or mobile on your confirmation"
              className="w-full bg-well border rounded-xl px-4 py-[14px] mt-[10px] text-body font-archivo text-[15px] outline-none tracking-[.02em]"
              style={{ borderColor:error?'#ff3d4d':'rgba(0,0,0,.12)' }}/>
            {error && <div className="text-[12px] text-[#e81a2b] mt-2">{error}</div>}
            <div className="flex gap-2 mt-[11px] flex-wrap items-center">
              <span className="text-[11.5px] text-muted">Try:</span>
              {[['DC-26-48213','amina@email.mv']].map(([s,c])=>(
                <button key={s} onClick={()=>{ setRef(s); setContact(c); setError(''); }} className="border border-[rgba(0,0,0,.12)] bg-transparent text-sub font-archivo text-[11.5px] px-[10px] py-1 rounded-[7px] cursor-pointer hover:border-[rgba(219,87,149,.3)] hover:text-rose-700 transition-colors tabular">{s}</button>
              ))}
            </div>
          </div>
          <button onClick={()=>track()} disabled={loading} className="border-none bg-rose-500 text-[#200612] font-extrabold text-[14.5px] px-[22px] py-[14px] rounded-xl cursor-pointer whitespace-nowrap hover:brightness-105 transition-all disabled:opacity-60 disabled:cursor-not-allowed">{loading ? 'Tracking…' : 'Track →'}</button>
        </div>

        {/* Result */}
        {r && (
          <div className="mt-6 bg-surface rounded-[18px] overflow-hidden border animate-fade-up" style={{ borderColor:isOrder?'rgba(219,87,149,.25)':'rgba(193,57,120,.25)' }}>
            <div className="p-[22px_24px] border-b border-[rgba(0,0,0,.07)] flex items-center justify-between flex-wrap gap-3">
              <div>
                <div className="flex items-center gap-[10px]">
                  <span className="font-archivo-narrow font-bold text-[26px] tabular" style={{ color }}>{displayedRef}</span>
                  <span className="text-[9.5px] font-extrabold uppercase px-[9px] py-[3px] rounded-[6px]" style={{ color, background:isOrder?'rgba(219,87,149,.14)':'rgba(193,57,120,.15)' }}>{isOrder?'Order':'Quote'}</span>
                </div>
                {r.convertedFromQuoteRef && (
                  <div className="text-[11.5px] text-muted mt-[3px]">Converted from quote {r.convertedFromQuoteRef}</div>
                )}
                <div className="text-[13px] text-sub mt-[7px]">{r.summary}</div>
                {isOrder && (
                  <div className="flex items-center gap-2 mt-[7px] flex-wrap">
                    <span className="text-[10px] font-extrabold uppercase px-[7px] py-[2px] rounded-[5px] bg-[rgba(0,0,0,.08)] text-sub">{r.method}</span>
                    <span className="text-[10px] font-extrabold uppercase px-[7px] py-[2px] rounded-[5px]" style={{ background:r.paid?'rgba(219,87,149,.12)':'rgba(255,61,77,.12)', color:r.paid?'#600a32':'#e81a2b' }}>{r.paid?'Paid':'Awaiting payment'}</span>
                    {(r.deliveryFee ?? 0) > 0 && <span className="text-[10px] font-extrabold uppercase px-[7px] py-[2px] rounded-[5px] bg-[rgba(245,200,66,.1)] text-[#8a6205]">Delivery {formatMVR(r.deliveryFee)}</span>}
                  </div>
                )}
              </div>
              <div className="text-right">
                <div className="text-[11px] text-muted tracking-[.1em] uppercase">{r.metaLabel}</div>
                <div className="text-[17px] font-extrabold mt-1" style={{ color }}>{r.metaValue}</div>
              </div>
            </div>
            <div className="p-6">
              {r.steps.map((s:any, i:number) => {
                const done=i<r.stage, curr=i===r.stage;
                const m = STAGE_META[Math.min(i,3)];
                return (
                  <div key={i} className="flex gap-[15px]">
                    <div className="flex flex-col items-center">
                      <span className="w-7 h-7 rounded-full flex-none inline-flex items-center justify-center text-[13px] font-black"
                        style={{ background:done?color:(curr?'rgba(219,87,149,.12)':'transparent'), color:done?'#200612':(curr?color:'#907481'), border:done?'none':(curr?'1px solid '+color:'1px solid rgba(0,0,0,.15)') }}>
                        {done ? <Check size={14} strokeWidth={3} /> : curr ? <Circle size={9} className="fill-current" /> : (i+1)}
                      </span>
                      {i<r.steps.length-1 && <span className="w-[2px] flex-1 min-h-[26px]" style={{ background:done?color:'rgba(0,0,0,.1)' }}/>}
                    </div>
                    <div className="pb-[18px]">
                      <div className="text-[14px] font-bold" style={{ color:(done||curr)?'#150d11':'#907481' }}>{s.title}</div>
                      <div className="text-[12px] text-[#705260] mt-[3px]">{s.desc}</div>
                      {s.date && <div className="text-[11.5px] text-muted mt-1 tabular">{s.date}</div>}
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="px-6 pb-[22px] flex flex-col gap-[14px]">
              <div className="flex gap-[11px] items-start rounded-[13px] p-[14px_16px]" style={{ background:isOrder?'rgba(219,87,149,.04)':'rgba(193,57,120,.05)', border:'1px solid '+(isOrder?'rgba(219,87,149,.14)':'rgba(193,57,120,.18)') }}>
                <span style={{ color }}><Info size={15} /></span>
                <div className="text-[12.5px] text-sub leading-[1.55]">{r.note}</div>
              </div>
              {r.canUploadSlip && (
                <SlipUpload uploadUrl={isOrder ? `/api/orders/${displayedRef}/receipts` : `/api/quotes/${displayedRef}/receipts`} />
              )}
            </div>
          </div>
        )}

        {searched && result === null && (
          <div className="mt-6 border border-dashed border-[rgba(0,0,0,.14)] rounded-2xl py-11 px-6 text-center animate-fade-up">
            <div className="w-[52px] h-[52px] rounded-[13px] bg-[rgba(0,0,0,.07)] inline-flex items-center justify-center text-muted text-[24px]">?</div>
            <div className="font-bold text-[17px] mt-[14px]">{copy.statusNoMatchTitle}</div>
            <div className="text-[13px] text-[#705260] mt-1.5 leading-[1.5]">{copy.statusNoMatchBody} <Link href="/contact" className="text-rose-700 no-underline">Contact us</Link>.</div>
          </div>
        )}
      </div>
      <Footer/>
    </div>
  );
}
