import React from 'react';
import { getCatalog } from '@/lib/catalog';
import { resolveSizeChart } from '@/lib/sizeChart';
import { CollectionPageClient } from '@/components/CollectionPageClient';

export const dynamic = 'force-dynamic';

export default async function CollectionPage({ params }: { params: Promise<{ collection: string }> }) {
  const { collection: colKey } = await params;
  const { settings, collections, products, sizeCharts } = await getCatalog();

  const colMeta = collections.find(c => c.key === colKey);
  const filtered = products.filter(p => p.collection === colKey);
  const chart = resolveSizeChart(sizeCharts, colMeta?.sizeChartId);
  const colLabel = colMeta?.label ?? colKey;

  return (
    <CollectionPageClient
      active={colKey}
      tagline={settings.tagline}
      collections={collections}
      navCopy={settings.storefrontCopy.homepageNavigation}
      paymentCopy={settings.storefrontCopy.paymentCheckout}
      catalogCopy={settings.storefrontCopy.productCatalog}
      breadcrumb={colLabel}
      title={colLabel}
      subtitle={`Shop our ${colLabel.toLowerCase()} collection.`}
      categoryLabel="Type"
      products={filtered}
      noun="items"
      sizeChart={chart}
    />
  );
}
