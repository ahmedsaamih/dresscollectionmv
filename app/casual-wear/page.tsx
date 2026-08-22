'use client';
import React from 'react';
import Link from 'next/link';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { CatalogLayout } from '@/components/CatalogLayout';
import { ProductImage } from '@/components/ProductImage';
import { useStore } from '@/contexts/StoreContext';
import { useReveal } from '@/lib/useReveal';
import { COLOR_MAP } from '@/lib/utils';
import { resolveSizeChart } from '@/lib/sizeChart';
import { Button } from '@/components/Button';
import type { Product } from '@/lib/types';

export default function CasualWearPage() {
  const { data, loading } = useStore();
  useReveal();

  const colorHex = (name: string) => COLOR_MAP[name] ?? '#888';
  const products = data.products.filter(p => p.collection === 'casual');
  const colMeta = data.collections.find(c => c.key === 'casual');
  const chart = resolveSizeChart(data.sizeCharts, colMeta?.sizeChartId);

  const badgeClass = (badge: Product['badge']) =>
    badge === 'Sale' ? 'bg-[#ff3d4d] text-white'
      : badge === 'Pre-order' ? 'bg-[#c9a227] text-[#200612]'
      : 'bg-rose-500 text-[#200612]';

  const renderCard = (p: Product) => (
    <div className="bg-[#f5f1f3] border border-[rgba(0,0,0,.08)] rounded-2xl overflow-hidden hover:-translate-y-1 hover:border-[rgba(219,87,149,.3)] transition-all">
      <ProductImage href={`/product/${p.id}`} img={p.img} className="block no-underline h-[200px] relative">
        {p.badge && <span className={`absolute top-3 left-3 text-[10px] font-extrabold tracking-[.06em] uppercase px-[9px] py-1 rounded-[6px] ${badgeClass(p.badge)}`}>{p.badge}</span>}
        <div className="absolute bottom-[10px] right-3 text-[10px] tracking-[.14em] uppercase text-[rgba(255,255,255,.4)]">{p.category}</div>
      </ProductImage>
      <div className="p-4">
        <Link href={`/product/${p.id}`} className="no-underline text-body font-bold text-[14.5px] block hover:text-rose-600 transition-colors">{p.name}</Link>
        <div className="text-[11.5px] text-muted mt-[3px]">{p.sub}</div>
        <div className="flex gap-[6px] mt-[11px]">
          {p.colors.map(c => <span key={c} className="w-[15px] h-[15px] rounded-[4px] border border-[rgba(0,0,0,.12)]" style={{ background: colorHex(c) }} />)}
        </div>
        <div className="flex items-center justify-between mt-[13px]">
          <span className="font-extrabold text-[16px] text-rose-700 tabular">MVR {p.price}</span>
          <Button variant="secondary" size="xs" href={`/product/${p.id}`}>View options</Button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-page text-body font-archivo">
      <Header active="casual" />
      <CatalogLayout
        breadcrumb="Casual Dresses"
        title="Casual Dresses"
        subtitle="Easy, everyday dressing — comfortable enough for daytime, pretty enough for anywhere."
        categoryLabel="Style"
        products={products}
        loading={loading}
        renderCard={renderCard}
        noun="dresses"
        sizeChart={chart}
      />
      <Footer />
    </div>
  );
}
