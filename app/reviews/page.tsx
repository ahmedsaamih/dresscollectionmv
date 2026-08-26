import React from 'react';
import type { Metadata } from 'next';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { StarRating } from '@/components/StarRating';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Customer Reviews',
  description: 'What customers say about their orders from Dress Collection.',
  alternates: { canonical: '/reviews' },
  openGraph: { url: '/reviews' },
};

export default async function ReviewsPage() {
  const rows = await prisma.review.findMany({
    where: { status: 'approved' },
    orderBy: { resolvedAt: 'desc' },
    select: { id: true, rating: true, quote: true, authorName: true, authorRole: true },
  });
  const reviews = rows.map((r) => ({
    id: r.id,
    rating: r.rating,
    quote: r.quote ?? '',
    name: r.authorName ?? '',
    role: r.authorRole ?? '',
  }));

  return (
    <div className="min-h-screen bg-page text-body font-archivo">
      <Header />
      <div className="max-w-[1180px] mx-auto px-5 sm:px-8 py-[52px]">
        <div className="text-center mb-[34px]">
          <h1 className="font-archivo-narrow font-bold text-[30px] sm:text-[40px]">Customer reviews</h1>
          <p className="text-[14px] text-sub mt-2">What customers say about their orders.</p>
        </div>

        {reviews.length === 0 ? (
          <div className="text-center text-sub py-16">No reviews yet.</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-[18px]">
            {reviews.map((r) => (
              <div key={r.id} className="bg-[#f9f6f7] rounded-2xl p-[26px] transition-shadow hover:shadow-card-hover">
                <StarRating rating={r.rating ?? 5} size={15} className="text-rose-700" />
                <p className="text-[14.5px] leading-[1.6] text-[#705260] mt-[14px]">&quot;{r.quote}&quot;</p>
                <div className="flex items-center gap-[11px] mt-[18px]">
                  <div className="w-[38px] h-[38px] rounded-full bg-[linear-gradient(135deg,#600a32,#36021a)] flex-none" />
                  <div>
                    <div className="text-[13px] font-bold text-body">{r.name}</div>
                    <div className="text-[11.5px] text-muted">{r.role}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      <Footer />
    </div>
  );
}
