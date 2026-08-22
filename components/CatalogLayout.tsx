'use client';
import React, { useMemo, useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { useStore } from '@/contexts/StoreContext';
import { ProductGridSkeleton } from '@/components/ProductSkeleton';
import { Button } from '@/components/Button';
import { SizeChartTrigger } from '@/components/SizeChart';
import { Check } from 'lucide-react';
import { COLOR_MAP, PRODUCT_SIZES } from '@/lib/utils';
import type { Product, SizeChart } from '@/lib/types';

const SORT_OPTIONS = [
  { k: 'new', label: 'Newest' },
  { k: 'low', label: 'Price ↑' },
  { k: 'high', label: 'Price ↓' },
] as const;
type SortKey = (typeof SORT_OPTIONS)[number]['k'];

export interface CatalogLayoutProps {
  breadcrumb: string;
  title: string;
  subtitle?: React.ReactNode;
  /** Label for the category facet — e.g. "Sport", "Type". */
  categoryLabel?: string;
  /** Base product list (already scoped to a collection, or search results). */
  products: Product[];
  loading?: boolean;
  renderCard: (p: Product) => React.ReactNode;
  /** Optional banner/extra shown under the header. */
  intro?: React.ReactNode;
  /** Optional element rendered in the header's right-hand action row, next to Sort. */
  headerAction?: React.ReactNode;
  noun?: string;        // "kits" | "items" — used in counts + load more
  pageSize?: number;    // initial visible count (default 9)
  /** Effective size chart for this catalog's collection (assigned, or the store default). */
  sizeChart?: SizeChart | null;
}

/**
 * Uniform catalog page scaffold: breadcrumb + title + sort, a filter sidebar
 * (category / colour / size / price) auto-derived from the products, and a
 * responsive grid with load-more, skeleton and empty states. Each page supplies
 * its own card via `renderCard`, so context-specific affordances (add-print,
 * notify, badges) are preserved while the filtering is identical everywhere.
 */
export function CatalogLayout({
  breadcrumb, title, subtitle, categoryLabel = 'Category',
  products, loading = false, renderCard, intro, headerAction, noun = 'items', pageSize = 9, sizeChart = null,
}: CatalogLayoutProps) {
  const { data } = useStore();
  const copy = data.settings.storefrontCopy.productCatalog;
  const [cats, setCats] = useState<string[]>([]);
  const [colors, setColors] = useState<string[]>([]);
  const [sizes, setSizes] = useState<string[]>([]);
  const [priceMax, setPriceMax] = useState<number | null>(null);
  const [sort, setSort] = useState<SortKey>('new');
  const [limit, setLimit] = useState(pageSize);

  const colorHex = (name: string) => COLOR_MAP[name] ?? '#888';

  const facets = useMemo(() => {
    const categoryList = [...new Set(products.map(p => p.category))];
    const colorList = [...new Set(products.flatMap(p => p.colors))];
    const sizeList = [...new Set(products.flatMap(p => p.sizes))].sort((a, b) => PRODUCT_SIZES.indexOf(a) - PRODUCT_SIZES.indexOf(b));
    const prices = products.map(p => p.price);
    const priceMin = prices.length ? Math.floor(Math.min(...prices) / 10) * 10 : 0;
    const priceCeil = prices.length ? Math.ceil(Math.max(...prices) / 10) * 10 : 1000;
    return { categoryList, colorList, sizeList, priceMin, priceCeil };
  }, [products]);

  const effMax = priceMax ?? facets.priceCeil;

  const toggle = (val: string, arr: string[], set: (a: string[]) => void) => {
    set(arr.includes(val) ? arr.filter(x => x !== val) : [...arr, val]);
    setLimit(pageSize);
  };

  const filtered = useMemo(() => {
    let r = products.filter(p => {
      if (cats.length && !cats.includes(p.category)) return false;
      if (colors.length && !p.colors.some(c => colors.includes(c))) return false;
      if (sizes.length && !p.sizes.some(s => sizes.includes(s))) return false;
      if (p.price > effMax) return false;
      return true;
    });
    if (sort === 'low') r = [...r].sort((a, b) => a.price - b.price);
    else if (sort === 'high') r = [...r].sort((a, b) => b.price - a.price);
    return r;
  }, [products, cats, colors, sizes, effMax, sort]);

  const visible = filtered.slice(0, limit);
  const anyFilter = cats.length > 0 || colors.length > 0 || sizes.length > 0 || (priceMax !== null && priceMax < facets.priceCeil);
  const clear = () => { setCats([]); setColors([]); setSizes([]); setPriceMax(null); setLimit(pageSize); };

  // Identifies a distinct filter/sort view — changing any of these (but not
  // `limit`) means the whole grid should re-stagger, not just append.
  const sortKey = `${sort}|${cats.join(',')}|${colors.join(',')}|${sizes.join(',')}|${priceMax}`;

  // Choreographs entrance for cards that appear after the very first paint —
  // a sort/filter change (whole grid re-staggers) or "Load more" (only the
  // newly-appended cards stagger in). The first paint itself is left alone:
  // useReveal()'s GSAP pass already reveals data-motion-card on mount, and
  // animating it a second time here would double it up.
  const prevVisibleIdsRef = useRef<Set<string> | null>(null);
  const prevSortKeyRef = useRef(sortKey);
  const newCardIds = useMemo(() => {
    if (prevVisibleIdsRef.current === null) return new Set<string>();
    const filterChanged = prevSortKeyRef.current !== sortKey;
    const prevIds = filterChanged ? new Set<string>() : prevVisibleIdsRef.current;
    return new Set(visible.filter(p => !prevIds.has(p.id)).map(p => p.id));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, sortKey]);
  useEffect(() => {
    prevSortKeyRef.current = sortKey;
    prevVisibleIdsRef.current = new Set(visible.map(p => p.id));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, sortKey]);

  const showCategory = facets.categoryList.length > 0;
  const showColour = facets.colorList.length > 0;
  const showSize = facets.sizeList.length > 0;
  const showPrice = facets.priceCeil > facets.priceMin;

  return (
    <div className="max-w-[1180px] mx-auto px-5 sm:px-8 py-[26px] pb-20">
      {/* Breadcrumb */}
      <div className="text-[12.5px] text-muted mb-[18px]">
        <Link href="/" className="text-muted no-underline hover:text-rose-700">Home</Link>
        <span className="mx-[7px]">/</span><span className="text-sub">{breadcrumb}</span>
      </div>

      {/* Header */}
      <div className="flex items-end justify-between flex-wrap gap-[14px] mb-[20px]">
        <div>
          <h1 data-reveal className="font-archivo-narrow font-bold text-[30px] sm:text-[40px] tracking-[.01em]">{title}</h1>
          {subtitle && <p className="text-[14px] text-sub mt-2 max-w-[620px]">{subtitle}</p>}
        </div>
        <div className="flex items-center gap-[14px] flex-wrap">
          <div className="flex items-center gap-[10px]">
            <span className="text-[12.5px] text-muted">Sort</span>
            <div className="flex gap-[6px]">
              {SORT_OPTIONS.map(s => (
                <button key={s.k} onClick={() => setSort(s.k)}
                  className={`border font-semibold text-[12.5px] px-[13px] py-2 rounded-[9px] cursor-pointer transition-all ${sort === s.k ? 'bg-[rgba(219,87,149,.12)] border-[rgba(219,87,149,.4)] text-rose-700' : 'bg-transparent border-[rgba(0,0,0,.1)] text-sub hover:border-[rgba(219,87,149,.3)]'}`}>
                  {s.label}
                </button>
              ))}
            </div>
          </div>
          {headerAction}
        </div>
      </div>

      {intro && <div className="mb-[20px]">{intro}</div>}

      <div className="grid grid-cols-1 lg:grid-cols-[236px_1fr] gap-7 items-start">
        {/* Filters */}
        <aside className="lg:sticky lg:top-[84px] bg-surface border border-[rgba(0,0,0,.08)] rounded-2xl p-5">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[13px] font-extrabold tracking-[.04em]">Filters</span>
            {anyFilter && <button onClick={clear} className="border-none bg-transparent text-rose-700 font-semibold text-[12px] cursor-pointer">Clear all</button>}
          </div>

          {showCategory && (
            <div className="mt-4">
              <div className="text-[11px] font-bold tracking-[.14em] uppercase text-muted mb-[11px]">{categoryLabel}</div>
              <div className="flex flex-col gap-[9px]">
                {facets.categoryList.map(cat => {
                  const on = cats.includes(cat);
                  const count = products.filter(p => p.category === cat).length;
                  return (
                    <label key={cat} onClick={() => toggle(cat, cats, setCats)} className="flex items-center gap-[10px] cursor-pointer text-[13px]" style={{ color: on ? '#150d11' : '#705260' }}>
                      <span className="w-[17px] h-[17px] rounded-[5px] flex-none flex items-center justify-center"
                        style={{ border: on ? 'none' : '2px solid rgba(0,0,0,.18)', background: on ? '#db5795' : 'transparent', color: '#200612' }}>{on && <Check size={11} strokeWidth={3} />}</span>
                      <span className="flex-1">{cat}</span>
                      <span className="text-[11px] text-[#b29fa8] tabular">{count}</span>
                    </label>
                  );
                })}
              </div>
            </div>
          )}

          {showColour && (
            <>
              <div className="h-px bg-[rgba(0,0,0,.07)] my-[18px]" />
              <div>
                <div className="text-[11px] font-bold tracking-[.14em] uppercase text-muted mb-[11px]">Colour</div>
                <div className="flex flex-wrap gap-[9px]">
                  {facets.colorList.map(c => {
                    const on = colors.includes(c);
                    return (
                      <span key={c} onClick={() => toggle(c, colors, setColors)} title={c}
                        className="w-7 h-7 rounded-[8px] cursor-pointer transition-all"
                        style={{ background: colorHex(c), boxShadow: on ? '0 0 0 2px #ffffff,0 0 0 4px #db5795' : '0 0 0 1px rgba(0,0,0,.14)' }} />
                    );
                  })}
                </div>
              </div>
            </>
          )}

          {showSize && (
            <>
              <div className="h-px bg-[rgba(0,0,0,.07)] my-[18px]" />
              <div>
                <div className="flex items-center justify-between mb-[11px]">
                  <div className="text-[11px] font-bold tracking-[.14em] uppercase text-muted">Size</div>
                  <SizeChartTrigger chart={sizeChart} label="Chart" />
                </div>
                <div className="flex flex-wrap gap-[7px]">
                  {facets.sizeList.map(s => {
                    const on = sizes.includes(s);
                    return (
                      <button key={s} onClick={() => toggle(s, sizes, setSizes)}
                        className="font-bold text-[12px] min-w-[38px] px-[8px] h-[34px] rounded-[8px] cursor-pointer transition-all"
                        style={{ border: on ? 'none' : '1px solid rgba(0,0,0,.14)', background: on ? '#db5795' : 'transparent', color: on ? '#200612' : '#705260' }}>{s}</button>
                    );
                  })}
                </div>
              </div>
            </>
          )}

          {showPrice && (
            <>
              <div className="h-px bg-[rgba(0,0,0,.07)] my-[18px]" />
              <div>
                <div className="flex items-center justify-between mb-3">
                  <span className="text-[11px] font-bold tracking-[.14em] uppercase text-muted">Max price</span>
                  <span className="text-[12px] font-bold text-rose-700 tabular">MVR {effMax}</span>
                </div>
                <input type="range" min={facets.priceMin} max={facets.priceCeil} step={10} value={effMax}
                  onChange={e => { setPriceMax(+e.target.value); setLimit(pageSize); }}
                  className="w-full cursor-pointer accent-rose-500" />
                <div className="flex justify-between text-[10.5px] text-[#b29fa8] mt-1.5"><span>{facets.priceMin}</span><span>{facets.priceCeil}</span></div>
              </div>
            </>
          )}
        </aside>

        {/* Grid */}
        <div>
          <div className="text-[12.5px] text-muted mb-[14px]">Showing {visible.length} of {filtered.length} {noun}</div>
          {loading ? (
            <ProductGridSkeleton count={9} cols={3} />
          ) : filtered.length > 0 ? (
            <>
              <div className="grid grid-cols-1 min-[380px]:grid-cols-2 lg:grid-cols-3 gap-[18px]">
                {(() => {
                  let newIndex = 0;
                  return visible.map(p => {
                    const isNew = newCardIds.has(p.id);
                    const delay = isNew ? Math.min(newIndex * 0.06, 0.36) : 0;
                    if (isNew) newIndex++;
                    return (
                      <div
                        key={p.id}
                        data-motion-card
                        className={isNew ? 'animate-fade-up' : undefined}
                        style={isNew ? { animationDelay: `${delay}s` } : undefined}
                      >
                        {renderCard(p)}
                      </div>
                    );
                  });
                })()}
              </div>
              {filtered.length > limit && (
                <div className="flex justify-center mt-[30px]">
                  <Button variant="tertiary" size="sm" onClick={() => setLimit(l => l + 6)}>
                    {copy.loadMoreLabel} {noun}
                  </Button>
                </div>
              )}
            </>
          ) : (
            <div className="border border-dashed border-[rgba(0,0,0,.14)] rounded-2xl p-16 text-center">
              <div className="w-14 h-14 rounded-[14px] bg-[rgba(0,0,0,.07)] inline-flex items-center justify-center text-muted text-[26px]">⌀</div>
              <div className="font-bold text-[17px] mt-4">{copy.noItemsTitle.replace('items', noun)}</div>
              <div className="text-[13px] text-[#705260] mt-[6px]">{copy.noItemsBody}</div>
              {anyFilter && <Button size="xs" onClick={clear} className="mt-[18px]">{copy.clearFiltersLabel}</Button>}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
