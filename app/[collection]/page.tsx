'use client';
import React from 'react';
import { useParams } from 'next/navigation';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { CatalogLayout } from '@/components/CatalogLayout';
import { ProductCard } from '@/components/ProductCard';
import { useStore } from '@/contexts/StoreContext';
import { useReveal } from '@/lib/useReveal';
import { resolveSizeChart } from '@/lib/sizeChart';

export default function CollectionPage() {
  const { collection: colKey } = useParams<{ collection: string }>();
  const { data, loading } = useStore();
  useReveal();

  const colMeta = data.collections.find(c => c.key === colKey);
  const products = data.products.filter(p => p.collection === colKey);
  const chart = resolveSizeChart(data.sizeCharts, colMeta?.sizeChartId);
  const colLabel = colMeta?.label ?? colKey;

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
        renderCard={(p) => <ProductCard product={p} />}
        noun="items"
        sizeChart={chart}
      />
      <Footer />
    </div>
  );
}
