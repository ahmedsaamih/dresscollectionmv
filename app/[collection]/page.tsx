'use client';
import React, { useState } from 'react';
import { useParams } from 'next/navigation';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { Toast } from '@/components/Toast';
import { Button } from '@/components/Button';
import { CatalogLayout } from '@/components/CatalogLayout';
import { ProductImage } from '@/components/ProductImage';
import { MMCart } from '@/lib/cart';
import { useStore } from '@/contexts/StoreContext';
import { useReveal } from '@/lib/useReveal';
import { formatMVR, COLOR_MAP } from '@/lib/utils';
import { resolveSizeChart } from '@/lib/sizeChart';
import type { Product } from '@/lib/types';
import Link from 'next/link';

export default function CollectionPage() {
  const { collection: colKey } = useParams<{ collection: string }>();
  const { data, loading } = useStore();
  useReveal();
  const [toast, setToast] = useState<{ title: string; sub: string; href: string } | null>(null);

  const colMeta = data.collections.find(c => c.key === colKey);
  const products = data.products.filter(p => p.collection === colKey);
  const chart = resolveSizeChart(data.sizeCharts, colMeta?.sizeChartId);

  const colorHex = (name: string) => COLOR_MAP[name] ?? '#888';

  // p.status is a manually-set admin field that nothing flips to 'soldout' as
  // real Inventory depletes via checkout/POS/transfers, so it goes stale.
  // Fall back to the live-computed stock (mirrors checkout's own
  // stockDecremented rule).
  const isSoldOut = (p: Product) => p.status === 'soldout' || p.stock === 0;

  const addToCart = (p: Product) => {
    const size = p.sizes[0] || 'One';
    const color = p.colors[0] || 'Default';
    // Inventory keys blank sizeless/colourless combos as '', not the 'One'/
    // 'Default' display labels used for the cart line below — look stock up
    // by the real key so a genuinely in-stock blank-variant product isn't
    // incorrectly blocked.
    const stock = p.colorSizeStock?.[p.colors[0] ?? '']?.[p.sizes[0] ?? ''] ?? 0;
    const existingQty = MMCart.get().fixed
      .filter(i => i.sku === p.id && i.size === size && i.color === color)
      .reduce((a, i) => a + i.qty, 0);
    if (existingQty >= stock) return;
    MMCart.addFixed({ sku: p.id, name: p.name, meta: p.sub, price: p.price, img: p.img, size, color, qty: 1 });
    setToast({ title: 'Added to cart', sub: p.name + ' · ' + formatMVR(p.price), href: '/cart' });
  };

  const colLabel = colMeta?.label ?? colKey;

  const badgeClass = (badge: Product['badge']) =>
    badge === 'Sale' ? 'bg-[#ff3d4d] text-white'
      : badge === 'Pre-order' ? 'bg-[#c9a227] text-[#200612]'
      : 'bg-rose-500 text-[#200612]';

  // ── Standard card (add to cart or link to product page)
  const renderStandardCard = (p: Product) => (
    <div className="bg-[#f5f1f3] border border-[rgba(0,0,0,.08)] rounded-2xl overflow-hidden hover:-translate-y-1 hover:border-[rgba(219,87,149,.3)] transition-all">
      <ProductImage href={`/product/${p.id}`} img={p.img} className="block no-underline h-[200px] relative">
        {p.badge && (
          <span className={`absolute top-3 left-3 text-[10px] font-extrabold tracking-[.06em] uppercase px-[9px] py-1 rounded-[6px] ${badgeClass(p.badge)}`}>{p.badge}</span>
        )}
        {isSoldOut(p) && (
          <div className="absolute inset-0 bg-[rgba(8,8,8,.55)] flex items-center justify-center">
            <span className="text-[11px] font-extrabold tracking-[.1em] uppercase text-[#ffe9f3] border border-[rgba(255,255,255,.25)] px-3 py-1.5 rounded-[8px]">Sold out</span>
          </div>
        )}
        <div className="absolute bottom-[10px] right-3 text-[10px] tracking-[.14em] uppercase text-[rgba(255,255,255,.4)]">{p.category}</div>
      </ProductImage>
      <div className="p-4">
        <Link href={`/product/${p.id}`} className="no-underline text-body font-bold text-[14.5px] block hover:text-rose-600 transition-colors">{p.name}</Link>
        <div className="text-[11.5px] text-muted mt-[3px]">{p.sub}</div>
        <div className="flex gap-[6px] mt-[11px]">
          {p.colors.map(c => (
            <span key={c} className="w-[15px] h-[15px] rounded-[4px] border border-[rgba(0,0,0,.12)]" style={{ background: colorHex(c) }} />
          ))}
        </div>
        <div className="flex items-center justify-between mt-[13px]">
          <div>
            <span className="font-extrabold text-[16px] text-rose-700 tabular">MVR {p.price}</span>
            {p.was && <span className="ml-2 text-[12px] text-muted line-through tabular">MVR {p.was}</span>}
          </div>
          {isSoldOut(p) ? (
            <Button variant="secondary" size="xs" disabled>Notify</Button>
          ) : (
            <Button variant="secondary" size="xs" href={`/product/${p.id}`}>View options</Button>
          )}
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-page text-body font-archivo">
      <Header active={colKey} />
      <CatalogLayout
        breadcrumb={colLabel}
        title={colLabel}
        subtitle={`Shop our ${colLabel.toLowerCase()} collection.`}
        categoryLabel="Type"
        products={products}
        loading={loading}
        renderCard={renderStandardCard}
        noun="items"
        sizeChart={chart}
      />
      <Footer />

      {toast && (
        <Toast
          title={toast.title}
          sub={toast.sub}
          href={toast.href}
          onDismiss={() => setToast(null)}
        />
      )}
    </div>
  );
}
