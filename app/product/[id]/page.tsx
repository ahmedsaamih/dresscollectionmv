import React from 'react';
import { getCatalog } from '@/lib/catalog';
import { resolveSizeChart } from '@/lib/sizeChart';
import { ProductDetailClient } from './ProductDetailClient';

export const dynamic = 'force-dynamic';

export default async function ProductPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { settings, collections, products, sizeCharts } = await getCatalog();

  const product = products.find(p => p.id === id) ?? null;
  const colMeta = product ? collections.find(c => c.key === product.collection) : undefined;
  const chart = resolveSizeChart(sizeCharts, colMeta?.sizeChartId);
  const related = product
    ? products.filter(p => p.collection === product.collection && p.id !== product.id).slice(0, 4)
    : [];

  return (
    <ProductDetailClient
      settings={settings}
      collections={collections}
      product={product}
      chart={chart}
      related={related}
    />
  );
}
