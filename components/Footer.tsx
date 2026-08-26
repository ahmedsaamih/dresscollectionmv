import React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { STOREFRONT_COPY_DEFAULTS } from '@/lib/storefront-copy';
import type { StorefrontCopy, StoreCollection } from '@/lib/types';

// Matches Header.tsx's fallback — used by the handful of static pages not yet
// converted to server-fetched props.
const DEFAULT_COLLECTIONS: StoreCollection[] = [
  { id: 'cl-ready', key: 'ready', label: 'New Arrivals', sizeChartId: null },
  { id: 'cl-casual', key: 'casual', label: 'Casual Dresses', sizeChartId: null },
  { id: 'cl-occasion', key: 'occasion', label: 'Party & Occasion', sizeChartId: null },
  { id: 'cl-accessories', key: 'accessories', label: 'Accessories', sizeChartId: null },
];

interface FooterProps {
  tagline?: string;
  collections?: StoreCollection[];
  navCopy?: StorefrontCopy['homepageNavigation'];
  paymentCopy?: StorefrontCopy['paymentCheckout'];
}

export function Footer({
  tagline = '',
  collections = DEFAULT_COLLECTIONS,
  navCopy = STOREFRONT_COPY_DEFAULTS.homepageNavigation,
  paymentCopy = STOREFRONT_COPY_DEFAULTS.paymentCheckout,
}: FooterProps) {
  const copy = navCopy;

  const colHref = (key: string) =>
    key === 'ready' ? '/ready-made' : key === 'casual' ? '/casual-wear' : key === 'accessories' ? '/accessories' : `/${key}`;

  const columns = [
    {
      title: copy.footerShopTitle,
      items: collections.map(c => ({ label: c.label, href: colHref(c.key) })),
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
    <footer className="bg-[#f9f6f1] border-t border-[rgba(0,0,0,.07)] text-sub font-archivo">
      <div className="max-w-[1180px] mx-auto px-5 sm:px-8 pt-[60px] pb-[34px] grid grid-cols-2 lg:grid-cols-[1.5fr_1fr_1fr_1fr] gap-9">
        <div className="col-span-2 lg:col-span-1">
          <div className="flex items-center gap-[11px]">
            <div className="w-[38px] h-[38px] rounded-full overflow-hidden border border-[rgba(219,87,149,.22)] relative flex-none">
            <Image src="/logo-icon.png" alt="Dress Collection" fill sizes="38px" className="object-cover" />
            </div>
            <span className="font-archivo-narrow font-semibold text-[17px] tracking-[.24em] uppercase text-body">Dress Collection</span>
          </div>
          <p className="text-[13px] leading-[1.65] mt-5 max-w-[280px] text-sub">
            {tagline}. {copy.footerIntro}
          </p>
          <div className="flex gap-[9px] mt-[20px]">
            {['Ig', 'Fb', 'Wa'].map((s) => (
              <span key={s} className="w-9 h-9 rounded-full border border-[rgba(0,0,0,.1)] inline-flex items-center justify-center text-[12px] font-bold text-sub cursor-pointer hover:text-rose-700 hover:border-[rgba(219,87,149,.3)] transition-colors">
                {s}
              </span>
            ))}
          </div>
        </div>
        {columns.map((col) => (
          <div key={col.title}>
            <div className="text-[11px] font-bold tracking-[.16em] uppercase text-muted mb-[18px]">{col.title}</div>
            <div className="flex flex-col gap-[13px]">
              {col.items.map((it) => (
                <Link key={it.href} href={it.href} className="no-underline text-[13.5px] text-sub hover:text-rose-700 transition-colors">
                  {it.label}
                </Link>
              ))}
            </div>
          </div>
        ))}
      </div>
      <div className="border-t border-[rgba(0,0,0,.07)] bg-[rgba(219,87,149,.05)]">
        <div className="max-w-[1180px] mx-auto px-5 sm:px-8 py-4 flex items-center gap-[14px] flex-wrap">
          <span className="text-[10.5px] font-bold tracking-[.1em] uppercase text-rose-700 border border-[rgba(219,87,149,.3)] px-[11px] py-[6px] rounded-full">
            {paymentCopy.footerPaymentBadge}
          </span>
          <span className="text-[12.5px] text-sub">{paymentCopy.footerPaymentLine}</span>
          <span className="ml-auto text-[12px] text-muted">© {new Date().getFullYear()} Dress Collection. All rights reserved.</span>
        </div>
      </div>
    </footer>
  );
}
