import React from 'react';
import type { Metadata } from 'next';
import { getCatalog } from '@/lib/catalog';
import { CheckoutClient } from './CheckoutClient';

export const dynamic = 'force-dynamic';

// Also disallowed in robots.ts — this is a defense-in-depth noindex in case
// the page is ever linked to and crawled despite that.
export const metadata: Metadata = {
  title: 'Checkout',
  robots: { index: false, follow: false },
};

export default async function CheckoutPage() {
  const { settings, collections, deliveryAreas, products } = await getCatalog();
  return <CheckoutClient settings={settings} collections={collections} deliveryAreas={deliveryAreas} products={products} />;
}
