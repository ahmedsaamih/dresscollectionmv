import React from 'react';
import type { Metadata } from 'next';
import { getCatalog } from '@/lib/catalog';
import { resolveSizeChart } from '@/lib/sizeChart';
import { CollectionPageClient } from '@/components/CollectionPageClient';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Casual Dresses',
  description: 'Easy, everyday dressing — comfortable enough for daytime, pretty enough for anywhere. Shop casual dresses, delivered across the Maldives.',
  alternates: { canonical: '/casual-wear' },
  openGraph: { url: '/casual-wear' },
};

export default async function CasualWearPage() {
  const { settings, collections, products, sizeCharts } = await getCatalog();
  const filtered = products.filter(p => p.collection === 'casual');
  const colMeta = collections.find(c => c.key === 'casual');
  const chart = resolveSizeChart(sizeCharts, colMeta?.sizeChartId);

  return (
    <CollectionPageClient
      active="casual"
      tagline={settings.tagline}
      collections={collections}
      navCopy={settings.storefrontCopy.homepageNavigation}
      paymentCopy={settings.storefrontCopy.paymentCheckout}
      catalogCopy={settings.storefrontCopy.productCatalog}
      breadcrumb="Casual Dresses"
      title="Casual Dresses"
      subtitle="Easy, everyday dressing — comfortable enough for daytime, pretty enough for anywhere."
      categoryLabel="Style"
      products={filtered}
      noun="dresses"
      sizeChart={chart}
    />
  );
}
