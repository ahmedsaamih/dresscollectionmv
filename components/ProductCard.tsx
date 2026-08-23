'use client';
import React from 'react';
import Link from 'next/link';
import { ProductImage } from '@/components/ProductImage';
import { useStore } from '@/contexts/StoreContext';
import { productColorHex } from '@/lib/utils';
import type { Product } from '@/lib/types';

const BADGE_CLASS: Record<NonNullable<Product['badge']>, string> = {
  New: 'bg-rose-500 text-[#200612]',
  Sale: 'bg-[#ff3d4d] text-white',
  'Pre-order': 'bg-[#c9a227] text-[#200612]',
};

/**
 * Shared editorial product tile — portrait image bleeding to the card edges
 * (no border), a persistent bottom CTA bar over the image, and minimal type
 * below. Used everywhere a product grid renders (homepage, ready-made,
 * casual-wear, [collection], accessories, search) so the look stays
 * identical across the whole storefront. `compact` is a smaller, CTA-less
 * variant for the homepage accessories strip.
 */
export function ProductCard({ product: p, variant = 'default' }: {
  product: Product;
  variant?: 'default' | 'compact';
}) {
  const { data } = useStore();
  const copy = data.settings.storefrontCopy.productCatalog;
  const soldOut = p.status === 'soldout' || p.stock === 0;
  const href = `/product/${p.id}`;

  if (variant === 'compact') {
    return (
      <Link
        href={href}
        className="no-underline group block"
      >
        <ProductImage img={p.img} className="block aspect-square rounded-[14px] relative overflow-hidden">
          {p.badge && (
            <span className={`absolute top-2 left-2 text-[8.5px] font-extrabold tracking-[.05em] uppercase px-[7px] py-[3px] rounded-[5px] ${BADGE_CLASS[p.badge]}`}>
              {p.badge}
            </span>
          )}
        </ProductImage>
        <div className="pt-[10px]">
          <div className="text-[12.5px] font-semibold text-[#705260] whitespace-nowrap overflow-hidden text-ellipsis group-hover:text-rose-700 transition-colors">{p.name}</div>
          <div className="text-[12px] font-extrabold text-rose-700 mt-[3px] tabular">MVR {p.price}</div>
        </div>
      </Link>
    );
  }

  return (
    <div className="group">
      <Link href={href} className="no-underline block relative">
        <ProductImage img={p.img} className="block aspect-[4/5] rounded-[16px] relative overflow-hidden">
          {p.badge && (
            <span className={`absolute top-3 left-3 z-10 text-[10px] font-extrabold tracking-[.07em] uppercase px-[10px] py-[5px] rounded-[6px] ${BADGE_CLASS[p.badge]}`}>
              {p.badge}
            </span>
          )}
          {soldOut && (
            <div className="absolute inset-0 bg-[rgba(8,8,8,.5)] flex items-center justify-center z-10">
              <span className="text-[11px] font-extrabold tracking-[.1em] uppercase text-[#ffe9f3] border border-[rgba(255,255,255,.3)] px-3 py-1.5 rounded-[8px]">Sold out</span>
            </div>
          )}
          {/* Persistent bottom CTA bar — matches the "quick add" band pattern
              from the reference boutiques; honest about what it does (goes
              to the product page, since size/colour must be chosen there). */}
          <div className={`absolute inset-x-0 bottom-0 py-[9px] text-center text-[10.5px] font-bold tracking-[.08em] uppercase transition-opacity ${soldOut ? 'bg-[rgba(0,0,0,.45)] text-white/70' : 'bg-[rgba(20,7,13,.82)] text-white group-hover:bg-[#200612]'}`}>
            {soldOut ? 'Notify me' : copy.viewOptionsLabel}
          </div>
        </ProductImage>
      </Link>
      <div className="pt-[13px]">
        <Link href={href} className="no-underline text-body font-bold text-[14px] block hover:text-rose-600 transition-colors leading-snug">{p.name}</Link>
        {p.sub && <div className="text-[11.5px] text-muted mt-[3px]">{p.sub}</div>}
        <div className="flex items-center justify-between gap-2 mt-[8px]">
          <div className="flex items-baseline gap-[7px]">
            <span className="font-extrabold text-[15px] text-rose-700 tabular">MVR {p.price}</span>
            {p.was && <span className="text-[12px] text-muted line-through tabular">MVR {p.was}</span>}
          </div>
          {p.colors.length > 0 && (
            <div className="flex gap-[5px]">
              {p.colors.slice(0, 5).map(c => (
                <span key={c} title={c} className="w-[11px] h-[11px] rounded-full border border-[rgba(0,0,0,.14)]" style={{ background: productColorHex(p.colorHex, c) }} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
