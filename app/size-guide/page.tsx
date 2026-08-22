'use client';
import React, { useState } from 'react';
import Link from 'next/link';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { useStore } from '@/contexts/StoreContext';

export default function SizeGuidePage() {
  const { data } = useStore();
  const copy = data.settings.storefrontCopy.productCatalog;
  const charts = data.sizeCharts;
  const [tab, setTab] = useState(() => Math.max(0, charts.findIndex(c => c.isDefault)));
  const chart = charts[Math.min(tab, Math.max(0, charts.length - 1))];

  return (
    <div className="min-h-screen bg-page text-body font-archivo">
      <Header />
      <div className="max-w-[900px] mx-auto px-5 sm:px-8 py-12 pb-[90px]">
        <h1 className="font-archivo-narrow font-bold text-[30px] sm:text-[42px] tracking-[.01em]">Size guide</h1>

        {charts.length === 0 ? (
          <div className="border border-dashed border-[rgba(0,0,0,.14)] rounded-2xl py-16 text-center text-[14px] text-muted mt-6">
            No size chart has been published yet.
          </div>
        ) : (
          <>
            {chart.note && (
              <p className="text-[14.5px] text-sub mt-[9px] mb-6 max-w-[560px]">{chart.note}</p>
            )}

            {charts.length > 1 && (
              <div className="flex gap-2 mb-[22px] flex-wrap">
                {charts.map((c, i) => {
                  const on = i === tab;
                  return (
                    <button key={c.id} onClick={() => setTab(i)}
                      className="font-semibold text-[13px] px-4 py-[9px] rounded-[9px] cursor-pointer transition-all"
                      style={{ border: on ? 'none' : '1px solid rgba(0,0,0,.1)', background: on ? '#db5795' : 'rgba(0,0,0,.08)', color: on ? '#200612' : '#705260' }}>
                      {c.name}
                    </button>
                  );
                })}
              </div>
            )}

            <div className="bg-surface border border-[rgba(0,0,0,.08)] rounded-2xl overflow-x-auto max-w-full">
              <div className="min-w-[460px] w-max">
                <div className="grid bg-[rgba(219,87,149,.06)] border-b border-[rgba(219,87,149,.15)]" style={{ gridTemplateColumns: `repeat(${chart.columns.length},1fr)` }}>
                  {chart.columns.map((h, i) => <div key={i} className="px-[18px] py-[14px] text-[12px] font-extrabold tracking-[.06em] uppercase text-rose-700">{h}</div>)}
                </div>
                {chart.rows.map((row, ri) => (
                  <div key={ri} className="grid border-b border-[rgba(0,0,0,.07)] last:border-0" style={{ gridTemplateColumns: `repeat(${chart.columns.length},1fr)` }}>
                    {chart.columns.map((_, ci) => (
                      <div key={ci} className={`px-[18px] py-[14px] text-[14px] tabular ${ci === 0 ? 'font-extrabold text-body' : 'text-sub'}`}>{row[ci] ?? ''}</div>
                    ))}
                  </div>
                ))}
              </div>
            </div>
          </>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-[18px] mt-6">
          <div className="bg-surface border border-[rgba(0,0,0,.08)] rounded-[14px] p-5">
            <div className="font-bold text-[15px] mb-[10px]">{copy.sizeGuideMeasureTitle}</div>
            <div className="text-[13px] text-[#705260] leading-[1.7]">{copy.sizeGuideMeasureBody}</div>
          </div>
          <div className="border border-[rgba(219,87,149,.16)] rounded-[14px] p-5" style={{ background: 'linear-gradient(135deg,#fbeaf2,#f7f2f4)' }}>
            <div className="font-bold text-[15px] mb-[10px]">{copy.sizeGuideTeamTitle}</div>
            <div className="text-[13px] text-sub leading-[1.6]">{copy.sizeGuideTeamBody}</div>
            <Link href="/contact" className="inline-block mt-[14px] text-rose-700 no-underline font-bold text-[13px]">{copy.sizeGuideBuilderCta} →</Link>
          </div>
        </div>
      </div>
      <Footer />
    </div>
  );
}
