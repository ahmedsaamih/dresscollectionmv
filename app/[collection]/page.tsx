import React from 'react';
import type { Metadata } from 'next';
import { getCatalog } from '@/lib/catalog';
import { resolveSizeChart } from '@/lib/sizeChart';
import { CollectionPageClient } from '@/components/CollectionPageClient';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: Promise<{ collection: string }> }): Promise<Metadata> {
  const { collection: colKey } = await params;
  const { collections } = await getCatalog();
  const colMeta = collections.find(c => c.key === colKey);
  const colLabel = colMeta?.label ?? colKey;
  return {
    title: colLabel,
    description: `Shop our ${colLabel.toLowerCase()} collection, delivered across the Maldives.`,
    alternates: { canonical: `/${colKey}` },
    openGraph: { url: `/${colKey}` },
    // An unrecognized collection slug still renders (no 404), but it's not a
    // real page worth a search result — keep it out of the index.
    robots: colMeta ? undefined : { index: false, follow: false },
  };
}

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
