'use client';
import React, { useState } from 'react';
import Link from 'next/link';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { Toast } from '@/components/Toast';
import { Button } from '@/components/Button';
import { CatalogLayout } from '@/components/CatalogLayout';
import { SizeChartTrigger } from '@/components/SizeChart';
import { ProductImage } from '@/components/ProductImage';
import { MMCart } from '@/lib/cart';
import { useStore } from '@/contexts/StoreContext';
import { useReveal } from '@/lib/useReveal';
import { COLOR_MAP, readArtworkFile, formatFileSize, ARTWORK_FILE_ACCEPT } from '@/lib/utils';
import { resolveSizeChart } from '@/lib/sizeChart';
import { X, Upload } from 'lucide-react';
import type { Product } from '@/lib/types';

const SIZES = ['XS','S','M','L','XL','2XL'];
const PLACEMENTS = [
  { k:'front', label:'Front' },{ k:'back', label:'Back' },
  { k:'both', label:'Front & back' },{ k:'sleeve', label:'Sleeve' },
];

export default function CasualWearPage() {
  const { data, loading } = useStore();
  useReveal();
  const [toast, setToast] = useState<{ title:string; sub:string; href:string }|null>(null);
  const [modal, setModal] = useState<Product|null>(null);
  const [art, setArt] = useState<{ name:string; url:string; size:string; previewable:boolean }|null>(null);
  const [placement, setPlacement] = useState('front');
  const [sizes, setSizes] = useState<Record<string,number>>({});

  const colorHex = (name: string) => data.builderOptions.colors.find(c => c.name === name)?.hex ?? COLOR_MAP[name] ?? '#888';
  const products = data.products.filter(p => p.collection==='casual');
  const colMeta = data.collections.find(c => c.key === 'casual');
  const chart = resolveSizeChart(data.sizeCharts, colMeta?.sizeChartId);
  const totalUnits = Object.values(sizes).reduce((a,b)=>a+b,0);

  const onArt = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    const read = await readArtworkFile(file);
    setArt({ name: read.name, url: read.url, size: formatFileSize(read.size), previewable: read.previewable });
  };

  const addToQuote = () => {
    if (!modal || totalUnits===0) return;
    const sl = SIZES.filter(k=>sizes[k]).map(k=>k+sizes[k]).join(' ');
    const placeLabel = PLACEMENTS.find(p=>p.k===placement)?.label ?? 'Front';
    MMCart.addQuote({ kind:'casual', name:modal.name+' · custom', specs:placeLabel+(art?' · '+art.name:' · artwork TBC'),
      units:totalUnits, sizesLabel:sl, sizes:{ ...sizes },
      swatch:colorHex(modal.colors[0]), artName:art?.name??null, placement:placement as any });
    setToast({ title:'Added to quote', sub:modal.name+' · '+totalUnits+' units', href:'/quote' });
    setModal(null); setArt(null); setSizes({}); setPlacement('front');
  };

  const openModal = (p: Product) => { setModal(p); setArt(null); setSizes({}); setPlacement('front'); };

  const renderCard = (p: Product) => (
    <div className="bg-[#f5f1f3] border border-[rgba(0,0,0,.08)] rounded-2xl overflow-hidden hover:-translate-y-1 hover:border-[rgba(219,87,149,.3)] transition-all">
      <ProductImage href={`/product/${p.id}`} img={p.img} colorImages={p.colorImages} className="block no-underline h-[200px] relative">
        {p.customizable && <span className="absolute top-3 left-3 text-[10px] font-extrabold tracking-[.06em] uppercase text-[#200612] bg-rose-500 px-[9px] py-1 rounded-[6px]">Add print</span>}
        <div className="absolute bottom-[10px] right-3 text-[10px] tracking-[.14em] uppercase text-[rgba(255,255,255,.4)]">{p.category}</div>
      </ProductImage>
      <div className="p-4">
        <Link href={`/product/${p.id}`} className="no-underline text-body font-bold text-[14.5px] block hover:text-rose-600 transition-colors">{p.name}</Link>
        <div className="text-[11.5px] text-muted mt-[3px]">{p.sub}</div>
        <div className="flex gap-[6px] mt-[11px]">
          {p.colors.map(c=><span key={c} className="w-[15px] h-[15px] rounded-[4px] border border-[rgba(0,0,0,.12)]" style={{ background:colorHex(c) }}/>)}
        </div>
        <div className="flex items-center justify-between mt-[13px]">
          <span className="font-extrabold text-[16px] text-rose-700 tabular">MVR {p.price}</span>
          <div className="flex gap-2">
            {p.customizable ? (
              <>
                <Button variant="secondary" size="xs" onClick={()=>openModal(p)}>Add print</Button>
                <Button variant="secondary" size="xs" href={`/product/${p.id}`}>View options</Button>
              </>
            ) : (
              <Button variant="secondary" size="xs" href={`/product/${p.id}`}>View options</Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-page text-body font-archivo">
      <Header active="casual" />
      <CatalogLayout
        breadcrumb="Casual Dresses"
        title="Casual Dresses"
        subtitle="Easy, everyday dressing — comfortable enough for daytime, pretty enough for anywhere."
        categoryLabel="Style"
        products={products}
        loading={loading}
        renderCard={renderCard}
        noun="dresses"
        sizeChart={chart}
      />
      <Footer />

      {/* Custom print modal */}
      {modal && (
        <div className="fixed inset-0 z-[80] bg-[rgba(4,8,7,.78)] backdrop-blur-md flex items-center justify-center p-6" onClick={()=>setModal(null)}>
          <div className="w-[560px] max-w-full max-h-[90vh] overflow-auto bg-surface border border-[rgba(193,57,120,.3)] rounded-[20px] p-[26px]" onClick={e=>e.stopPropagation()}>
            <div className="flex items-start justify-between gap-[14px]">
              <div>
                <div className="flex items-center gap-[9px]">
                  <h3 className="font-archivo-narrow font-bold text-[24px]">Add your design</h3>
                  <span className="text-[9px] font-extrabold uppercase text-rose-600 bg-[rgba(193,57,120,.15)] px-2 py-[3px] rounded-[5px]">Quote</span>
                </div>
                <p className="text-[13px] text-sub mt-[7px]">{modal.name} · upload artwork, we'll quote the print. No price now.</p>
              </div>
              <button onClick={()=>setModal(null)} className="border-none bg-transparent text-muted cursor-pointer"><X size={20} /></button>
            </div>
            <div className="mt-5">
              <div className="text-[12px] font-bold text-[#705260] mb-[9px]">Your artwork</div>
              {!art ? (
                <label className="block border-[1.5px] border-dashed border-[rgba(219,87,149,.35)] rounded-[14px] p-6 text-center bg-[rgba(219,87,149,.03)] cursor-pointer hover:bg-[rgba(219,87,149,.06)] transition-colors">
                  <input type="file" accept={ARTWORK_FILE_ACCEPT} onChange={onArt} className="hidden"/>
                  <div className="w-11 h-11 rounded-xl bg-[rgba(219,87,149,.12)] inline-flex items-center justify-center text-rose-700"><Upload size={22} /></div>
                  <div className="text-[13px] font-semibold text-[#705260] mt-[11px]">Upload design / logo</div>
                  <div className="text-[11px] text-muted mt-[3px]">PNG, SVG, PDF, AI, PSD · original quality kept</div>
                </label>
              ) : (
                <div className="flex items-center gap-3 bg-well border border-[rgba(219,87,149,.25)] rounded-xl p-[13px]">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  {art.previewable
                    ? <img src={art.url} alt="" className="w-[54px] h-[54px] rounded-[10px] object-cover flex-none bg-white"/>
                    : <div className="w-[54px] h-[54px] rounded-[10px] flex-none bg-white flex items-center justify-center text-[10px] font-bold text-[#200612]">FILE</div>}
                  <div className="flex-1 min-w-0"><div className="text-[13px] text-[#705260] truncate">{art.name}</div><div className="text-[11.5px] text-rose-600 mt-1">{art.size}</div></div>
                  <button onClick={()=>setArt(null)} className="border-none bg-transparent text-muted cursor-pointer"><X size={17} /></button>
                </div>
              )}
            </div>
            <div className="mt-[18px]">
              <div className="text-[12px] font-bold text-[#705260] mb-[9px]">Print placement</div>
              <div className="flex gap-[9px] flex-wrap">
                {PLACEMENTS.map(pl => {
                  const on=placement===pl.k;
                  return <button key={pl.k} onClick={()=>setPlacement(pl.k)} className="font-semibold text-[12.5px] px-[14px] py-[9px] rounded-[9px] cursor-pointer transition-all" style={{ border:on?'none':'1px solid rgba(0,0,0,.14)', background:on?'#db5795':'transparent', color:on?'#200612':'#705260' }}>{pl.label}</button>;
                })}
              </div>
            </div>
            <div className="mt-[18px]">
              <div className="flex items-center justify-between mb-[10px]">
                <div className="flex items-center gap-3">
                  <div className="text-[12px] font-bold text-[#705260]">Sizes & quantity</div>
                  <SizeChartTrigger chart={chart} label="Size chart" />
                </div>
                <div className="text-[12px] text-sub">Total <span className="text-rose-700 font-extrabold tabular">{totalUnits} units</span></div>
              </div>
              <div className="grid grid-cols-4 sm:grid-cols-6 gap-[9px]">
                {SIZES.map(sz => {
                  const q=sizes[sz]??0;
                  return (
                    <div key={sz} className="bg-well rounded-xl p-[9px_6px] text-center" style={{ border:q?'1px solid rgba(219,87,149,.3)':'1px solid rgba(0,0,0,.08)' }}>
                      <div className="text-[11.5px] font-extrabold text-[#705260]">{sz}</div>
                      <div className="flex items-center justify-center gap-[3px] mt-[7px]">
                        <button onClick={()=>setSizes(s=>({ ...s,[sz]:Math.max(0,(s[sz]??0)-1) }))} className="w-[22px] h-[22px] rounded-[6px] border-none bg-[rgba(0,0,0,.08)] text-rose-700 text-[14px] cursor-pointer">−</button>
                        <span className="w-5 text-center font-extrabold text-[14px] tabular" style={{ color:q?'#600a32':'#b29fa8' }}>{q}</span>
                        <button onClick={()=>setSizes(s=>({ ...s,[sz]:(s[sz]??0)+1 }))} className="w-[22px] h-[22px] rounded-[6px] border-none bg-[rgba(0,0,0,.08)] text-rose-700 text-[14px] cursor-pointer">+</button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
            <Button onClick={addToQuote} disabled={totalUnits === 0} className="w-full mt-[22px]">
              Add to quote
            </Button>
          </div>
        </div>
      )}

      {toast && <Toast title={toast.title} sub={toast.sub} href={toast.href} variant={toast.href.includes('quote')?'quote':'cart'} onDismiss={()=>setToast(null)}/>}
    </div>
  );
}
