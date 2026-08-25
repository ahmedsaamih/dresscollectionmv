'use client';
import React, { useState } from 'react';
import Link from 'next/link';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { MMCart } from '@/lib/cart';
import { useCart } from '@/contexts/CartContext';
import { formatMVR } from '@/lib/utils';
import { useStore } from '@/contexts/StoreContext';
import { SlipUpload } from '@/components/SlipUpload';
import type { ParsedSlip } from '@/lib/slip-ocr-parse';
import { Check, X } from 'lucide-react';

interface Conf { name:string; email:string; total:string; method:string; ref:string; discount:number; code:string|null; depositRequired:number; balanceDue:number }

export default function CheckoutPage() {
  const { cart, refresh } = useCart();
  const { data } = useStore();
  const copy = data.settings.storefrontCopy.paymentCheckout;
  const shippingCopy = data.settings.storefrontCopy.shippingPickup;
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [mobile, setMobile] = useState('');
  const method = 'delivery' as const;
  const [address, setAddress] = useState('');
  const [deliveryAreaId, setDeliveryAreaId] = useState('');
  const [notes, setNotes] = useState('');
  const [paymentSlipUrl, setPaymentSlipUrl] = useState('');
  const [paymentSlipOcr, setPaymentSlipOcr] = useState<ParsedSlip | null>(null);
  const [errors, setErrors] = useState<Record<string,boolean>>({});
  const [placed, setPlaced] = useState(false);
  const [conf, setConf] = useState<Conf|null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [apiError, setApiError] = useState('');
  const [promoInput, setPromoInput] = useState('');
  const [promo, setPromo] = useState<{ code:string; discount:number }|null>(null);
  const [promoError, setPromoError] = useState('');
  const [promoChecking, setPromoChecking] = useState(false);
  const [copiedIdx, setCopiedIdx] = useState<number|null>(null);

  const selectedArea = data.deliveryAreas.find(a => a.id === deliveryAreaId);
  const fee = selectedArea?.rate ?? 0;
  const sub = cart.fixed.reduce((a,i)=>a+i.price*i.qty,0);
  const discount = promo ? promo.discount : 0;
  const total = Math.max(0, sub + fee - discount);

  // Mirrors the server-side deposit formula in app/api/checkout/route.ts exactly —
  // for display only, the server remains authoritative on the actual amounts persisted.
  const preOrderSubtotal = cart.fixed.reduce((a,i) => {
    const p = data.products.find(pp => pp.id === i.sku);
    return a + (p?.preOrder ? i.price * i.qty : 0);
  }, 0);
  const hasPreOrder = preOrderSubtotal > 0;
  const regularSubtotal = sub - preOrderSubtotal;
  const depositRequired = hasPreOrder
    ? Math.max(0, Math.round(regularSubtotal) + Math.round(preOrderSubtotal * 0.5) + fee - discount)
    : total;
  const balanceDue = total - depositRequired;

  const applyPromo = async () => {
    const code = promoInput.trim();
    if (!code) return;
    setPromoChecking(true); setPromoError('');
    try {
      const res = await fetch('/api/promo/validate', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, items: cart.fixed.map(i => ({ sku: i.sku, qty: i.qty })) }),
      });
      const j = await res.json();
      if (!j.valid) { setPromo(null); setPromoError(j.error || 'That code is not valid.'); }
      else { setPromo({ code: j.code, discount: j.discount }); setPromoError(''); }
    } catch { setPromoError('Could not check that code right now.'); }
    finally { setPromoChecking(false); }
  };
  const removePromo = () => { setPromo(null); setPromoInput(''); setPromoError(''); };

  const place = async () => {
    const e: Record<string,boolean> = {};
    if (!name.trim()) e.name=true;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) e.email=true;
    if (!mobile.trim()) e.mobile=true;
    if (!address.trim()) e.address=true;
    if (!deliveryAreaId) e.deliveryAreaId=true;
    if (!paymentSlipUrl) e.paymentSlipUrl=true;
    if (Object.keys(e).length) { setErrors(e); return; }
    setSubmitting(true); setApiError('');
    try {
      const res = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name, email, mobile, method,
          address,
          deliveryAreaId,
          notes: notes || null,
          items: cart.fixed,
          promoCode: promo?.code ?? null,
          paymentSlipUrl,
          paymentSlipOcr,
        }),
      });
      const json = await res.json();
      if (!res.ok) { setApiError(json.error || 'Could not place order. Please try again.'); setSubmitting(false); return; }
      cart.fixed.slice().forEach(i => MMCart.remove(i.id));
      refresh();
      setConf({ name, email, total: formatMVR(json.total), method: 'Delivery', ref: json.ref, discount: json.discount || 0, code: json.discountCode || null, depositRequired: json.depositRequired ?? json.total, balanceDue: json.balanceDue ?? 0 });
      setPlaced(true);
      window.scrollTo({ top:0, behavior:'smooth' });
    } catch {
      setApiError('Network error. Please try again.');
      setSubmitting(false);
    }
  };

  if (placed && conf) return (
    <div className="min-h-screen bg-page text-body font-archivo">
      <Header/>
      <div className="max-w-[620px] mx-auto px-5 sm:px-8 py-[70px] text-center">
        <div className="w-[74px] h-[74px] rounded-[20px] bg-rose-500 text-[#200612] inline-flex items-center justify-center animate-pop"><Check size={38} strokeWidth={3} /></div>
        <h1 className="font-archivo-narrow font-bold text-[28px] sm:text-[38px] mt-6">{conf.balanceDue > 0 ? copy.depositConfirmationTitle : copy.orderPlacedTitle}</h1>
        <p className="text-[15px] text-sub mt-3 leading-[1.6]">Thanks, {conf.name}. {conf.balanceDue > 0 ? copy.depositConfirmationBody : copy.orderPlacedBody} <span className="text-[#705260]">{conf.email}</span>.</p>
        <div className="bg-surface border border-[rgba(219,87,149,.25)] rounded-2xl p-6 mt-7">
          <div className="text-[11px] tracking-[.18em] uppercase text-muted">Order reference</div>
          <div className="font-archivo-narrow font-bold text-[34px] text-rose-700 tracking-[.04em] mt-2 tabular">{conf.ref}</div>
          {conf.balanceDue > 0 ? (
            <>
              <div className="text-[12.5px] text-sub mt-[10px]">{copy.depositDueNowLabel}: <span className="text-body font-bold">{formatMVR(conf.depositRequired)}</span> · {conf.method}</div>
              <div className="text-[12px] text-muted mt-[4px]">{copy.depositBalanceLabel}: {formatMVR(conf.balanceDue)}</div>
            </>
          ) : (
            <div className="text-[12.5px] text-sub mt-[10px]">Total due: <span className="text-body font-bold">{conf.total}</span> · {conf.method}</div>
          )}
          {conf.discount > 0 && <div className="text-[12px] text-rose-700 mt-[6px]">Promo {conf.code} saved you {formatMVR(conf.discount)}</div>}
        </div>
        <div className="text-left bg-[rgba(219,87,149,.04)] border border-[rgba(219,87,149,.16)] rounded-[14px] p-[18px_20px] mt-[18px]">
          <div className="text-[12.5px] font-bold text-[#705260] mb-[10px]">{copy.paymentInstructionsTitle}</div>
          <div className="text-[13px] text-sub leading-[1.65] mb-[12px]">{copy.paymentInstructionsBody.replace('your reference', `reference ${conf.ref}`)}</div>
          {(data.settings.bankAccounts ?? []).length > 0 ? (
            <div className="flex flex-col gap-[8px]">
              {(data.settings.bankAccounts ?? []).map((acct, i) => (
                <div key={i} className="flex items-center justify-between gap-3 bg-[rgba(0,0,0,.06)] border border-[rgba(0,0,0,.09)] rounded-[10px] px-[13px] py-[10px]">
                  <div className="min-w-0">
                    <div className="text-[11px] font-semibold text-muted mb-[2px]">{acct.name}</div>
                    <div className="text-[13.5px] font-bold text-[#705260] tabular tracking-[.03em]">{acct.accountNumber}</div>
                  </div>
                  <button type="button" onClick={() => { navigator.clipboard.writeText(acct.accountNumber); setCopiedIdx(i); setTimeout(() => setCopiedIdx(null), 2000); }}
                    className="flex-none inline-flex items-center gap-1 border border-[rgba(219,87,149,.35)] bg-[rgba(219,87,149,.07)] text-rose-700 font-bold text-[11.5px] px-[12px] py-[7px] rounded-[8px] cursor-pointer whitespace-nowrap transition-all hover:brightness-110">
                    {copiedIdx === i ? <><Check size={12} strokeWidth={3} /> Copied</> : 'Copy'}
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-[13px] text-sub">{data.settings.bank}</div>
          )}
        </div>

        <div className="mt-[14px]">
          <SlipUpload uploadUrl={`/api/orders/${conf.ref}/receipts`} />
        </div>

        <div className="flex gap-3 justify-center mt-[26px] flex-wrap">
          <Link href="/status" className="no-underline bg-rose-500 text-[#200612] font-extrabold text-[14px] px-6 py-[13px] rounded-xl">Track this order →</Link>
          <Link href="/" className="no-underline border border-[rgba(0,0,0,.16)] text-body font-bold text-[14px] px-6 py-[13px] rounded-xl">Back to home</Link>
        </div>
      </div>
      <Footer/>
    </div>
  );

  const inp = (val:string, set:(v:string)=>void, ph:string, err:boolean, key:string) => (
    <input value={val} onChange={e=>{ set(e.target.value); setErrors(er=>{ const { [key]:_, ...rest } = er; return rest; }); }}
      placeholder={ph}
      className="w-full bg-well border rounded-[10px] px-[14px] py-3 text-body font-archivo text-[14px] outline-none focus:ring-2 focus:ring-rose-500/15"
      style={{ borderColor:err?'#ff3d4d':'rgba(0,0,0,.12)' }}/>
  );

  return (
    <div className="min-h-screen bg-page text-body font-archivo">
      <Header/>
      <div className="max-w-[1180px] mx-auto px-5 sm:px-8 py-[26px] pb-20">
        <div className="text-[12.5px] text-muted mb-[18px]">
          <Link href="/cart" className="text-muted no-underline hover:text-rose-700">Cart</Link>
          <span className="mx-[7px]">/</span><span className="text-sub">Checkout</span>
        </div>
        <h1 className="font-archivo-narrow font-bold text-[28px] sm:text-[38px] mb-1.5">Checkout</h1>
        <p className="text-[13.5px] text-sub mb-7">{copy.checkoutNoCardLine}</p>
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-7 items-start">
          <div className="flex flex-col gap-[18px]">
            <section className="bg-surface rounded-2xl p-[22px]">
              <h2 className="font-archivo-narrow font-bold text-[16px] uppercase tracking-[.04em] mb-5">Your details</h2>
              <div className="flex flex-col gap-[14px]">
                <div><label className="text-[12px] font-semibold text-sub block mb-[7px]">Full name</label>{inp(name,setName,'e.g. Ahmed Saleem',!!errors.name,'name')}{errors.name&&<span className="text-[11.5px] text-[#e81a2b] mt-1.5 block">Please enter your name.</span>}</div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-[14px]">
                  <div><label className="text-[12px] font-semibold text-sub block mb-[7px]">Email</label>{inp(email,setEmail,'you@email.com',!!errors.email,'email')}{errors.email&&<span className="text-[11.5px] text-[#e81a2b] mt-1.5 block">Enter a valid email.</span>}</div>
                  <div><label className="text-[12px] font-semibold text-sub block mb-[7px]">Mobile</label>{inp(mobile,setMobile,'+960 …',!!errors.mobile,'mobile')}{errors.mobile&&<span className="text-[11.5px] text-[#e81a2b] mt-1.5 block">Enter your mobile.</span>}</div>
                </div>
              </div>
            </section>
            <section className="bg-surface rounded-2xl p-[22px]">
              <h2 className="font-archivo-narrow font-bold text-[16px] uppercase tracking-[.04em] mb-5">Delivery details</h2>
              <div className="flex flex-col gap-[14px]">
                <div>
                  <label className="text-[12px] font-semibold text-sub block mb-[7px]">Delivery area</label>
                  <select value={deliveryAreaId} onChange={e=>{ setDeliveryAreaId(e.target.value); setErrors(er=>({ ...er, deliveryAreaId:false })); }}
                    className="w-full bg-well border rounded-[10px] px-[14px] py-3 text-body font-archivo text-[14px] outline-none focus:ring-2 focus:ring-rose-500/15 cursor-pointer"
                    style={{ borderColor:errors.deliveryAreaId?'#ff3d4d':'rgba(0,0,0,.12)' }}>
                    <option value="">Select your area…</option>
                    {data.deliveryAreas.map(a => <option key={a.id} value={a.id}>{a.name} — {formatMVR(a.rate)}</option>)}
                  </select>
                  {errors.deliveryAreaId&&<span className="text-[11.5px] text-[#e81a2b] mt-1.5 block">Please select a delivery area.</span>}
                </div>
                <div>
                  <label className="text-[12px] font-semibold text-sub block mb-[7px]">Delivery address</label>
                  {inp(address,setAddress,shippingCopy.deliveryAddressPlaceholder,!!errors.address,'address')}
                  {errors.address&&<span className="text-[11.5px] text-[#e81a2b] mt-1.5 block">Add a delivery address.</span>}
                </div>
              </div>
              <div className="mt-[14px]">
                <label className="text-[12px] font-semibold text-sub block mb-[7px]">Order notes <span className="text-muted font-normal">(optional)</span></label>
                <textarea value={notes} onChange={e=>setNotes(e.target.value)} placeholder="Anything we should know…" className="w-full h-[60px] resize-none bg-well border border-[rgba(0,0,0,.12)] rounded-[10px] px-[14px] py-[11px] text-body font-archivo text-[13.5px] outline-none focus:border-rose-500"/>
              </div>
            </section>
            <section className="border border-[rgba(219,87,149,.2)] rounded-2xl p-[22px]" style={{ background:'linear-gradient(180deg,#fbeaf2,#f7f2f4)' }}>
              <div className="flex items-center gap-[9px] mb-3">
                <h2 className="font-archivo-narrow font-bold text-[18px]">{copy.paymentHeading}</h2>
                <span className="text-[9px] font-extrabold uppercase text-[#200612] bg-rose-500 px-2 py-[3px] rounded-[5px]">{copy.noCardBadge}</span>
              </div>
              <div className="text-[13px] text-sub leading-[1.65] mb-[14px]">{copy.paymentIntro}</div>
              {(data.settings.bankAccounts ?? []).length > 0 ? (
                <div className="flex flex-col gap-[8px]">
                  {(data.settings.bankAccounts ?? []).map((acct, i) => (
                    <div key={i} className="flex items-center justify-between gap-3 bg-[rgba(0,0,0,.05)] border border-[rgba(0,0,0,.09)] rounded-[11px] px-[13px] py-[11px]">
                      <div className="min-w-0">
                        <div className="text-[11px] font-semibold text-muted mb-[2px]">{acct.name}</div>
                        <div className="text-[13.5px] font-bold text-[#705260] tabular tracking-[.03em]">{acct.accountNumber}</div>
                      </div>
                      <button type="button" onClick={() => { navigator.clipboard.writeText(acct.accountNumber); setCopiedIdx(i); setTimeout(() => setCopiedIdx(null), 2000); }}
                        className="flex-none inline-flex items-center gap-1 border border-[rgba(219,87,149,.35)] bg-[rgba(219,87,149,.07)] text-rose-700 font-bold text-[11.5px] px-[12px] py-[7px] rounded-[8px] cursor-pointer whitespace-nowrap transition-all hover:brightness-110">
                        {copiedIdx === i ? <><Check size={12} strokeWidth={3} /> Copied</> : 'Copy'}
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-[13px] text-sub">{data.settings.bank}</div>
              )}
              <div className="mt-[16px]">
                <SlipUpload
                  required
                  onUploaded={(url, ocr) => { setPaymentSlipUrl(url); setPaymentSlipOcr(ocr); setErrors(er => { const { paymentSlipUrl: _drop, ...rest } = er; return rest; }); }}
                />
                {errors.paymentSlipUrl && <div className="text-[11.5px] text-[#e81a2b] mt-[8px]">Upload your payment slip to place the order.</div>}
              </div>
            </section>
          </div>
          <aside className="lg:sticky lg:top-[84px] bg-surface rounded-2xl p-5">
            <div className="font-extrabold text-[14px] mb-[14px]">Order summary</div>
            <div className="flex flex-col gap-[11px] max-h-[230px] overflow-auto">
              {cart.fixed.map(i=>(
                <div key={i.id} className="flex gap-[11px] items-center">
                  <div className="w-[46px] h-[46px] rounded-[9px] flex-none relative overflow-hidden" style={{ background:i.img }}>
                    <span className="absolute -top-[6px] -right-[6px] min-w-[18px] h-[18px] px-[5px] rounded-full bg-rose-500 text-[#200612] text-[10px] font-extrabold flex items-center justify-center">{i.qty}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-[12.5px] font-semibold text-[#705260] truncate">{i.name}</div>
                    <div className="text-[11px] text-muted">{[i.size, i.color].filter(Boolean).join(' · ')}</div>
                  </div>
                  <span className="text-[12.5px] font-bold text-rose-700 tabular">{formatMVR(i.price*i.qty)}</span>
                </div>
              ))}
            </div>
            <div className="h-px bg-[rgba(0,0,0,.08)] my-[14px]"/>

            {/* Promo / referral code */}
            <div className="mb-[14px]">
              {!promo ? (
                <>
                  <label className="text-[11.5px] font-semibold text-sub block mb-[7px]">Promo or referral code</label>
                  <div className="flex gap-2">
                    <input value={promoInput} onChange={e=>{ setPromoInput(e.target.value.toUpperCase()); setPromoError(''); }}
                      onKeyDown={e=>{ if(e.key==='Enter'){ e.preventDefault(); applyPromo(); } }}
                      placeholder="Enter code"
                      className="flex-1 min-w-0 bg-well border border-[rgba(0,0,0,.12)] rounded-[9px] px-[12px] py-[9px] text-body font-archivo text-[13px] uppercase tracking-[.04em] outline-none focus:border-rose-500"/>
                    <button onClick={applyPromo} disabled={promoChecking || !promoInput.trim()}
                      className="flex-none border border-[rgba(219,87,149,.35)] bg-[rgba(219,87,149,.08)] text-rose-700 font-bold text-[12.5px] px-[14px] rounded-[9px] cursor-pointer disabled:opacity-50">
                      {promoChecking ? '…' : 'Apply'}
                    </button>
                  </div>
                  {promoError && <div className="text-[11.5px] text-[#e81a2b] mt-[7px]">{promoError}</div>}
                </>
              ) : (
                <div className="flex items-center justify-between bg-[rgba(219,87,149,.06)] border border-[rgba(219,87,149,.25)] rounded-[9px] px-[12px] py-[9px]">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-rose-700"><Check size={13} /></span>
                    <span className="text-[12.5px] font-bold text-[#705260] truncate">{promo.code}</span>
                    <span className="text-[11px] text-muted">applied</span>
                  </div>
                  <button onClick={removePromo} aria-label="Remove code" className="border-none bg-transparent text-muted hover:text-[#e81a2b] cursor-pointer flex-none"><X size={15} /></button>
                </div>
              )}
            </div>

            <div className="flex justify-between text-[13px] text-sub mb-2"><span>Subtotal</span><span className="text-body font-semibold">{formatMVR(sub)}</span></div>
            {discount > 0 && <div className="flex justify-between text-[13px] mb-2"><span className="text-rose-700">Discount{promo?` · ${promo.code}`:''}</span><span className="text-rose-700 font-semibold">−{formatMVR(discount)}</span></div>}
            <div className="flex justify-between text-[13px] text-sub mb-2"><span>Delivery</span><span>{formatMVR(fee)}</span></div>
            {hasPreOrder && <div className="flex justify-between text-[13px] text-sub mb-2"><span>Order total</span><span>{formatMVR(total)}</span></div>}
            <div className="h-px bg-[rgba(0,0,0,.08)] my-[13px]"/>
            <div className="flex justify-between items-baseline">
              <span className="font-bold">{hasPreOrder ? copy.depositDueNowLabel : 'Total'}</span>
              <span className="font-extrabold text-[20px] text-rose-700 tabular">{formatMVR(hasPreOrder ? depositRequired : total)}</span>
            </div>
            {hasPreOrder && (
              <>
                <div className="flex justify-between text-[12px] text-muted mt-1.5"><span>{copy.depositBalanceLabel}</span><span>{formatMVR(balanceDue)}</span></div>
                <div className="text-[11.5px] text-rose-700 bg-[rgba(219,87,149,.06)] border border-[rgba(219,87,149,.2)] rounded-[10px] px-[12px] py-[9px] mt-[12px] leading-[1.5]">{copy.depositExplainerBody}</div>
              </>
            )}
            <button onClick={place} disabled={submitting} className="w-full mt-4 border-none bg-rose-500 text-[#200612] font-extrabold text-[15px] py-[14px] rounded-xl cursor-pointer shadow-rose-lg hover:brightness-105 transition-all disabled:opacity-60 disabled:cursor-not-allowed">{submitting ? 'Placing…' : 'Place order'}</button>
            {apiError && <div className="text-center text-[12px] text-[#e81a2b] mt-2">{apiError}</div>}
            <div className="text-center text-[11px] text-muted mt-[9px]">You'll get a reference number to pay against.</div>
          </aside>
        </div>
      </div>
      <Footer/>
    </div>
  );
}
