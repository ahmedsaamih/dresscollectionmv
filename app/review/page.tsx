'use client';
import React, { useEffect, useState, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { Check, Star } from 'lucide-react';

function StarInput({ value, onChange }: { value: number; onChange: (n: number) => void }) {
  return (
    <div className="flex gap-[6px]">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          onClick={() => onChange(n)}
          aria-label={`${n} star${n === 1 ? '' : 's'}`}
          className="border-none bg-transparent cursor-pointer leading-none p-0"
          style={{ color: n <= value ? '#600a32' : 'rgba(0,0,0,.18)' }}
        >
          <Star size={28} className={n <= value ? 'fill-current' : 'fill-none'} strokeWidth={n <= value ? 0 : 1.5} />
        </button>
      ))}
    </div>
  );
}

function ReviewForm() {
  const params = useSearchParams();
  const token = params.get('token') || '';

  const [loading, setLoading] = useState(true);
  const [valid, setValid] = useState(false);
  const [ref, setRef] = useState('');

  const [rating, setRating] = useState(0);
  const [quoteText, setQuoteText] = useState('');
  const [authorName, setAuthorName] = useState('');
  const [authorRole, setAuthorRole] = useState('');
  const [errors, setErrors] = useState<Record<string, boolean>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [apiError, setApiError] = useState('');

  useEffect(() => {
    let active = true;
    if (!token) { setLoading(false); setValid(false); return; }
    fetch(`/api/review?token=${encodeURIComponent(token)}`)
      .then(async (r) => {
        if (!active) return;
        if (!r.ok) { setValid(false); return; }
        const j = await r.json();
        setValid(true);
        setRef(j.ref);
        setAuthorName(j.customerName || '');
      })
      .catch(() => { if (active) setValid(false); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [token]);

  const submit = async () => {
    const e: Record<string, boolean> = {};
    if (rating < 1) e.rating = true;
    if (!quoteText.trim()) e.quote = true;
    if (Object.keys(e).length) { setErrors(e); return; }
    setSubmitting(true); setApiError('');
    try {
      const res = await fetch('/api/review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, rating, quote: quoteText, authorName: authorName || undefined, authorRole: authorRole || undefined }),
      });
      const json = await res.json();
      if (!res.ok) { setApiError(json.error || 'Could not submit your review. Please try again.'); setSubmitting(false); return; }
      setSubmitted(true);
    } catch {
      setApiError('Network error. Please try again.');
      setSubmitting(false);
    }
  };

  if (loading) {
    return <div className="max-w-[620px] mx-auto px-5 sm:px-8 py-[70px] text-center text-sub">Loading…</div>;
  }

  if (!valid) {
    return (
      <div className="max-w-[620px] mx-auto px-5 sm:px-8 py-[70px] text-center">
        <h1 className="font-archivo-narrow font-bold text-[26px] sm:text-[32px]">This link is no longer valid</h1>
        <p className="text-[14px] text-sub mt-3 leading-[1.6]">It may have expired or already been used. If you'd still like to leave a review, get in touch with us.</p>
        <Link href="/" className="inline-block mt-6 no-underline bg-rose-400 text-[#200612] font-extrabold text-[14px] px-6 py-[13px] rounded-xl">Back to home</Link>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="max-w-[620px] mx-auto px-5 sm:px-8 py-[70px] text-center">
        <div className="w-[74px] h-[74px] rounded-[20px] bg-rose-400 text-[#200612] inline-flex items-center justify-center animate-pop"><Check size={34} strokeWidth={3} /></div>
        <h1 className="font-archivo-narrow font-bold text-[28px] sm:text-[38px] mt-6">Thanks for the review!</h1>
        <p className="text-[15px] text-sub mt-3 leading-[1.6]">It's awaiting approval and may appear on our homepage soon.</p>
        <Link href="/" className="inline-block mt-7 no-underline bg-rose-400 text-[#200612] font-extrabold text-[14px] px-6 py-[13px] rounded-xl">Back to home</Link>
      </div>
    );
  }

  return (
    <div className="max-w-[560px] mx-auto px-5 sm:px-8 py-[26px] pb-20">
      <h1 className="font-archivo-narrow font-bold text-[28px] sm:text-[34px] mb-1.5">Leave a review</h1>
      <p className="text-[13.5px] text-sub mb-7">Order {ref} · Thanks for shopping with us.</p>

      <div className="bg-surface rounded-2xl p-[22px] flex flex-col gap-[16px]">
        <div>
          <label className="text-[12px] font-semibold text-sub block mb-[9px]">Your rating</label>
          <StarInput value={rating} onChange={(n) => { setRating(n); setErrors((er) => ({ ...er, rating: false })); }} />
          {errors.rating && <span className="text-[11.5px] text-[#e81a2b] mt-1.5 block">Please choose a star rating.</span>}
        </div>
        <div>
          <label className="text-[12px] font-semibold text-sub block mb-[7px]">Your review</label>
          <textarea
            value={quoteText}
            onChange={(e) => { setQuoteText(e.target.value); setErrors((er) => ({ ...er, quote: false })); }}
            placeholder="What did you think of your order?"
            className="w-full h-24 resize-none bg-well border rounded-[10px] px-[14px] py-[11px] text-body font-archivo text-[13.5px] outline-none focus:border-rose-400"
            style={{ borderColor: errors.quote ? '#ff3d4d' : 'rgba(0,0,0,.12)' }}
          />
          {errors.quote && <span className="text-[11.5px] text-[#e81a2b] mt-1.5 block">Please write a short review.</span>}
        </div>
        <div>
          <label className="text-[12px] font-semibold text-sub block mb-[7px]">Display name</label>
          <input value={authorName} onChange={(e) => setAuthorName(e.target.value)} placeholder="e.g. Ibrahim N."
            className="w-full bg-well border border-[rgba(0,0,0,.12)] rounded-[10px] px-[14px] py-3 text-body font-archivo text-[14px] outline-none focus:border-rose-400" />
        </div>
        <div>
          <label className="text-[12px] font-semibold text-sub block mb-[7px]">Club / Organization <span className="text-muted font-normal">(optional)</span></label>
          <input value={authorRole} onChange={(e) => setAuthorRole(e.target.value)} placeholder="e.g. Maafushi FC"
            className="w-full bg-well border border-[rgba(0,0,0,.12)] rounded-[10px] px-[14px] py-3 text-body font-archivo text-[14px] outline-none focus:border-rose-400" />
        </div>
        <button
          onClick={submit}
          disabled={submitting}
          className="w-full mt-1 border-none bg-rose-400 text-[#200612] font-bold uppercase tracking-[.06em] text-[13.5px] py-[14px] rounded-xl cursor-pointer hover:brightness-105 transition-all disabled:opacity-60 disabled:cursor-not-allowed"
          style={{ boxShadow: '0 6px 22px rgba(193,57,120,.22)' }}
        >
          {submitting ? 'Submitting…' : 'Submit review'}
        </button>
        {apiError && <div className="text-center text-[12px] text-[#e81a2b]">{apiError}</div>}
      </div>
    </div>
  );
}

export default function ReviewPage() {
  return (
    <div className="min-h-screen bg-page text-body font-archivo">
      <Header />
      <Suspense fallback={null}>
        <ReviewForm />
      </Suspense>
      <Footer />
    </div>
  );
}
