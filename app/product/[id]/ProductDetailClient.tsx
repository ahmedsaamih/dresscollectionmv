'use client';
import React, { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { Toast } from '@/components/Toast';
import { Button } from '@/components/Button';
import { ProductImage } from '@/components/ProductImage';
import { SizeChartTrigger } from '@/components/SizeChart';
import { MMCart, groupFixedLines } from '@/lib/cart';
import { useCart } from '@/contexts/CartContext';
import { useReveal } from '@/lib/useReveal';
import { formatMVR, productColorHex, LOW_STOCK_THRESHOLD, STOCK_BAR_MAX } from '@/lib/utils';
import { Store, Home, Undo2, Check } from 'lucide-react';
import { StarRating } from '@/components/StarRating';
import { ProductCard } from '@/components/ProductCard';
import type { Product, StoreSetting, StoreCollection, SizeChart } from '@/lib/types';

const ACCORDIONS = [
  { title: 'Description', body: 'A soft, breathable weave that moves with you — cut for an easy, flattering fit in tropical heat.' },
  { title: 'Fabric & care', body: 'Machine wash cold, inside out, with similar colours. Do not tumble dry. Hang to dry and iron on a low heat if needed.' },
  { title: 'Shipping & delivery', body: 'Ships across the Maldives in 1–3 days. Delivery only — no pickup or showroom. Bank transfer, no card needed.' },
];

const COLLECTION_PATHS: Record<string, string> = {
  ready: '/ready-made',
  casual: '/casual-wear',
  accessories: '/accessories',
};

const collectionHref = (key: string) => COLLECTION_PATHS[key] ?? `/${key}`;

function StockBar({ stock }: { stock: number }) {
  const pct = Math.min(100, (stock / STOCK_BAR_MAX) * 100);
  const color = stock === 0 ? '#b80f1d' : stock <= LOW_STOCK_THRESHOLD ? '#e81a2b' : '#db5795';
  return (
    <div className="w-full">
      <div className="h-[5px] rounded-full bg-[rgba(0,0,0,.08)] overflow-hidden">
        <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: color }} />
      </div>
      {stock <= LOW_STOCK_THRESHOLD && (
        <div className="text-[10.5px] font-bold mt-[3px]" style={{ color }}>
          {stock === 0 ? 'Out of stock' : `Only ${stock} left`}
        </div>
      )}
    </div>
  );
}

interface ProductDetailClientProps {
  settings: StoreSetting;
  collections: StoreCollection[];
  product: Product | null;
  chart: SizeChart | null;
  related: Product[];
}

