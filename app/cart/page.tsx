import React from 'react';
import type { Metadata } from 'next';
import { getCatalog } from '@/lib/catalog';
import { CartClient } from './CartClient';

export const dynamic = 'force-dynamic';

// Also disallowed in robots.ts — this is a defense-in-depth noindex in case
// the page is ever linked to and crawled despite that.
export const metadata: Metadata = {
  title: 'Your Cart',
  robots: { index: false, follow: false },
};

export default async function CartPage() {
  const { settings, collections, products } = await getCatalog();
  return <CartClient settings={settings} collections={collections} products={products} />;
}
