'use client';
import React from 'react';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';

const SECTIONS = [
  { n: 1, title: 'What we collect', body: 'When you place an order or contact us, we collect your name, email, mobile number, delivery address (if applicable) and any notes you provide. We do not collect card or bank login details.' },
  { n: 2, title: 'How we use it', body: 'We use your details solely to process and deliver your order, send order updates, and respond to enquiries. We never sell your data.' },
  { n: 3, title: 'Payment slips', body: 'A payment slip you upload to confirm a bank transfer is sent to us only to verify and process your order. We retain it while your order is active and remove it on request.' },
  { n: 4, title: 'Your choices', body: 'You can ask us to access, correct, or delete your personal information at any time by emailing us. We keep order records as required for accounting purposes.' },
];

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-page text-body font-archivo">
      <Header />
      <div className="max-w-[760px] mx-auto px-5 sm:px-8 py-12 pb-[90px]">
        <h1 className="font-archivo-narrow font-bold text-[28px] sm:text-[40px] tracking-[.01em]">Privacy policy</h1>
        <p className="text-[13px] text-muted mt-[9px] mb-[30px]">Last updated 1 June 2026</p>
        {SECTIONS.map(s => (
          <div key={s.n} className="mb-[26px]">
            <h2 className="font-archivo-narrow font-bold text-[20px] mb-[10px]">{s.n}. {s.title}</h2>
            <p className="text-[13.5px] leading-[1.75] text-sub">{s.body}</p>
          </div>
        ))}
        <div className="bg-surface border border-[rgba(0,0,0,.08)] rounded-[14px] p-5 mt-2">
          <div className="text-[13.5px] text-sub leading-[1.6]">Questions about your data? Email <span className="text-rose-700">hello@dresscollectionmv.com</span>.</div>
        </div>
      </div>
      <Footer />
    </div>
  );
}