export function ProductDetailClient({ settings, collections, product, chart, related }: ProductDetailClientProps) {
  const { cart } = useCart();
  const copy = settings.storefrontCopy.productCatalog;
  const depositCopy = settings.storefrontCopy.paymentCheckout;
  const navCopy = settings.storefrontCopy.homepageNavigation;
  useReveal();

  // Every hook below must run unconditionally regardless of whether the
  // server actually resolved a product, so state/effects are seeded with
  // null-safe fallbacks; the not-found branch renders only after all hooks
  // have been called (Rules of Hooks).
  const [color, setColor]     = useState(product?.colors[0] ?? '');
  const [sizes, setSizes]     = useState<Record<string, number>>({});
  const [qty, setQty]         = useState(1);
  const [activeImg, setActiveImg] = useState(product?.img ?? '');
  const [openAcc, setOpenAcc] = useState(0);
  const [sizeError, setSizeError] = useState(false);
  const [toast, setToast]     = useState(false);
  const [justAdded, setJustAdded] = useState(false);

  useEffect(() => {
    if (!product) return;
    if (product.colors.length > 0 && !product.colors.includes(color)) setColor(product.colors[0]);
  }, [product, color]);

  useEffect(() => {
    if (!product) return;
    setActiveImg(product.colorImages?.[color] || product.img);
  }, [color, product]);

  const addedGroups = useMemo(
    () => (product ? groupFixedLines(cart.fixed.filter(i => i.sku === product.id)) : []),
    [cart.fixed, product]
  );

  if (!product) {
    return (
      <div className="min-h-screen bg-page text-body font-archivo">
        <Header tagline={settings.tagline} collections={collections} navCopy={navCopy} />
        <div className="max-w-[1180px] mx-auto px-5 sm:px-8 py-[26px] pb-20">
          <div className="text-center py-20">
            <div className="font-archivo-narrow font-bold text-[26px]">Product not found</div>
            <div className="text-[13.5px] text-sub mt-2">It may have been removed or the link is out of date.</div>
            <Link href="/ready-made" className="inline-block mt-6 no-underline bg-rose-500 text-onPrimary font-extrabold text-[13.5px] px-[22px] py-3 rounded-xl">Browse Ready-Made</Link>
          </div>
        </div>
        <Footer tagline={settings.tagline} collections={collections} navCopy={navCopy} paymentCopy={depositCopy} />
      </div>
    );
  }

  const colorHex = (name: string) => productColorHex(product.colorHex, name);
  const colMeta = collections.find(c => c.key === product.collection);
  const colLabel = colMeta?.label ?? product.collection;
  const isCasual = product.collection === 'casual';

  const displayPrice = product.effectivePrice;

  // Quantity of this exact sku+color+size already sitting in the customer's
  // own cart — subtracted from the raw DB stock so the picker can't be
  // re-used to add more than what's really left.
  const cartQtyFor = (c: string, s: string) =>
    cart.fixed.filter(i => i.sku === product.id && i.color === c && i.size === s).reduce((a, i) => a + i.qty, 0);

  const stockForSize = (s: string) =>
    Math.max(0, ((product.colorSizeStock?.[color] ?? {})[s] ?? 0) - cartQtyFor(color, s));

  // Sizes actually orderable in the selected colour — out-of-stock sizes are hidden
  // from the picker entirely rather than shown disabled.
  const availableSizes = product.sizes.filter(s => stockForSize(s) > 0);
  // A sized product where every size is sold out in this colour: distinct from the
  // "no sizes configured at all" (accessory-style) case below, which stays as-is.
  const noStockForColor = product.sizes.length > 0 && availableSizes.length === 0;

  // Compact "S2 M4 L4"-style label — matches the format used in
  // app/casual-wear/page.tsx's inline equivalent.
  const sizesLabelStr = product.sizes.filter(s => sizes[s]).map(s => s + sizes[s]).join(' ');

  // Real total price to charge/display, summed per-size. Falls back to
  // today's displayPrice * qty for zero-size products.
  const lineTotal = product.sizes.length > 0
    ? Object.entries(sizes).reduce((sum, [, q]) => sum + displayPrice * q, 0)
    : displayPrice * qty;

  const addToCart = () => {
    if (noStockForColor) return;
    if (product.sizes.length > 0) {
      const entries = Object.entries(sizes).filter(([, q]) => q > 0);
      if (entries.length === 0) { setSizeError(true); return; }
      entries.forEach(([s, q]) => {
        MMCart.addFixed({ sku: product.id, name: product.name, meta: product.sub, price: displayPrice, img: activeImg, size: s, color, qty: q });
      });
      setSizes({});
    } else {
      if (stockForSize('') === 0) return;
      MMCart.addFixed({ sku: product.id, name: product.name, meta: product.sub, price: displayPrice, img: activeImg, size: '', color, qty });
      setQty(1);
    }
    setToast(true);
    setJustAdded(true);
    setTimeout(() => setJustAdded(false), 1100);
  };

  // Swapped into every "Add to Cart" button's label for a moment after a
  // successful add — a quick, low-key companion to the toast (which some
  // users won't look at if their eyes stay on the button they just pressed).
  const addToCartLabel = justAdded
    ? <span className="inline-flex items-center gap-[7px]"><Check key="added-check" size={16} strokeWidth={3} className="animate-tick-pop" /> Added</span>
    : noStockForColor ? 'Out of Stock' : <>Add to Cart · {formatMVR(lineTotal)}</>;
  const addToCartLabelCompact = justAdded
    ? <span className="inline-flex items-center gap-[6px]"><Check key="added-check-sm" size={14} strokeWidth={3} className="animate-tick-pop" /> Added</span>
    : noStockForColor ? 'Out of Stock' : 'Add to Cart';

  const defaultAccordions = product.collection === 'accessories'
    ? [
        { title: copy.accordionDescriptionTitle, body: `${product.name} ${copy.accessoriesDescriptionBody}` },
        { title: copy.accordionCareTitle, body: 'Keep dry and clean gently as needed. Follow any product-specific care guidance included with your delivery.' },
        { title: copy.accordionShippingTitle, body: copy.accordionShippingBody },
      ]
    : isCasual
      ? [
          { title: copy.accordionDescriptionTitle, body: `${product.name} is ${copy.casualDescriptionBody}` },
          { title: copy.accordionCareTitle, body: 'Wash cold, inside out. Do not iron printed areas. Hang dry for best results.' },
          { title: copy.accordionShippingTitle, body: copy.accordionShippingBody },
        ]
      : ACCORDIONS;
  const accordions = (product.descriptionSections?.length ?? 0) > 0
    ? product.descriptionSections!.map(s => ({ title: s.title, body: s.body }))
    : defaultAccordions;

  return (
    <div className="min-h-screen bg-page text-body font-archivo">
      <Header active={product.collection} tagline={settings.tagline} collections={collections} navCopy={navCopy} />

      <div className="max-w-[1180px] mx-auto px-5 sm:px-8 py-[26px] pb-20">
        {/* Breadcrumb */}
        <div className="text-[12.5px] text-muted mb-6">
          <Link href="/" className="text-muted no-underline hover:text-rose-700">Home</Link>
          <span className="mx-[7px]">/</span>
          <Link href={collectionHref(product.collection)} className="text-muted no-underline hover:text-rose-700">{colLabel}</Link>
          <span className="mx-[7px]">/</span>
          <span className="text-sub">{product.name}</span>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[1.05fr_.95fr] gap-12 items-start">
          {/* Gallery */}
          <div data-hero-reveal className="opacity-0 lg:sticky lg:top-[90px]">
            <ProductImage
              img={activeImg}
              alt={product.name}
              className="aspect-[4/5] rounded-[20px] relative overflow-hidden"
              sizes="(max-width: 1024px) 100vw, 560px"
            >
              {product.badge && (
                <span className={`absolute top-4 left-4 text-[10px] font-extrabold tracking-[.07em] uppercase px-[11px] py-[5px] rounded-[7px] ${product.badge === 'Sale' ? 'bg-[#ff3d4d] text-white' : product.badge === 'Pre-order' ? 'bg-[#c9a227] text-[#200612]' : 'bg-rose-500 text-[#200612]'}`}>
                  {product.badge}
                </span>
              )}
              <div className="absolute top-4 right-4 flex flex-col gap-[6px] items-end">
                {product.preOrder && product.badge !== 'Pre-order' && (
                  <span className="text-[10px] font-extrabold tracking-[.07em] uppercase px-[11px] py-[5px] rounded-[7px] bg-[rgba(219,87,149,.92)] text-white">
                    Pre-order
                  </span>
                )}
                {product.discountType && (
                  <span className="text-[10px] font-extrabold tracking-[.07em] uppercase px-[11px] py-[5px] rounded-[7px] bg-[#e81a2b] text-white">
                    {product.discountType === 'percent' ? `-${product.discountValue}%` : `-MVR ${product.discountValue}`}
                  </span>
                )}
              </div>
            </ProductImage>
          </div>

          {/* Info */}
          <div data-hero-reveal className="opacity-0">
            <div className="text-[12px] tracking-[.16em] uppercase text-rose-600 font-bold">
              {product.category} · {colLabel}
            </div>
            <h1 className="font-archivo-narrow font-bold text-[30px] sm:text-[42px] tracking-[.01em] mt-[10px] leading-[1.02]">
              {product.name}
            </h1>

            <div className="flex items-center gap-3 mt-[14px]">
              <StarRating rating={5} size={14} className="text-rose-700" />
              <span className="text-[12.5px] text-muted">4.8 · 36 reviews</span>
            </div>
            <div className="flex items-baseline gap-3 mt-5">
              <span className="font-extrabold text-[34px] text-rose-700 tabular">{formatMVR(displayPrice)}</span>
              {(product.discountType ? product.price : product.was) && (
                <span className="text-[13px] text-muted line-through tabular">{formatMVR(product.discountType ? product.price : product.was!)}</span>
              )}
              <span className="text-[13px] text-muted">{product.preOrder ? depositCopy.depositDueNowLabel : copy.productStockLine}</span>
            </div>
            {product.preOrder && (
              <div className="text-[12.5px] text-rose-700 bg-[rgba(219,87,149,.06)] border border-[rgba(219,87,149,.2)] rounded-[10px] px-[14px] py-[10px] mt-3 leading-[1.5] max-w-[440px]">
                {depositCopy.depositExplainerBody}
              </div>
            )}

            {/* Colour */}
            <div className="mt-[28px]">
              <div className="flex items-center justify-between mb-[12px]">
                <span className="text-[11px] font-bold uppercase tracking-[.08em] text-[#705260]">Colour</span>
                <span className="text-[12.5px] text-sub">{color}</span>
              </div>
              <div className="flex gap-[12px]">
                {product.colors.map(c => (
                  <span
                    key={c} onClick={() => setColor(c)} title={c}
                    className="w-9 h-9 rounded-full cursor-pointer transition-all"
                    style={{
                      background: colorHex(c),
                      boxShadow: color === c
                        ? '0 0 0 2px #fdfbf7,0 0 0 4px #db5795'
                        : '0 0 0 1px rgba(0,0,0,.14)',
                    }}
                  />
                ))}
              </div>
            </div>

            {/* Size */}
            <div className="mt-7">
              <div className="flex items-center justify-between mb-[12px]">
                <span className="text-[11px] font-bold uppercase tracking-[.08em] text-[#705260]">Size</span>
                <SizeChartTrigger chart={chart} />
              </div>
              <div className="flex flex-col gap-[9px]">
                {noStockForColor && (
                  <div className="text-[13px] text-muted px-[14px] py-[9px] rounded-xl" style={{ border: '1px solid rgba(0,0,0,.12)', background: 'rgba(0,0,0,.03)' }}>
                    Out of stock in this colour.
                  </div>
                )}
                {availableSizes.map(s => {
                  const stock = stockForSize(s);
                  const q = sizes[s] ?? 0;
                  return (
                    <div
                      key={s}
                      className="relative flex items-center justify-between gap-[14px] px-[14px] py-[9px] rounded-xl transition-all"
                      style={{
                        border: '1px solid rgba(0,0,0,.16)',
                        background: q > 0 ? 'rgba(219,87,149,.06)' : 'transparent',
                      }}
                    >
                      <div className="flex-1 min-w-0">
                        <span className="font-bold text-[13.5px]" style={{ color: '#705260' }}>
                          {s}
                        </span>
                        <div className="mt-[6px] max-w-[120px]">
                          <StockBar stock={stock} />
                        </div>
                      </div>
                      <div className="inline-flex items-center border border-[rgba(0,0,0,.14)] rounded-xl overflow-hidden">
                        <button
                          onClick={() => { setSizes(sv => ({ ...sv, [s]: Math.max(0, (sv[s] ?? 0) - 1) })); setSizeError(false); }}
                          className="border-none bg-[rgba(0,0,0,.06)] text-rose-700 w-[46px] h-[52px] text-[20px] cursor-pointer font-archivo disabled:cursor-not-allowed disabled:opacity-50"
                        >−</button>
                        <span key={q} className="w-[52px] text-center font-bold text-[16px] tabular animate-tick-pop">{q}</span>
                        <button
                          disabled={q >= stock}
                          onClick={() => {
                            setSizes(sv => {
                              const current = sv[s] ?? 0;
                              if (current >= stock) return sv;
                              return { ...sv, [s]: current + 1 };
                            });
                            setSizeError(false);
                          }}
                          className="border-none bg-[rgba(0,0,0,.06)] text-rose-700 w-[46px] h-[52px] text-[20px] cursor-pointer font-archivo disabled:cursor-not-allowed disabled:opacity-50"
                        >+</button>
                      </div>
                    </div>
                  );
                })}
              </div>
              {sizeError && <div className="text-[12px] text-[#e81a2b] mt-[9px]">Please select at least one size.</div>}
            </div>

            {/* Qty + Add to cart */}
            <div className="flex gap-[14px] mt-7 items-start">
              {product.sizes.length === 0 && (() => {
                const stock0 = stockForSize('');
                const atCap = qty >= stock0;
                return (
                  <div className="flex flex-col gap-[6px]">
                    <div className="inline-flex items-center border border-[rgba(0,0,0,.14)] rounded-xl overflow-hidden">
                      <button onClick={() => setQty(q => Math.max(1, q - 1))} className="border-none bg-[rgba(0,0,0,.06)] text-rose-700 w-[46px] h-[52px] text-[20px] cursor-pointer font-archivo">−</button>
                      <span key={qty} className="w-[52px] text-center font-bold text-[16px] tabular animate-tick-pop">{qty}</span>
                      <button
                        disabled={atCap}
                        onClick={() => setQty(q => atCap ? q : q + 1)}
                        className="border-none bg-[rgba(0,0,0,.06)] text-rose-700 w-[46px] h-[52px] text-[20px] cursor-pointer font-archivo disabled:cursor-not-allowed disabled:opacity-50"
                      >+</button>
                    </div>
                    <div className="w-[144px]">
                      <StockBar stock={stock0} />
                    </div>
                  </div>
                );
              })()}
              <Button onClick={addToCart} disabled={noStockForColor} className="flex-1">
                {addToCartLabel}
              </Button>
            </div>

            {addedGroups.length > 0 && (
              <div className="mt-5 flex flex-col gap-[8px] bg-[#f9f6f7] border border-[rgba(193,57,120,.18)] rounded-[12px] p-[14px]">
                <div className="text-[11px] tracking-[.14em] uppercase text-rose-600 font-bold">Added so far</div>
                {addedGroups.map(g => (
                  <div key={g.key} className="flex items-center justify-between gap-[10px] text-[12.5px]">
                    <span className="font-semibold text-[#705260]">
                      {g.color}
                    </span>
                    <span className="text-muted font-semibold tabular whitespace-nowrap">
                      {Object.entries(g.sizes).filter(([, q]) => q > 0).map(([s, q]) => s ? `${s}×${q}` : `×${q}`).join(', ')}
                    </span>
                  </div>
                ))}
              </div>
            )}

            {/* Trust strip */}
            <div className="grid grid-cols-3 gap-[14px] mt-[26px] pt-[22px] border-t border-[rgba(0,0,0,.08)]">
              {[
                { icon: Store, label: copy.trustOneLabel },
                { icon: Home, label: copy.trustTwoLabel },
                { icon: Undo2, label: copy.trustThreeLabel },
              ].map(t => (
                <div key={t.label}>
                  <div className="text-rose-700"><t.icon size={16} /></div>
                  <div className="text-[11.5px] text-sub mt-2 leading-[1.35]">{t.label}</div>
                </div>
              ))}
            </div>

            {/* Accordion */}
            <div className="mt-[26px] border-t border-[rgba(0,0,0,.08)]">
              {accordions.map((a, i) => (
                <div key={i} className="border-b border-[rgba(0,0,0,.08)]">
                  <button
                    onClick={() => setOpenAcc(openAcc === i ? -1 : i)}
                    className="w-full flex items-center justify-between bg-transparent border-none text-body font-bold text-[14px] py-[17px] cursor-pointer text-left gap-4"
                  >
                    {a.title}
                    <span className="text-rose-700 text-[18px] flex-none">{openAcc === i ? '–' : '+'}</span>
                  </button>
                  {openAcc === i && (
                    <div className="text-[13.5px] leading-[1.65] text-sub pb-[18px] max-w-[480px]">{a.body}</div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Related */}
        <div data-reveal className="mt-[80px]">
          <h2 className="font-archivo-narrow font-bold text-[26px] sm:text-[30px] mb-[26px]">{copy.relatedTitle}</h2>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-x-[18px] gap-y-[30px]">
            {related.map(p => (
              <ProductCard key={p.id} product={p} viewOptionsLabel={copy.viewOptionsLabel} />
            ))}
          </div>
        </div>
      </div>

      <Footer tagline={settings.tagline} collections={collections} navCopy={navCopy} paymentCopy={depositCopy} />

      {/* Sticky mobile bar */}
      <div className="product-sticky-cta lg:hidden fixed bottom-0 inset-x-0 z-40 flex items-center gap-2 px-3 py-3 border-t border-[rgba(0,0,0,.1)] max-w-full flex-wrap" style={{ background: 'rgba(253,251,247,.95)', backdropFilter: 'blur(12px)' }}>
        <div className="flex-1 min-w-0">
          <div className="text-[10px] uppercase tracking-[.1em] text-muted truncate">{product.name}</div>
          <div className="font-extrabold text-[18px] text-rose-700 tabular leading-tight">
            {formatMVR(lineTotal)}
          </div>
        </div>
        <Button size="sm" onClick={addToCart} disabled={noStockForColor} className="flex-1">
          {addToCartLabelCompact}
        </Button>
      </div>

      {toast && (
        <Toast
          title="Added to cart"
          sub={[product.name, color].filter(Boolean).join(' · ') + (sizesLabelStr ? ` · ${sizesLabelStr}` : ` ×${qty}`)}
          href="/cart"
          onDismiss={() => setToast(false)}
        />
      )}
    </div>
  );
}
