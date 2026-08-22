'use client';
import React from 'react';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { CatalogLayout } from '@/components/CatalogLayout';
import { ProductCard } from '@/components/ProductCard';
import { useStore } from '@/contexts/StoreContext';
import { useReveal } from '@/lib/useReveal';
import { resolveSizeChart } from '@/lib/sizeChart';

export default function AccessoriesPage() {
  const { data, loading } = useStore();
  useReveal();
  const products = data.products.filter(p => p.collection === 'accessories');
  const colMeta = data.collections.find(c => c.key === 'accessories');
  const chart = resolveSizeChart(data.sizeCharts, colMeta?.sizeChartId);

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
        renderCard={(p) => <ProductCard product={p} />}
        noun="items"
        sizeChart={chart}
      />
      <Footer />
    </div>
  );
}
