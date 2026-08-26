import React from 'react';
import { getCatalog } from '@/lib/catalog';
import { HomeClient } from './HomeClient';

export const dynamic = 'force-dynamic';

export default async function HomePage() {
  const { settings, collections, products, reviews } = await getCatalog();
  const featured = products.filter(p => p.collection === 'ready').slice(0, 4);
  const accessories = products.filter(p => p.collection === 'accessories').slice(0, 6);

  return (
    <HomeClient settings={settings} collections={collections} featured={featured} accessories={accessories} testimonials={reviews} />
  );
}
