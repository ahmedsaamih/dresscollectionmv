import React from 'react';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { getCatalog } from '@/lib/catalog';
import { StatusClient } from './StatusClient';

export const dynamic = 'force-dynamic';

export default async function StatusPage() {
  const { settings, collections } = await getCatalog();
  const navCopy = settings.storefrontCopy.homepageNavigation;

  return (
    <div className="min-h-screen bg-page text-body font-archivo">
      <Header tagline={settings.tagline} collections={collections} navCopy={navCopy} />
      <StatusClient copy={settings.storefrontCopy.cartQuoteStatus} slipCopy={settings.storefrontCopy.paymentCheckout} />
      <Footer tagline={settings.tagline} collections={collections} navCopy={navCopy} paymentCopy={settings.storefrontCopy.paymentCheckout} />
    </div>
  );
}
