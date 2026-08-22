'use client';
import React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useStore } from '@/contexts/StoreContext';

export function Footer() {
  const { data } = useStore();
  const copy = data.settings.storefrontCopy.homepageNavigation;
  const paymentCopy = data.settings.storefrontCopy.paymentCheckout;

  const colHref = (key: string) =>
    key === 'ready' ? '/ready-made' : key === 'casual' ? '/casual-wear' : key === 'accessories' ? '/accessories' : `/${key}`;

  const columns = [
    {
      title: copy.footerShopTitle,
      items: data.collections.map(c => ({ label: c.label, href: colHref(c.key) })),
    },
    {
      title: copy.footerSupportTitle,
      items: [
        { label: copy.statusLabel, href: '/status' },
        { label: copy.supportSizeGuideLabel, href: '/size-guide' },
        { label: copy.supportShippingLabel, href: '/shipping' },
        { label: copy.supportFaqLabel, href: '/faq' },
      ],
    },
    {
      title: copy.footerCompanyTitle,
      items: [
        { label: 'About',   href: '/about' },
        { label: 'Contact', href: '/contact' },
        { label: 'Terms',   href: '/terms' },
        { label: 'Privacy', href: '/privacy' },
      ],
    },
  ];

  return (
    <footer className="bg-surface border-t border-[rgba(0,0,0,.08)] text-sub font-archivo">
      <div className="max-w-[1180px] mx-auto px-5 sm:px-8 pt-[54px] pb-[30px] grid grid-cols-2 lg:grid-cols-[1.5fr_1fr_1fr_1fr] gap-9">
        <div className="col-span-2 lg:col-span-1">
          <div className="flex items-center gap-[11px]">
            <div className="w-[38px] h-[38px] rounded-full overflow-hidden border border-[rgba(219,87,149,.22)] relative flex-none">
            <Image src="/logo-icon.png" alt="Dress Collection" fill sizes="38px" className="object-cover" />
            </div>
            <span className="font-archivo-narrow font-bold text-[17px] tracking-[.13em] uppercase text-body">Dress Collection</span>
          </div>
          <p className="text-[13px] leading-[1.65] mt-4 max-w-[280px] text-sub">
            {data.settings.tagline}. {copy.footerIntro}
          </p>
          <div className="flex gap-[9px] mt-[18px]">
            {['Ig', 'Fb', 'Wa'].map((s) => (
              <span key={s} className="w-9 h-9 rounded-[9px] border border-[rgba(0,0,0,.1)] inline-flex items-center justify-center text-[13px] text-sub cursor-pointer hover:text-rose-700 hover:border-[rgba(219,87,149,.3)] transition-colors">
                {s}
              </span>
            ))}
          </div>
        </div>
        {columns.map((col) => (
          <div key={col.title}>
            <div className="text-[11px] font-bold tracking-[.16em] uppercase text-muted mb-4">{col.title}</div>
            <div className="flex flex-col gap-[11px]">
              {col.items.map((it) => (
                <Link key={it.href} href={it.href} className="no-underline text-[13.5px] text-sub hover:text-rose-700 transition-colors">
                  {it.label}
                </Link>
              ))}
            </div>
          </div>
        ))}
      </div>
      <div className="border-t border-[rgba(0,0,0,.07)] bg-[rgba(219,87,149,.06)]">
        <div className="max-w-[1180px] mx-auto px-5 sm:px-8 py-4 flex items-center gap-[14px] flex-wrap">
          <span className="text-[11.5px] font-bold tracking-[.06em] uppercase text-rose-700 border border-[rgba(219,87,149,.3)] px-[10px] py-[5px] rounded-[7px]">
            {paymentCopy.footerPaymentBadge}
          </span>
          <span className="text-[12.5px] text-sub">{paymentCopy.footerPaymentLine}</span>
          <span className="ml-auto text-[12px] text-muted">© {new Date().getFullYear()} Dress Collection. All rights reserved.</span>
        </div>
      </div>
    </footer>
  );
}
