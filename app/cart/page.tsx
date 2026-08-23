'use client';
import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { Button } from '@/components/Button';
import { MMCart } from '@/lib/cart';
import { useCart } from '@/contexts/CartContext';
import { useStore } from '@/contexts/StoreContext';
import { formatMVR } from '@/lib/utils';
import { useReveal } from '@/lib/useReveal';
import { ShoppingCart, X } from 'lucide-react';
import type { FixedLineItem } from '@/lib/types';

export default function CartPage() {
  useReveal();
  const { cart, refresh } = useCart();
  const { data } = useStore();
  const copy = data.settings.storefrontCopy.cartQuoteStatus;
  const router = useRouter();
  const fmt = formatMVR;
  const fixed = cart.fixed;
  const hasFixed = fixed.length > 0;
  const subtotal = fixed.reduce((a,i) => a + i.price * i.qty, 0);

  const [showUpsell, setShowUpsell] = useState(false);

  const accessories = data.products
    .filter(p => p.collection === 'accessories' && p.status !== 'soldout')
    .slice(0, 4);

  // Real per-size stock for a fixed cart line, matched by sku (= product id) —
  // mirrors the cap already enforced on the product page's own qty stepper.
  // Missing product/stock data defaults to 0 (not unlimited), and other cart
  // lines sharing the same sku+color+size are subtracted first, so this
  // line's own qty can never grow past what's actually left for the combo.
  const stockFor = (i: FixedLineItem) => {
    const product = data.products.find(p => p.id === i.sku);
    const raw = product?.colorSizeStock?.[i.color]?.[i.size] ?? 0;
    const reservedByOthers = fixed
      .filter(x => x.id !== i.id && x.sku === i.sku && x.color === i.color && x.size === i.size)
      .reduce((a, x) => a + x.qty, 0);
    return Math.max(0, raw - reservedByOthers);
  };

  // Real total stock for the combo (not "cap left for this line") — shown in
  // the "Only N in stock" warning so it reflects the actual number, not just
  // an echo of the qty the customer already has.
  const totalStockFor = (i: FixedLineItem) => data.products.find(p => p.id === i.sku)?.colorSizeStock?.[i.color]?.[i.size] ?? 0;

  const inc = (i: FixedLineItem) => { if (i.qty >= stockFor(i)) return; MMCart.setQty(i.id, i.qty+1); refresh(); };
  const dec = (id: string, qty: number) => { MMCart.setQty(id, qty-1); refresh(); };
  const remove = (id: string) => { MMCart.remove(id); refresh(); };


  const handleCheckout = () => {
    if (accessories.length === 0) { router.push('/checkout'); return; }
    setShowUpsell(true);
  };

  const goToCheckout = () => {
    setShowUpsell(false);
    router.push('/checkout');
  };

  const headline = hasFixed ? copy.cartFixedHeadline : copy.cartEmptyHeadline;

  return (
    <div className="min-h-screen bg-page text-body font-archivo">
      <Header />
      <div className="max-w-[1180px] mx-auto px-5 sm:px-8 py-[26px] pb-20">
        <div className="text-[12.5px] text-muted mb-[18px]">
          <Link href="/" className="text-muted no-underline hover:text-rose-700">Home</Link>
          <span className="mx-[7px]">/</span><span className="text-sub">Cart</span>
        </div>
        <h1 data-hero-reveal className="opacity-0 font-archivo-narrow font-bold text-[30px] sm:text-[40px] tracking-[.01em] mb-1.5">{copy.cartTitle}</h1>
        <p className="text-[14px] text-sub mb-7">{headline}</p>

        {/* Empty */}
        {!hasFixed && (
          <div className="border border-dashed border-[rgba(0,0,0,.14)] rounded-[18px] py-[72px] px-6 text-center">
            <div className="w-[60px] h-[60px] rounded-full bg-[rgba(0,0,0,.06)] inline-flex items-center justify-center text-muted"><ShoppingCart size={26} /></div>
            <div className="font-bold text-[20px] mt-[18px]">{copy.cartEmptyTitle}</div>
            <div className="text-[13.5px] text-[#705260] mt-[7px] max-w-[380px] mx-auto leading-[1.55]">{copy.cartEmptyBody}</div>
            <div className="flex gap-3 justify-center mt-[22px] flex-wrap">
              <Button size="xs" href="/ready-made">{copy.shopReadyCta}</Button>
              <Button variant="secondary" size="xs" href="/casual-wear">Shop casual dresses</Button>
            </div>
          </div>
        )}

        {hasFixed && (
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-9 items-start">
            {/* Items */}
            <div className="flex flex-col gap-[26px]">
              <div>
                <div className="flex items-center gap-[11px] mb-[16px]">
                  <h2 className="font-archivo-narrow font-bold text-[19px] uppercase tracking-[.04em]">Your items</h2>
                  <span className="text-[11.5px] text-muted">{fixed.length} item{fixed.length!==1?'s':''}</span>
                </div>
                <div className="flex flex-col gap-4">
                  {fixed.map(i => (
                    <div key={i.id} data-motion-card className="flex gap-[16px] pb-4 border-b border-[rgba(0,0,0,.07)]">
                      <div className="w-[86px] h-[108px] rounded-[12px] flex-none relative overflow-hidden" style={{ background:i.img }} />
                      <div className="flex-1 min-w-0">
                        <div className="flex justify-between gap-[10px]">
                          <div>
                            <div className="font-bold text-[14.5px]">{i.name}</div>
                            <div className="text-[11.5px] text-muted mt-[3px]">{i.meta}</div>
                            <div className="text-[11.5px] text-sub mt-1.5">{[i.size && `Size ${i.size}`, i.color].filter(Boolean).join(' · ')}</div>
                            {i.qty >= stockFor(i) && <div className="text-[11px] text-[#e81a2b] mt-1">Only {totalStockFor(i)} in stock</div>}
                          </div>
                          <button onClick={()=>remove(i.id)} className="border-none bg-transparent text-muted cursor-pointer h-fit"><X size={16} /></button>
                        </div>
                        <div className="flex items-center justify-between mt-[12px]">
                          <div className="inline-flex items-center border border-[rgba(0,0,0,.13)] rounded-full overflow-hidden">
                            <button onClick={()=>dec(i.id,i.qty)} className="border-none bg-transparent text-rose-700 w-8 h-8 text-[17px] cursor-pointer">−</button>
                            <span key={i.qty} className="w-9 text-center font-bold text-[14px] tabular animate-tick-pop">{i.qty}</span>
                            <button
                              disabled={i.qty >= stockFor(i)}
                              onClick={()=>inc(i)}
                              className="border-none bg-transparent text-rose-700 w-8 h-8 text-[17px] cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
                            >+</button>
                          </div>
                          <span className="font-extrabold text-[15px] text-rose-700 tabular">{fmt(i.price * i.qty)}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Summary */}
            <aside className="lg:sticky lg:top-[84px] flex flex-col gap-4">
              <div data-reveal className="bg-surface rounded-2xl p-6">
                <div className="font-extrabold text-[13px] uppercase tracking-[.06em] mb-[16px]">Order summary</div>
                <div className="flex justify-between text-[13px] text-sub mb-[9px]">
                  <span>Subtotal ({fixed.reduce((a,i)=>a+i.qty,0)} items)</span>
                  <span className="text-body font-semibold tabular">{fmt(subtotal)}</span>
                </div>
                <div className="flex justify-between text-[13px] text-sub mb-[9px]">
                  <span>Delivery</span><span className="text-rose-600">Calculated at checkout</span>
                </div>
                <div className="h-px bg-[rgba(0,0,0,.08)] my-[13px]"/>
                <div className="flex justify-between items-baseline">
                  <span className="font-bold text-[14px]">Total</span>
                  <span className="font-extrabold text-[20px] text-rose-700 tabular">{fmt(subtotal)}</span>
                </div>
                <Button onClick={handleCheckout} className="w-full mt-5">
                  {copy.checkoutCta} →
                </Button>
                <div className="text-center mt-[11px] text-[11px] text-muted">{copy.noCardCartNote}</div>
              </div>

              <Link href="/ready-made" className="text-center no-underline text-[12.5px] text-muted hover:text-rose-700">← Continue shopping</Link>
            </aside>
          </div>
        )}
      </div>
      <Footer/>

      {/* Upsell modal — intercepts "Proceed to checkout" */}
      {showUpsell && (
        <div
          className="fixed inset-0 z-[90] flex items-end sm:items-center justify-center p-0 sm:p-5"
          style={{ background: 'rgba(4,8,7,.88)', backdropFilter: 'blur(14px)' }}
          onClick={goToCheckout}
        >
          <div
            className="relative w-full sm:max-w-[540px] bg-surface border border-[rgba(0,0,0,.1)] rounded-t-[24px] sm:rounded-[24px] overflow-hidden"
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-start justify-between px-6 pt-6 pb-[18px] border-b border-[rgba(0,0,0,.07)]">
              <div>
                <div className="font-archivo-narrow font-bold text-[22px]">{copy.upsellTitle}</div>
                <div className="text-[13px] text-sub mt-[3px]">{copy.upsellBody}</div>
              </div>
              <button
                onClick={goToCheckout}
                className="w-[32px] h-[32px] flex-none rounded-[9px] flex items-center justify-center text-muted border-none cursor-pointer ml-4 mt-[2px] transition-colors hover:text-body"
                style={{ background: 'rgba(0,0,0,.08)' }}
                aria-label="Skip suggestions"
              >
                <X size={16} />
              </button>
            </div>

            {/* Accessory cards */}
            <div className="grid grid-cols-1 min-[380px]:grid-cols-2 gap-4 p-5">
              {accessories.map(p => (
                  <div key={p.id} className="flex flex-col">
                    <div className="aspect-square rounded-[14px] relative flex-none overflow-hidden" style={{ background: p.img }} />
                    <div className="pt-[10px] flex flex-col flex-1">
                      <div className="font-bold text-[13.5px] text-[#705260] leading-[1.3]">{p.name}</div>
                      <div className="text-[11px] text-muted mt-[3px] mb-[10px] leading-[1.4] flex-1">{p.sub}</div>
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <span className="font-extrabold text-[13.5px] text-rose-700 tabular">{formatMVR(p.price)}</span>
                        <Button variant="tertiary" size="xs" href={`/product/${p.id}`} className="flex-none">
                          Choose options
                        </Button>
                      </div>
                    </div>
                  </div>
              ))}
            </div>

            {/* Footer CTAs */}
            <div className="px-5 pb-6 flex flex-col gap-[10px]">
              <Button onClick={goToCheckout} className="w-full">
                Continue to checkout →
              </Button>
              <button
                onClick={goToCheckout}
                className="w-full border-none bg-transparent text-[13px] text-muted cursor-pointer py-[6px] hover:text-sub transition-colors"
              >
                {copy.upsellSkip}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
