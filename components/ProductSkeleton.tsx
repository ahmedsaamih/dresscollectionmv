import React from 'react';

/**
 * Placeholder grid shown while the live catalog loads on first paint.
 * After the initial /api/store fetch resolves, StoreContext.loading flips to
 * false and stays false across client navigation, so this only flashes once.
 */
export function ProductGridSkeleton({ count = 6, cols = 3 }: { count?: number; cols?: 3 | 4 }) {
  return (
    <div className={`grid ${cols === 4 ? 'grid-cols-4' : 'grid-cols-3'} gap-[18px]`} aria-hidden="true">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i}>
          <div className="aspect-[4/5] rounded-[16px] bg-[rgba(0,0,0,.06)] animate-pulse" />
          <div className="pt-[13px]">
            <div className="h-[14px] w-3/4 bg-[rgba(0,0,0,.08)] rounded animate-pulse" />
            <div className="h-[11px] w-1/2 bg-[rgba(0,0,0,.06)] rounded mt-2 animate-pulse" />
            <div className="h-[15px] w-1/3 bg-[rgba(0,0,0,.08)] rounded mt-[10px] animate-pulse" />
          </div>
        </div>
      ))}
    </div>
  );
}

/**
 * Placeholder shown on the product detail page while its product resolves
 * from the live catalog. Without this, a product not present in the bundled
 * static seed (i.e. any admin-added product — most of the real catalog)
 * would briefly render as whatever data.products[0] happens to be during
 * that window, since useStore() has no per-id loading signal of its own.
 */
export function ProductDetailSkeleton() {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1.05fr_.95fr] gap-12 items-start" aria-hidden="true">
      <div className="h-[520px] rounded-[18px] bg-[rgba(0,0,0,.06)] animate-pulse" />
      <div>
        <div className="h-[11px] w-1/3 bg-[rgba(0,0,0,.07)] rounded animate-pulse" />
        <div className="h-[38px] w-3/4 bg-[rgba(0,0,0,.08)] rounded mt-3 animate-pulse" />
        <div className="h-[28px] w-1/4 bg-[rgba(0,0,0,.08)] rounded mt-6 animate-pulse" />
        <div className="flex gap-[11px] mt-8">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="w-[38px] h-[38px] rounded-[10px] bg-[rgba(0,0,0,.07)] animate-pulse" />
          ))}
        </div>
        <div className="h-[52px] w-full bg-[rgba(0,0,0,.06)] rounded-xl mt-8 animate-pulse" />
      </div>
    </div>
  );
}
