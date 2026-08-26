import React from 'react';
import { getCatalog } from '@/lib/catalog';
import { resolveSizeChart } from '@/lib/sizeChart';
import { CollectionPageClient } from '@/components/CollectionPageClient';

export const dynamic = 'force-dynamic';

export default async function ReadyMadePage() {
  const { settings, collections, products, sizeCharts } = await getCatalog();
  const filtered = products.filter(p => p.collection === 'ready');
  const colMeta = collections.find(c => c.key === 'ready');
  const chart = resolveSizeChart(sizeCharts, colMeta?.sizeChartId);

  return (
    <CollectionPageClient
      active="ready"
      tagline={settings.tagline}
      collections={collections}
      navCopy={settings.storefrontCopy.homepageNavigation}
      paymentCopy={settings.storefrontCopy.paymentCheckout}
      catalogCopy={settings.storefrontCopy.productCatalog}
      breadcrumb="New Arrivals"
      title="New Arrivals"
      subtitle="Fresh styles, ready to ship."
      categoryLabel="Style"
      products={filtered}
      noun="dresses"
      sizeChart={chart}
    />
  );
}
