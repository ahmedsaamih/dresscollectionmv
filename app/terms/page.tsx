'use client';
import React from 'react';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';

const SECTIONS = [
  { n: 1, title: 'Orders & acceptance', body: 'Placing an order does not form a binding contract until we confirm it. We reserve the right to decline or cancel an order, in which case any payment received is refunded in full.' },
  { n: 2, title: 'Pricing & payment', body: 'Prices are shown in Maldivian Rufiyaa (MVR). We accept bank transfer only; we never process card payments through this site.' },
  { n: 3, title: 'Made-to-order goods', body: 'Made-to-order or altered items are produced to your specification and cannot be cancelled, returned or refunded once production has started, except where the item is faulty or differs materially from what was agreed.' },
  { n: 4, title: 'Shipping & delivery', body: 'Dress Collection is delivery-only — we have no physical store. Every order is shipped to the address you provide at checkout.' },
  { n: 5, title: 'Liability', body: 'Our liability for any order is limited to the amount paid for that order. We are not liable for delays caused by ferry schedules, weather, or other events beyond our reasonable control.' },
];

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-page text-body font-archivo">
      <Header />
      <div className="max-w-[760px] mx-auto px-5 sm:px-8 py-[52px] pb-[90px]">
        <h1 className="font-archivo-narrow font-bold text-[28px] sm:text-[40px] tracking-[.01em]">Terms of service</h1>
        <p className="text-[12px] font-bold uppercase tracking-[.08em] text-muted mt-[9px] mb-[30px]">Last updated 1 June 2026</p>
        {SECTIONS.map(s => (
          <div key={s.n} className="mb-[26px]">
            <h2 className="font-archivo-narrow font-bold text-[20px] mb-[10px]">{s.n}. {s.title}</h2>
            <p className="text-[13.5px] leading-[1.75] text-sub">{s.body}</p>
          </div>
        ))}
      </div>
      <Footer />
    </div>
  );
}
