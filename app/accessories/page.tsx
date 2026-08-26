import React from 'react';
import { getCatalog } from '@/lib/catalog';
import { resolveSizeChart } from '@/lib/sizeChart';
import { CollectionPageClient } from '@/components/CollectionPageClient';

export const dynamic = 'force-dynamic';

export default async function AccessoriesPage() {
  const { settings, collections, products, sizeCharts } = await getCatalog();
  const filtered = products.filter(p => p.collection === 'accessories');
  const colMeta = collections.find(c => c.key === 'accessories');
  const chart = resolveSizeChart(sizeCharts, colMeta?.sizeChartId);

  return (
    <CollectionPageClient
      active="accessories"
      tagline={settings.tagline}
      collections={collections}
      navCopy={settings.storefrontCopy.homepageNavigation}
      paymentCopy={settings.storefrontCopy.paymentCheckout}
      catalogCopy={settings.storefrontCopy.productCatalog}
      breadcrumb="Accessories"
      title="Accessories"
      subtitle="Bags, jewellery, belts and scarves to complete your look."
      categoryLabel="Type"
      products={filtered}
      noun="items"
      sizeChart={chart}
    />
  );
}
