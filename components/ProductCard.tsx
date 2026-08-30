import React from 'react';
import Link from 'next/link';
import { ProductImage } from '@/components/ProductImage';
import { productColorHex } from '@/lib/utils';
import { STOREFRONT_COPY_DEFAULTS } from '@/lib/storefront-copy';
import type { Product } from '@/lib/types';

const BADGE_CLASS: Record<NonNullable<Product['badge']>, string> = {
  New: 'bg-rose-500 text-onPrimary',
  Sale: 'bg-[#ff3d4d] text-white',
  'Pre-order': 'bg-[#c9a227] text-[#241608]',
};

function discountLabel(p: Product): string | null {
  if (!p.discountType) return null;
  return p.discountType === 'percent' ? `-${p.discountValue}%` : `-MVR ${p.discountValue}`;
}

/**
 * Shared editorial product tile — bare portrait photo at rest (a hover-only
 * bottom CTA bar appears on interaction), minimal type below. Used
 * everywhere a product grid renders (homepage, ready-made, casual-wear,
 * [collection], accessories, search) so the look stays identical across the
 * whole storefront. `compact` is a smaller, CTA-less variant for the
 * homepage accessories strip.
 */
export function ProductCard({ product: p, variant = 'default', viewOptionsLabel = STOREFRONT_COPY_DEFAULTS.productCatalog.viewOptionsLabel }: {
  product: Product;
  variant?: 'default' | 'compact';
  viewOptionsLabel?: string;
}) {
  const soldOut = p.status === 'soldout' || p.stock === 0;
  const href = `/product/${p.id}`;

  if (variant === 'compact') {
    return (
      <Link
        href={href}
        className="no-underline group block"
      >
        <ProductImage img={p.img} alt={p.name} className="block aspect-square rounded-[6px] relative overflow-hidden">
          {p.badge && (
            <span className={`absolute top-2 left-2 text-[8.5px] font-extrabold tracking-[.05em] uppercase px-[7px] py-[3px] rounded-[5px] ${BADGE_CLASS[p.badge]}`}>
              {p.badge}
            </span>
          )}
          <div className="absolute top-2 right-2 z-10 flex flex-col gap-1 items-end">
            {p.preOrder && p.badge !== 'Pre-order' && (
              <span className="text-[8.5px] font-extrabold tracking-[.05em] uppercase px-[7px] py-[3px] rounded-[5px] bg-[rgba(163,113,62,.92)] text-white">
                Pre-order
              </span>
            )}
            {discountLabel(p) && (
              <span className="text-[8.5px] font-extrabold tracking-[.05em] uppercase px-[7px] py-[3px] rounded-[5px] bg-[#e81a2b] text-white">
                {discountLabel(p)}
              </span>
            )}
          </div>
        </ProductImage>
        <div className="pt-[10px]">
          <div className="text-[12.5px] font-semibold text-sub whitespace-nowrap overflow-hidden text-ellipsis group-hover:text-rose-700 transition-colors">{p.name}</div>
          <div className="flex items-baseline gap-[6px] mt-[3px]">
            <div className="text-[12px] font-extrabold text-rose-700 tabular">MVR {p.effectivePrice}</div>
            {(p.discountType ? p.price : p.was) && (
              <div className="text-[10.5px] text-muted line-through tabular">MVR {p.discountType ? p.price : p.was}</div>
            )}
          </div>
        </div>
      </Link>
    );
  }

  return (
    <div className="group">
      <Link href={href} className="no-underline block relative">
        <ProductImage img={p.img} alt={p.name} className="block aspect-[4/5] rounded-[6px] relative overflow-hidden">
          {p.badge && (
            <span className={`absolute top-3 left-3 z-10 text-[10px] font-extrabold tracking-[.07em] uppercase px-[10px] py-[5px] rounded-[6px] ${BADGE_CLASS[p.badge]}`}>
              {p.badge}
            </span>
          )}
          <div className="absolute top-3 right-3 z-10 flex flex-col gap-[6px] items-end">
            {p.preOrder && p.badge !== 'Pre-order' && (
              <span className="text-[10px] font-extrabold tracking-[.07em] uppercase px-[10px] py-[5px] rounded-[6px] bg-[rgba(163,113,62,.92)] text-white">
                Pre-order
              </span>
            )}
            {discountLabel(p) && (
              <span className="text-[10px] font-extrabold tracking-[.07em] uppercase px-[10px] py-[5px] rounded-[6px] bg-[#e81a2b] text-white">
                {discountLabel(p)}
              </span>
            )}
          </div>
          {soldOut && (
            <div className="absolute inset-0 bg-[rgba(36,26,16,.5)] flex items-center justify-center z-10">
              <span className="text-[11px] font-extrabold tracking-[.1em] uppercase text-rose-50 border border-[rgba(255,255,255,.3)] px-3 py-1.5 rounded-[8px]">Sold out</span>
            </div>
          )}
          {/* Hover-only bottom CTA bar — the card is a bare photo at rest
              (matching the reference boutique's minimal product tiles); the
              "quick add" hint only appears on hover/tap-and-hold, not
              persistently, since sold-out status is already communicated by
              the centered overlay above. */}
          <div className={`absolute inset-x-0 bottom-0 py-[9px] text-center text-[10.5px] font-bold tracking-[.08em] uppercase opacity-0 group-hover:opacity-100 transition-opacity duration-200 ${soldOut ? 'bg-[rgba(36,26,16,.55)] text-white/85' : 'bg-page/92 text-body'}`}>
            {soldOut ? 'Notify me' : viewOptionsLabel}
          </div>
        </ProductImage>
      </Link>
      <div className="pt-[13px]">
        <Link href={href} className="no-underline text-body font-bold text-[14px] block hover:text-rose-600 transition-colors leading-snug">{p.name}</Link>
        {p.sub && <div className="text-[11.5px] text-muted mt-[3px]">{p.sub}</div>}
        <div className="flex items-center justify-between gap-2 mt-[8px]">
          <div className="flex items-baseline gap-[7px]">
            <span className="font-extrabold text-[15px] text-rose-700 tabular">MVR {p.effectivePrice}</span>
            {(p.discountType ? p.price : p.was) && <span className="text-[12px] text-muted line-through tabular">MVR {p.discountType ? p.price : p.was}</span>}
          </div>
          {p.colors.length > 0 && (
            <div className="flex gap-[5px]">
              {p.colors.slice(0, 5).map(c => (
                <span key={c} title={c} className="w-[11px] h-[11px] rounded-full border border-[rgba(43,28,18,.16)]" style={{ background: productColorHex(p.colorHex, c) }} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
