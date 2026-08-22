'use client';
import React, { useEffect, useState, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { ProductImage } from '@/components/ProductImage';
import type { Product } from '@/lib/types';

function ResultCard({ p }: { p: Product }) {
  return (
    <Link href={`/product/${p.id}`} className="no-underline bg-[#f5f1f3] border border-[rgba(0,0,0,.08)] rounded-2xl overflow-hidden hover:-translate-y-1 hover:border-[rgba(219,87,149,.3)] transition-all block">
      <ProductImage img={p.img} colorImages={p.colorImages} className="h-[150px] relative">
        {p.status === 'soldout' && <div className="absolute inset-0 bg-[rgba(8,8,8,.55)] flex items-center justify-center"><span className="text-[11px] font-extrabold tracking-[.1em] uppercase text-[#ffe9f3] border border-[rgba(255,255,255,.25)] px-3 py-1.5 rounded-[8px]">Sold out</span></div>}
      </ProductImage>
      <div className="p-[15px]">
        <div className="font-bold text-[14px] text-body">{p.name}</div>
        <div className="text-[11.5px] text-muted mt-[3px]">{p.sub}</div>
        <div className="flex items-center justify-between mt-3">
          <span className="font-extrabold text-[15px] text-rose-700 tabular">MVR {p.price}</span>
          <span className="text-[11px] text-muted capitalize">{p.category}</span>
        </div>
      </div>
    </Link>
  );
}

function SkeletonGrid() {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-[18px]" aria-hidden="true">
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="bg-[#f5f1f3] border border-[rgba(0,0,0,.08)] rounded-2xl overflow-hidden">
          <div className="h-[150px] bg-[rgba(0,0,0,.07)] animate-pulse" />
          <div className="p-[15px]">
            <div className="h-[14px] w-3/4 bg-[rgba(0,0,0,.08)] rounded animate-pulse" />
            <div className="h-[11px] w-1/2 bg-[rgba(0,0,0,.07)] rounded mt-2 animate-pulse" />
            <div className="h-[15px] w-1/3 bg-[rgba(0,0,0,.08)] rounded mt-3 animate-pulse" />
          </div>
        </div>
      ))}
    </div>
  );
}

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
      <p className="text-[14px] text-sub mt-2 mb-6" aria-live="polite">
        {q ? <>Results for <span className="text-rose-700 font-semibold">“{q}”</span>{!loading && <> · {products.length} found</>}</> : 'Type at least two characters to search.'}
      </p>

      {loading && q.length >= 2 ? (
        <SkeletonGrid />
      ) : products.length > 0 ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-[18px]">
          {products.map((p) => <ResultCard key={p.id} p={p} />)}
        </div>
      ) : q.length >= 2 ? (
        <div className="border border-dashed border-[rgba(0,0,0,.14)] rounded-[18px] py-16 px-6 text-center">
          <div className="font-bold text-[19px]">No matches for “{q}”</div>
          <div className="text-[13.5px] text-[#705260] mt-[7px]">Try a different term, or browse the collections.</div>
          <div className="flex gap-3 justify-center mt-[18px] flex-wrap">
            <Link href="/ready-made" className="no-underline bg-rose-500 text-[#200612] font-extrabold text-[13px] px-[18px] py-[10px] rounded-[10px]">New Arrivals</Link>
            <Link href="/casual-wear" className="no-underline border border-[rgba(0,0,0,.16)] text-body font-bold text-[13px] px-[18px] py-[10px] rounded-[10px]">Casual Dresses</Link>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export default function SearchPage() {
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
