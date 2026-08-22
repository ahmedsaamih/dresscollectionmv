'use client';
import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Ruler, X } from 'lucide-react';
import type { SizeChart } from '@/lib/types';

/**
 * Self-contained "Size chart" link + modal. Drop <SizeChartTrigger chart={...} />
 * anywhere sizes are shown, passing the effective chart (a collection's assigned
 * chart, or the store default — see lib/sizeChart.ts:resolveSizeChart). Renders
 * nothing if there's no chart to show.
 */
export function SizeChartTrigger({ chart, className = '', label = 'Size chart' }: { chart: SizeChart | null; className?: string; label?: string }) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  if (!chart) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={className || 'inline-flex items-center gap-[5px] text-[12px] font-semibold text-rose-700 hover:text-rose-600 transition-colors cursor-pointer bg-transparent border-none'}
      >
        <Ruler size={13} aria-hidden="true" /> {label}
      </button>
      {open && mounted && createPortal(<SizeChartModal chart={chart} onClose={() => setOpen(false)} />, document.body)}
    </>
  );
}

export function SizeChartModal({ chart, onClose }: { chart: SizeChart; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    document.body.classList.add('size-chart-open');
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.classList.remove('size-chart-open');
      document.body.style.overflow = previousOverflow;
    };
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-[95] bg-[rgba(4,8,7,.8)] backdrop-blur-md flex items-center justify-center p-3 sm:p-6 font-archivo overflow-hidden" onClick={onClose}>
      <div role="dialog" aria-modal="true" aria-label="Size chart" className="w-[640px] max-w-[calc(100vw-24px)] max-h-[90vh] overflow-y-auto overflow-x-hidden bg-surface border border-[rgba(219,87,149,.25)] rounded-[20px] p-4 sm:p-6 text-body" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-4 mb-4">
          <div>
            <h3 className="font-archivo-narrow font-bold text-[22px]">{chart.name} size chart</h3>
            {chart.note && <p className="text-[12.5px] text-sub mt-1 max-w-[460px] leading-[1.5]">{chart.note}</p>}
          </div>
          <button onClick={onClose} aria-label="Close" className="border-none bg-transparent text-muted cursor-pointer"><X size={20} /></button>
        </div>

        <div className="border border-[rgba(0,0,0,.08)] rounded-2xl overflow-x-auto max-w-full">
          <div className="min-w-[420px] w-max">
            <div className="grid bg-[rgba(219,87,149,.06)] border-b border-[rgba(219,87,149,.15)]" style={{ gridTemplateColumns: `repeat(${chart.columns.length},1fr)` }}>
              {chart.columns.map((h, i) => (
                <div key={i} className="px-[16px] py-[12px] text-[11.5px] font-extrabold tracking-[.06em] uppercase text-rose-700">{h}</div>
              ))}
            </div>
            {chart.rows.map((row, ri) => (
              <div key={ri} className="grid border-b border-[rgba(0,0,0,.07)] last:border-0" style={{ gridTemplateColumns: `repeat(${chart.columns.length},1fr)` }}>
                {chart.columns.map((_, ci) => (
                  <div key={ci} className={`px-[16px] py-[12px] text-[13.5px] tabular ${ci === 0 ? 'font-extrabold text-body' : 'text-sub'}`}>{row[ci] ?? ''}</div>
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
