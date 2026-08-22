'use client';
import React, { useState } from 'react';
import Link from 'next/link';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { MapPin, Mail, Phone, Landmark, Check } from 'lucide-react';

const TOPICS = [
  { k: 'general', label: 'General' },
  { k: 'order',   label: 'Existing order' },
  { k: 'sizing',  label: 'Sizing help' },
  { k: 'request', label: 'Custom request' },
];
const HOURS = [
  { day: 'Saturday – Thursday', time: '10:00 – 21:00' },
  { day: 'Friday',              time: '14:00 – 21:00' },
  { day: 'Public holidays',     time: 'By appointment' },
];
const INFO = [
  { icon: MapPin, label: 'Based in',            value: 'Malé, Maldives · delivery only' },
  { icon: Mail, label: 'Email',              value: 'hello@dresscollectionmv.com' },
  { icon: Phone, label: 'Phone / WhatsApp',   value: '+960 777 0123' },
  { icon: Landmark, label: 'Bank',               value: 'BML · 7730000012345' },
];

export default function ContactPage() {
  const [name, setName]       = useState('');
  const [email, setEmail]     = useState('');
  const [topic, setTopic]     = useState('general');
  const [message, setMessage] = useState('');
  const [error, setError]     = useState('');
  const [sent, setSent]       = useState(false);

  const submit = () => {
    if (!name.trim() || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) || !message.trim()) {
      setError('Please add your name, a valid email, and a message.');
      return;
    }
    setSent(true);
  };

  return (
    <div className="min-h-screen bg-page text-body font-archivo">
      <Header active="contact" />
      <div className="max-w-[1180px] mx-auto px-5 sm:px-8 py-10 pb-[90px]">
        <h1 className="font-archivo-narrow font-bold text-[28px] sm:text-[40px] tracking-[.01em]">Get in touch</h1>
        <p className="text-[14.5px] text-sub mt-[9px] mb-[30px] max-w-[540px]">
          Questions about an order, sizing, or a custom request? Send us a message — we're online only, so this is the fastest way to reach us.
        </p>

        <div className="grid grid-cols-1 lg:grid-cols-[1.2fr_1fr] gap-7 items-start">
          {/* Form */}
          <section className="bg-surface border border-[rgba(0,0,0,.08)] rounded-[18px] p-[26px]">
            {sent ? (
              <div className="text-center py-[30px]">
                <div className="w-16 h-16 rounded-[17px] bg-rose-500 text-[#200612] inline-flex items-center justify-center animate-pop"><Check size={32} strokeWidth={3} /></div>
                <h3 className="font-archivo-narrow font-bold text-[24px] mt-[18px]">Message sent</h3>
                <p className="text-[13.5px] text-sub mt-[9px] leading-[1.55]">Thanks {name} — we will reply within one business day.</p>
                <button onClick={() => { setSent(false); setName(''); setEmail(''); setMessage(''); }}
                  className="mt-5 border border-[rgba(0,0,0,.16)] bg-transparent text-body font-bold text-[13px] px-5 py-[11px] rounded-[10px] cursor-pointer">
                  Send another
                </button>
              </div>
            ) : (
              <>
                <h2 className="font-archivo-narrow font-bold text-[20px] mb-[18px]">Send a message</h2>
                <div className="flex flex-col gap-[14px]">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-[14px]">
                    <div>
                      <label className="text-[12px] font-semibold text-sub block mb-[7px]">Name</label>
                      <input value={name} onChange={e => setName(e.target.value)} placeholder="Your name"
                        className="w-full bg-well border border-[rgba(0,0,0,.12)] rounded-[10px] px-[14px] py-3 text-body font-archivo text-[14px] outline-none focus:border-rose-500" />
                    </div>
                    <div>
                      <label className="text-[12px] font-semibold text-sub block mb-[7px]">Email</label>
                      <input value={email} onChange={e => setEmail(e.target.value)} placeholder="you@email.com"
                        className="w-full bg-well border border-[rgba(0,0,0,.12)] rounded-[10px] px-[14px] py-3 text-body font-archivo text-[14px] outline-none focus:border-rose-500" />
                    </div>
                  </div>
                  <div>
                    <label className="text-[12px] font-semibold text-sub block mb-[7px]">Topic</label>
                    <div className="flex gap-2 flex-wrap">
                      {TOPICS.map(t => {
                        const on = topic === t.k;
                        return (
                          <button key={t.k} onClick={() => setTopic(t.k)}
                            className="font-semibold text-[12.5px] px-[14px] py-2 rounded-[9px] cursor-pointer transition-all"
                            style={{ border: on ? 'none' : '1px solid rgba(0,0,0,.14)', background: on ? '#db5795' : 'transparent', color: on ? '#200612' : '#705260' }}>
                            {t.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                  <div>
                    <label className="text-[12px] font-semibold text-sub block mb-[7px]">Message</label>
                    <textarea value={message} onChange={e => setMessage(e.target.value)} placeholder="How can we help?"
                      className="w-full h-[120px] resize-none bg-well border border-[rgba(0,0,0,.12)] rounded-[10px] px-[14px] py-3 text-body font-archivo text-[14px] outline-none focus:border-rose-500" />
                  </div>
                  {error && <div className="text-[12px] text-[#e81a2b]">{error}</div>}
                  <button onClick={submit}
                    className="border-none bg-rose-500 text-[#200612] font-extrabold text-[15px] py-[14px] rounded-xl cursor-pointer shadow-rose-lg hover:brightness-105 transition-all">
                    Send message
                  </button>
                </div>
              </>
            )}
          </section>

          {/* Info */}
          <aside className="flex flex-col gap-4">
            <div className="bg-surface border border-[rgba(0,0,0,.08)] rounded-2xl p-[22px]">
              <div className="text-[11px] font-bold tracking-[.14em] uppercase text-muted mb-4">Get in touch</div>
              {INFO.map(c => (
                <div key={c.label} className="flex gap-[13px] items-start mb-[15px]">
                  <span className="w-[34px] h-[34px] rounded-[9px] flex-none bg-[rgba(219,87,149,.1)] text-rose-700 inline-flex items-center justify-center"><c.icon size={15} /></span>
                  <div>
                    <div className="text-[12px] text-muted">{c.label}</div>
                    <div className="text-[13.5px] text-body mt-[3px] font-semibold">{c.value}</div>
                  </div>
                </div>
              ))}
            </div>
            <div className="bg-surface border border-[rgba(0,0,0,.08)] rounded-2xl p-[22px]">
              <div className="text-[11px] font-bold tracking-[.14em] uppercase text-muted mb-[14px]">Support hours</div>
              {HOURS.map(h => (
                <div key={h.day} className="flex items-center justify-between py-2 border-b border-[rgba(0,0,0,.07)]">
                  <span className="text-[13px] text-sub">{h.day}</span>
                  <span className="text-[13px] text-body font-semibold tabular">{h.time}</span>
                </div>
              ))}
            </div>
            <div className="bg-[rgba(219,87,149,.06)] border border-[rgba(219,87,149,.16)] rounded-2xl p-[22px]">
              <div className="text-[13px] font-bold text-body">Online only</div>
              <div className="text-[12.5px] text-sub mt-[6px] leading-[1.6]">Dress Collection has no showroom or walk-in store — every order is packed and delivered to you across the Maldives.</div>
            </div>
          </aside>
        </div>
      </div>
      <Footer />
    </div>
  );
}
