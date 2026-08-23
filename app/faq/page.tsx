'use client';
import React, { useState } from 'react';
import Link from 'next/link';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';

const DATA = [
  {
    title: 'Orders & payment',
    items: [
      { q: 'How do I pay? Do you take cards?', a: 'We use manual payment only — bank transfer. No online card payment. After checkout you get a reference number to pay against.' },
      { q: 'Do I need an account?', a: 'No. Checkout is guest-only — just your name, email and mobile so we can confirm and send updates.' },
      { q: 'How do I track my order?', a: 'Use the Order Status page and enter the reference from your confirmation (DC-…). No login needed.' },
    ],
  },
  {
    title: 'Sizing & fit',
    items: [
      { q: "How do I know what size to order?", a: "Check the Size Guide on any product page — measurements are in centimetres for bust, waist and hips. Still unsure? Contact us with your measurements and we'll help you pick." },
      { q: 'Do you offer petite sizing?', a: 'Yes — select styles are available in our Petite fit, cut shorter through the body. Check the size chart on the product page.' },
    ],
  },
  {
    title: 'Delivery & returns',
    items: [
      { q: 'Do you deliver across the Maldives?', a: 'Yes, island delivery is a flat MVR 75 and typically takes 1–3 days in Greater Malé, 3–7 days to outer atolls. We are delivery-only — there is no pickup or showroom.' },
      { q: "What's your return policy?", a: 'Items can be exchanged within 7 days if unworn with tags. Made-to-order or altered pieces cannot be returned unless faulty.' },
    ],
  },
];

export default function FAQPage() {
  const [open, setOpen] = useState('0-0');

  return (
    <div className="min-h-screen bg-page text-body font-archivo">
      <Header />
      <div className="max-w-[820px] mx-auto px-5 sm:px-8 py-[52px] pb-[90px]">
        <h1 className="font-archivo-narrow font-bold text-[30px] sm:text-[42px] tracking-[.01em] text-center">Frequently asked questions</h1>
        <p className="text-[14.5px] text-sub mt-[11px] text-center mb-9">Everything about ordering, sizing, payment and delivery.</p>

        {DATA.map((g, gi) => (
          <div key={gi} className="mb-[30px]">
            <div className="text-[12px] font-bold tracking-[.14em] uppercase text-rose-600 mb-3">{g.title}</div>
            <div className="bg-surface rounded-2xl overflow-hidden">
              {g.items.map((item, ii) => {
                const key = `${gi}-${ii}`;
                const on = open === key;
                return (
                  <div key={ii} className="border-b border-[rgba(0,0,0,.08)] last:border-0">
                    <button onClick={() => setOpen(on ? '' : key)}
                      className="w-full flex items-center justify-between gap-[14px] bg-transparent border-none text-body font-semibold text-[14.5px] px-5 py-[18px] cursor-pointer text-left">
                      {item.q}
                      <span className="text-rose-700 text-[20px] flex-none">{on ? '–' : '+'}</span>
                    </button>
                    {on && <div className="text-[13.5px] leading-[1.7] text-sub px-5 pb-[18px]">{item.a}</div>}
                  </div>
                );
              })}
            </div>
          </div>
        ))}

        <div className="text-center bg-surface rounded-2xl py-9 px-6">
          <div className="font-bold text-[17px]">Still have a question?</div>
          <Link href="/contact" className="inline-block mt-4 no-underline bg-rose-500 text-[#200612] font-bold uppercase tracking-[.06em] text-[12.5px] px-6 py-3 rounded-full hover:brightness-105 transition-all">
            Contact us
          </Link>
        </div>
      </div>
      <Footer />
    </div>
  );
}
