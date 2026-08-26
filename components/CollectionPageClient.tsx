'use client';
import React from 'react';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { CatalogLayout } from '@/components/CatalogLayout';
import { ProductCard } from '@/components/ProductCard';
import { useReveal } from '@/lib/useReveal';
import type { Product, SizeChart, StoreCollection, StorefrontCopy } from '@/lib/types';

interface CollectionPageClientProps {
  active: string;
  tagline: string;
  collections: StoreCollection[];
  navCopy: StorefrontCopy['homepageNavigation'];
  paymentCopy: StorefrontCopy['paymentCheckout'];
  catalogCopy: StorefrontCopy['productCatalog'];
  breadcrumb: string;
  title: string;
  subtitle: string;
  categoryLabel: string;
  products: Product[];
  noun: string;
  sizeChart: SizeChart | null;
}

/** Shared client shell for every collection-scoped catalog page (ready-made,
 * casual-wear, accessories, [collection]) — filtering/copy differ per page,
 * everything else (reveal animation, layout, card rendering) is identical. */
export function CollectionPageClient({
  active, tagline, collections, navCopy, paymentCopy, catalogCopy,
  breadcrumb, title, subtitle, categoryLabel, products, noun, sizeChart,
}: CollectionPageClientProps) {
  useReveal();

  return (
    <div className="min-h-screen bg-page text-body font-archivo">
      <Header active={active} tagline={tagline} collections={collections} navCopy={navCopy} />
      <CatalogLayout
        breadcrumb={breadcrumb}
        title={title}
        subtitle={subtitle}
        categoryLabel={categoryLabel}
        products={products}
        renderCard={(p) => <ProductCard product={p} viewOptionsLabel={catalogCopy.viewOptionsLabel} />}
        noun={noun}
        sizeChart={sizeChart}
        copy={catalogCopy}
      />
      <Footer tagline={tagline} collections={collections} navCopy={navCopy} paymentCopy={paymentCopy} />
    </div>
  );
}
