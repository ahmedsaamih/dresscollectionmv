import React from 'react';
import { getCatalog } from '@/lib/catalog';
import { CheckoutClient } from './CheckoutClient';

export const dynamic = 'force-dynamic';

export default async function CheckoutPage() {
  const { settings, collections, deliveryAreas, products } = await getCatalog();
  return <CheckoutClient settings={settings} collections={collections} deliveryAreas={deliveryAreas} products={products} />;
}
