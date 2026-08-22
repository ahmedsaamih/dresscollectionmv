'use client';
import React from 'react';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { CatalogLayout } from '@/components/CatalogLayout';
import { ProductCard } from '@/components/ProductCard';
import { useStore } from '@/contexts/StoreContext';
import { useReveal } from '@/lib/useReveal';
import { resolveSizeChart } from '@/lib/sizeChart';

export default function ReadyMadePage() {
  const { data, loading } = useStore();
  useReveal();

  const products = data.products.filter(p => p.collection === 'ready');
  const colMeta = data.collections.find(c => c.key === 'ready');
  const chart = resolveSizeChart(data.sizeCharts, colMeta?.sizeChartId);

  return (
    <div className="min-h-screen bg-page text-body font-archivo">
      <Header active="ready" />
      <CatalogLayout
        breadcrumb="New Arrivals"
        title="New Arrivals"
        subtitle="Fresh styles, ready to ship."
        categoryLabel="Style"
        products={products}
        loading={loading}
        renderCard={(p) => <ProductCard product={p} />}
        noun="dresses"
        sizeChart={chart}
      />
      <Footer />
    </div>
  );
}
