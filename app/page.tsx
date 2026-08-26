import React from 'react';
import type { Metadata } from 'next';
import { getCatalog } from '@/lib/catalog';
import { HomeClient } from './HomeClient';

export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  const { settings } = await getCatalog();
  const description = settings.heroSub || undefined;
  return {
    description,
    alternates: { canonical: '/' },
    openGraph: { url: '/', description, images: settings.heroImage ? [{ url: settings.heroImage }] : undefined },
    twitter: { description, images: settings.heroImage ? [settings.heroImage] : undefined },
  };
}

export default async function HomePage() {
  const { settings, collections, products, reviews } = await getCatalog();
  const featured = products.filter(p => p.collection === 'ready').slice(0, 4);
  const accessories = products.filter(p => p.collection === 'accessories').slice(0, 6);

  return (
    <HomeClient settings={settings} collections={collections} featured={featured} accessories={accessories} testimonials={reviews} />
  );
}
