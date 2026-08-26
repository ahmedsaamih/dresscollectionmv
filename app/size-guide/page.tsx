import React from 'react';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { getCatalog } from '@/lib/catalog';
import { SizeGuideClient } from './SizeGuideClient';

export const dynamic = 'force-dynamic';

export default async function SizeGuidePage() {
  const { settings, collections, sizeCharts } = await getCatalog();
  const navCopy = settings.storefrontCopy.homepageNavigation;

  return (
    <div className="min-h-screen bg-page text-body font-archivo">
      <Header tagline={settings.tagline} collections={collections} navCopy={navCopy} />
      <SizeGuideClient charts={sizeCharts} copy={settings.storefrontCopy.productCatalog} />
      <Footer tagline={settings.tagline} collections={collections} navCopy={navCopy} paymentCopy={settings.storefrontCopy.paymentCheckout} />
    </div>
  );
}
