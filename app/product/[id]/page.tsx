import React from 'react';
import type { Metadata } from 'next';
import { getCatalog } from '@/lib/catalog';
import { resolveSizeChart } from '@/lib/sizeChart';
import { parseImageValue } from '@/lib/image-value';
import { SITE_URL } from '@/lib/site';
import { ProductDetailClient } from './ProductDetailClient';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const { products } = await getCatalog();
  const product = products.find(p => p.id === id) ?? null;

  if (!product) {
    return { title: 'Product Not Found', robots: { index: false, follow: false } };
  }

  const description = product.sub
    ? `${product.name} — ${product.sub}. Shop at Dress Collection, delivered across the Maldives.`
    : `${product.name}. Shop at Dress Collection, delivered across the Maldives.`;
  const imageValue = parseImageValue(product.img);
  const image = imageValue.type === 'url' ? [{ url: imageValue.src }] : undefined;

  return {
    title: product.name,
    description,
    alternates: { canonical: `/product/${product.id}` },
    openGraph: { url: `/product/${product.id}`, description, images: image, type: 'website' },
    twitter: { description, images: image?.map(i => i.url) },
  };
}

export default async function ProductPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { settings, collections, products, sizeCharts } = await getCatalog();

  const product = products.find(p => p.id === id) ?? null;
  const colMeta = product ? collections.find(c => c.key === product.collection) : undefined;
  const chart = resolveSizeChart(sizeCharts, colMeta?.sizeChartId);
  const colorSiblings = product
    ? products.filter(p => p.id !== product.id && p.name === product.name)
    : [];
  const collectionRelated = product
    ? products.filter(p =>
        p.collection === product.collection &&
        p.id !== product.id &&
        !colorSiblings.some(s => s.id === p.id)
      )
    : [];
  const related = [...colorSiblings, ...collectionRelated].slice(0, 4);

  const productJsonLd = product ? (() => {
    const imageValue = parseImageValue(product.img);
    return {
      '@context': 'https://schema.org',
      '@type': 'Product',
      name: product.name,
      description: product.sub || product.name,
      sku: product.id,
      category: product.category,
      ...(imageValue.type === 'url' ? { image: [imageValue.src] } : {}),
      offers: {
        '@type': 'Offer',
        url: `${SITE_URL}/product/${product.id}`,
        priceCurrency: settings.currency,
        price: product.effectivePrice,
        availability: product.status === 'soldout' || product.stock === 0
          ? 'https://schema.org/OutOfStock'
          : 'https://schema.org/InStock',
      },
    };
  })() : null;

  return (
    <>
      {productJsonLd && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(productJsonLd) }}
        />
      )}
      <ProductDetailClient
        settings={settings}
        collections={collections}
        product={product}
        chart={chart}
        related={related}
      />
    </>
  );
}
