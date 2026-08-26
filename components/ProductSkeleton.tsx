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
