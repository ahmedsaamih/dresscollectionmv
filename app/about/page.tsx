'use client';
import React from 'react';
import Link from 'next/link';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { Store, ShieldCheck, Tag } from 'lucide-react';

const stats = [
  { value: '5k+',  label: 'Dresses shipped' },
  { value: '20+',  label: 'New styles a month' },
  { value: '1–3d', label: 'Greater Malé delivery' },
  { value: '100%', label: 'Online, no showroom' },
];
const values = [
  { icon: Store, title: 'Curated, not mass-produced', body: 'Every piece is picked for fit, fabric and finish — a tight edit instead of an endless scroll.' },
  { icon: ShieldCheck, title: 'Quality you can trust', body: 'We check every dress before it ships, so what arrives matches what you saw online.' },
  { icon: Tag, title: 'Honest pricing', body: 'Clear prices with no hidden fees — what you see at checkout is what you pay.' },
];
const process = [
  { step: 'STEP 1', title: 'Browse',   body: 'Shop new arrivals, casual dresses or occasion wear.' },
  { step: 'STEP 2', title: 'Order',    body: 'Guest checkout, no account needed. Pay by bank transfer.' },
  { step: 'STEP 3', title: 'We pack',  body: 'Your order is checked and packed with care.' },
  { step: 'STEP 4', title: 'Delivered', body: 'Shipped to your door across the Maldives.' },
];

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-page text-body font-archivo">
      <Header active="about" />

      {/* hero */}
      <div className="border-b border-[rgba(0,0,0,.07)] relative overflow-hidden" style={{ background: 'radial-gradient(800px 400px at 75% 0%,rgba(219,87,149,.1),transparent 60%)' }}>
        <div className="max-w-[1180px] mx-auto px-5 sm:px-8 py-[72px] relative">
          <div className="inline-flex items-center gap-[9px] text-[12px] font-bold tracking-[.18em] uppercase text-rose-600 mb-[18px]">
            <span className="w-[22px] h-[2px] bg-rose-500" style={{ transform: 'skewX(-24deg)' }} />
            Our story
          </div>
          <h1 className="font-archivo font-black text-[36px] sm:text-[56px] leading-[.98] tracking-[-0.03em] max-w-[680px] text-balance">
            A dress shop that lives<br /><span className="text-rose-700">entirely online.</span>
          </h1>
          <p className="text-[16px] leading-[1.65] text-sub mt-[22px] max-w-[560px]">
            Dress Collection is a Maldives-based womenswear boutique with no physical store — just a tightly curated collection of dresses, delivered to your door. We started because we wanted shopping for a dress to feel as easy as scrolling your phone.
          </p>
        </div>
      </div>

      {/* stats */}
      <div className="max-w-[1180px] mx-auto px-5 sm:px-8 py-[48px]">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-[18px]">
          {stats.map(s => (
            <div key={s.label} className="bg-surface rounded-2xl p-6">
              <div className="font-archivo-narrow font-bold text-[38px] text-rose-700 tracking-[.01em]">{s.value}</div>
              <div className="text-[12.5px] text-sub mt-1.5 leading-[1.4]">{s.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* values */}
      <div className="max-w-[1180px] mx-auto px-5 sm:px-8 pb-[48px]">
        <h2 className="font-archivo-narrow font-bold text-[30px] mb-[22px]">What we stand for</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-[18px]">
          {values.map(v => (
            <div key={v.title} className="bg-surface rounded-2xl p-6 transition-shadow hover:shadow-card-hover">
              <div className="w-[46px] h-[46px] rounded-xl bg-[rgba(219,87,149,.1)] flex items-center justify-center text-rose-700"><v.icon size={22} /></div>
              <div className="font-extrabold text-[16px] mt-4">{v.title}</div>
              <div className="text-[13px] text-[#705260] mt-2 leading-[1.6]">{v.body}</div>
            </div>
          ))}
        </div>
      </div>

      {/* process */}
      <div className="max-w-[1180px] mx-auto px-5 sm:px-8 pb-[60px]">
        <div className="border border-[rgba(219,87,149,.16)] rounded-[20px] p-[38px_40px]" style={{ background: 'linear-gradient(135deg,#fbeaf2,#f7f2f4)' }}>
          <h2 className="font-archivo-narrow font-bold text-[28px] mb-[26px]">How it works</h2>
          <div className="grid grid-cols-4 gap-5">
            {process.map(p => (
              <div key={p.step}>
                <div className="font-archivo-narrow font-bold text-[15px] text-rose-700 tracking-[.04em]">{p.step}</div>
                <div className="font-bold text-[15px] mt-2">{p.title}</div>
                <div className="text-[12.5px] text-[#705260] mt-[7px] leading-[1.55]">{p.body}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* CTA */}
      <div className="max-w-[1180px] mx-auto px-5 sm:px-8 pb-[72px]">
        <div className="text-center bg-surface rounded-[20px] py-[52px] px-8">
          <h2 className="font-archivo-narrow font-bold text-[30px]">Ready to find your next dress?</h2>
          <div className="flex gap-3 justify-center mt-[22px] flex-wrap">
            <Link href="/ready-made" className="no-underline bg-rose-500 text-[#200612] font-extrabold text-[14px] px-[26px] py-[14px] rounded-xl hover:brightness-105 transition-all">Shop new arrivals</Link>
            <Link href="/contact" className="no-underline border border-[rgba(0,0,0,.16)] text-body font-bold text-[14px] px-[26px] py-[14px] rounded-xl hover:border-[rgba(0,0,0,.3)] transition-colors">Talk to us</Link>
          </div>
        </div>
      </div>

      <Footer />
    </div>
  );
}
