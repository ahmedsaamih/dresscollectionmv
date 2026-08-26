'use client';
import React, { useEffect, useState, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { ProductCard } from '@/components/ProductCard';
import { ProductGridSkeleton } from '@/components/ProductSkeleton';
import type { Product } from '@/lib/types';

function SearchResults() {
  const params = useSearchParams();
  const q = (params.get('q') || '').trim();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    setLoading(true);
    fetch(`/api/search?q=${encodeURIComponent(q)}`)
      .then((r) => r.json())
      .then((d) => { if (active) setProducts(d.products || []); })
      .catch(() => { if (active) setProducts([]); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [q]);

  return (
    <div className="max-w-[1180px] mx-auto px-5 sm:px-8 py-[26px] pb-20">
      <div className="text-[12.5px] text-muted mb-[18px]">
        <Link href="/" className="text-muted no-underline hover:text-rose-700">Home</Link>
        <span className="mx-[7px]">/</span><span className="text-sub">Search</span>
      </div>
      <h1 className="font-archivo-narrow font-bold text-[28px] sm:text-[40px] tracking-[.01em]">Search</h1>
      <p className="text-[14px] text-sub mt-2 mb-7" aria-live="polite">
        {q ? <>Results for <span className="text-rose-700 font-semibold">“{q}”</span>{!loading && <> · {products.length} found</>}</> : 'Type at least two characters to search.'}
      </p>

      {loading && q.length >= 2 ? (
        <ProductGridSkeleton count={8} cols={4} />
      ) : products.length > 0 ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-x-[18px] gap-y-[34px]">
          {products.map((p) => <ProductCard key={p.id} product={p} />)}
        </div>
      ) : q.length >= 2 ? (
        <div className="border border-dashed border-[rgba(0,0,0,.14)] rounded-[18px] py-16 px-6 text-center">
          <div className="font-bold text-[19px]">No matches for “{q}”</div>
          <div className="text-[13.5px] text-[#705260] mt-[7px]">Try a different term, or browse the collections.</div>
          <div className="flex gap-3 justify-center mt-[18px] flex-wrap">
            <Link href="/ready-made" className="no-underline bg-rose-500 text-[#200612] font-extrabold uppercase tracking-[.06em] text-[12px] px-[20px] py-[12px] rounded-full">New Arrivals</Link>
            <Link href="/casual-wear" className="no-underline border border-[rgba(0,0,0,.16)] text-body font-bold uppercase tracking-[.06em] text-[12px] px-[20px] py-[12px] rounded-full">Casual Dresses</Link>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export function SearchClient() {
  return (
    <div className="min-h-screen bg-page text-body font-archivo">
      <Header />
      <Suspense fallback={null}>
        <SearchResults />
      </Suspense>
      <Footer />
    </div>
  );
}
