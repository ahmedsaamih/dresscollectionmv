'use client';
import React from 'react';
import Link from 'next/link';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { Button } from '@/components/Button';
import { CatalogLayout } from '@/components/CatalogLayout';
import { ProductImage } from '@/components/ProductImage';
import { useStore } from '@/contexts/StoreContext';
import { useReveal } from '@/lib/useReveal';
import { resolveSizeChart } from '@/lib/sizeChart';
import type { Product } from '@/lib/types';

export default function AccessoriesPage() {
  const { data, loading } = useStore();
  useReveal();
  const products = data.products.filter(p => p.collection === 'accessories');
  const colMeta = data.collections.find(c => c.key === 'accessories');
  const chart = resolveSizeChart(data.sizeCharts, colMeta?.sizeChartId);

  const renderCard = (p: Product) => (
    <div className="bg-[#f5f1f3] border border-[rgba(0,0,0,.08)] rounded-2xl overflow-hidden hover:-translate-y-1 hover:border-[rgba(219,87,149,.3)] transition-all">
      <ProductImage href={`/product/${p.id}`} img={p.img} colorImages={p.colorImages} className="block no-underline h-[150px] relative">
        {p.status === 'soldout' && <div className="absolute inset-0 bg-[rgba(8,8,8,.55)] flex items-center justify-center"><span className="text-[11px] font-extrabold tracking-[.1em] uppercase text-[#ffe9f3] border border-[rgba(255,255,255,.25)] px-3 py-1.5 rounded-[8px]">Sold out</span></div>}
      </ProductImage>
      <div className="p-[15px]">
        <Link href={`/product/${p.id}`} className="no-underline text-body font-bold text-[14px] block hover:text-rose-600 transition-colors">{p.name}</Link>
        <div className="text-[11.5px] text-muted mt-[3px]">{p.sub}</div>
        <div className="flex items-center justify-between mt-3">
          <span className="font-extrabold text-[15px] text-rose-700 tabular">MVR {p.price}</span>
          {p.status !== 'soldout'
            ? p.customizable
              ? <div className="flex gap-[7px]">
                  <Button size="xs" href={`/product/${p.id}`}>Customise →</Button>
                </div>
              : <Button variant="secondary" size="xs" href={`/product/${p.id}`}>View options</Button>
            : <Button variant="secondary" size="xs" disabled>Notify</Button>}
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-page text-body font-archivo">
      <Header active="accessories" />
      <CatalogLayout
        breadcrumb="Accessories"
        title="Accessories"
        subtitle="Bags, jewellery, belts and scarves to complete your look."
        categoryLabel="Type"
        products={products}
        loading={loading}
        renderCard={renderCard}
        noun="items"
        sizeChart={chart}
      />
      <Footer />
    </div>
  );
}
