import React from 'react';
import { getCatalog } from '@/lib/catalog';
import { CartClient } from './CartClient';

export const dynamic = 'force-dynamic';

export default async function CartPage() {
  const { settings, collections, products } = await getCatalog();
  return <CartClient settings={settings} collections={collections} products={products} />;
}
