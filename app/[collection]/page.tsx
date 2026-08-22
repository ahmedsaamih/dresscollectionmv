'use client';
import React, { useState } from 'react';
import { useParams } from 'next/navigation';
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
import { formatMVR, COLOR_MAP, readArtworkFile, formatFileSize, ARTWORK_FILE_ACCEPT } from '@/lib/utils';
import { resolveSizeChart } from '@/lib/sizeChart';
import { Wand2, X, Upload } from 'lucide-react';
import type { Product } from '@/lib/types';
import Link from 'next/link';

type ModalKind = 'semi' | 'full';

const ARTWORK_SLOTS = [
  { key: 'frontLogo',  label: 'Front Logo' },
  { key: 'backLogo',   label: 'Back Logo' },
  { key: 'frontLabel', label: 'Front Label' },
  { key: 'backLabel',  label: 'Back Label' },
  { key: 'placement',  label: 'Placement reference' },
] as const;
type SlotKey = (typeof ARTWORK_SLOTS)[number]['key'];
type SlotMap = Record<SlotKey, { name: string; url: string; previewable: boolean } | null>;
const emptySlots = (): SlotMap => ({
  frontLogo: null, backLogo: null, frontLabel: null, backLabel: null, placement: null,
});

export default function CollectionPage() {
  const { collection: colKey } = useParams<{ collection: string }>();
  const { data, loading } = useStore();
  useReveal();
  const [toast, setToast] = useState<{ title: string; sub: string; href: string } | null>(null);
  const [modal, setModal] = useState<{ product: Product; kind: ModalKind } | null>(null);

  // ── Semi-customize state
  const [semiMaterial, setSemiMaterial] = useState('');
  const [semiSleeve,   setSemiSleeve]   = useState('');
  const [semiCollar,   setSemiCollar]   = useState('');
  const [semiColor,    setSemiColor]    = useState('');
  const [semiSizes,    setSemiSizes]    = useState<Record<string, number>>({});
  const [semiArts,     setSemiArts]     = useState<SlotMap>(emptySlots());

  // ── Full-customize state
  const [fullMaterial, setFullMaterial] = useState('');
  const [fullCollar,   setFullCollar]   = useState('');
  const [longSizes,    setLongSizes]    = useState<Record<string, number>>({});
  const [shortSizes,   setShortSizes]   = useState<Record<string, number>>({});
  const [fullArt,      setFullArt]      = useState<{ name: string; url: string; size: string; previewable: boolean } | null>(null);

  const colMeta = data.collections.find(c => c.key === colKey);
  const products = data.products.filter(p => p.collection === colKey);
  const chart = resolveSizeChart(data.sizeCharts, colMeta?.sizeChartId);

  const colorHex = (name: string) =>
    data.builderOptions.colors.find(c => c.name === name)?.hex ?? COLOR_MAP[name] ?? '#888';

  // p.status is a manually-set admin field that nothing flips to 'soldout' as
  // real Inventory depletes via checkout/POS/transfers, so it goes stale.
  // Fall back to the live-computed stock for actually stock-tracked products
  // (mirrors checkout's own stockDecremented rule) — made-to-order
  // customizable products outside 'casual' aren't stock-tracked at all, so
  // their stock being 0 doesn't mean sold out.
  const isSoldOut = (p: Product) =>
    p.status === 'soldout' || ((!p.customizable || p.collection === 'casual') && p.stock === 0);

  const addToCart = (p: Product) => {
    const size = p.sizes[0] || 'One';
    const color = p.colors[0] || 'Default';
    // Inventory keys blank sizeless/colourless combos as '', not the 'One'/
    // 'Default' display labels used for the cart line below — look stock up
    // by the real key so a genuinely in-stock blank-variant product isn't
    // incorrectly blocked.
    const stock = p.colorSizeStock?.[p.colors[0] ?? '']?.[p.sizes[0] ?? ''] ?? 0;
    const existingQty = MMCart.get().fixed
      .filter(i => i.sku === p.id && i.size === size && i.color === color)
      .reduce((a, i) => a + i.qty, 0);
    if (existingQty >= stock) return;
    MMCart.addFixed({ sku: p.id, name: p.name, meta: p.sub, price: p.price, img: p.img, size, color, qty: 1 });
    setToast({ title: 'Added to cart', sub: p.name + ' · ' + formatMVR(p.price), href: '/cart' });
  };

  const seedSemiFrom = (p: Product) => {
    const sleeveOpts = p.sleeves.length > 0
      ? data.builderOptions.sleeves.filter(s => p.sleeves.includes(s.label))
      : [];
    const neckOpts = p.necks.length > 0
      ? data.builderOptions.necks.filter(n => p.necks.includes(n.label))
      : [];
    setSemiMaterial(p.materials[0] ?? '');
    setSemiSleeve(sleeveOpts[0]?.label ?? '');
    setSemiCollar(neckOpts[0]?.label ?? '');
    setSemiColor(p.colors[0] ?? '');
    setSemiSizes({});
    setSemiArts(emptySlots());
  };

  const seedFullFrom = (p: Product) => {
    const neckOpts = p.necks.length > 0
      ? data.builderOptions.necks.filter(n => p.necks.includes(n.label))
      : [];
    setFullMaterial(p.materials[0] ?? '');
    setFullCollar(neckOpts[0]?.label ?? '');
    setLongSizes({});
    setShortSizes({});
    setFullArt(null);
  };

  const openModal = (p: Product, kind: ModalKind) => {
    if (kind === 'semi') seedSemiFrom(p);
    else seedFullFrom(p);
    setModal({ product: p, kind });
  };

  const openFullCustomModal = () => {
    const first = products.find(pr => pr.customizable);
    if (!first) return;
    openModal(first, 'full');
  };

  const switchFullStyle = (newP: Product) => {
    seedFullFrom(newP);
    setModal(m => (m ? { ...m, product: newP } : m));
  };

  const onSlotFile = async (slot: SlotKey, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    const read = await readArtworkFile(file);
    setSemiArts(a => ({ ...a, [slot]: { name: read.name, url: read.url, previewable: read.previewable } }));
    e.target.value = '';
  };

  const onFullArt = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    const read = await readArtworkFile(file);
    setFullArt({ name: read.name, url: read.url, size: formatFileSize(read.size), previewable: read.previewable });
    e.target.value = '';
  };

  const semiTotal = Object.values(semiSizes).reduce((a, b) => a + b, 0);
  const longTotal  = Object.values(longSizes).reduce((a, b) => a + b, 0);
  const shortTotal = Object.values(shortSizes).reduce((a, b) => a + b, 0);
  const fullTotal  = longTotal + shortTotal;

  const addSemi = () => {
    if (!modal || semiTotal === 0) return;
    const p = modal.product;
    const sl = p.sizes.filter(k => semiSizes[k]).map(k => k + semiSizes[k]).join(' ');
    const specsArr = [semiMaterial, semiSleeve, semiCollar, semiColor].filter(Boolean);
    MMCart.addQuote({
      kind: 'office',
      name: p.name + ' · semi-custom',
      specs: specsArr.join(' · '),
      units: semiTotal,
      sizesLabel: sl,
      sizes: { ...semiSizes },
      swatch: colorHex(semiColor || p.colors[0]),
      fabric: semiMaterial,
      artworks: Object.fromEntries(
        ARTWORK_SLOTS.map(s => [s.key, semiArts[s.key]?.url ?? null])
      ),
    });
    setToast({ title: 'Added to quote', sub: p.name + ' · ' + semiTotal + ' units', href: '/quote' });
    setModal(null);
  };

  const addFull = () => {
    if (!modal || fullTotal === 0) return;
    const p = modal.product;
    const longLabel  = p.sizes.filter(k => longSizes[k]).map(k => k + longSizes[k]).join(' ');
    const shortLabel = p.sizes.filter(k => shortSizes[k]).map(k => k + shortSizes[k]).join(' ');
    const sizesLabel = [
      longLabel  && `Long: ${longLabel}`,
      shortLabel && `Short: ${shortLabel}`,
    ].filter(Boolean).join(' / ');
    const flatSizes: Record<string, number> = {};
    for (const [k, v] of Object.entries(longSizes)) if (v > 0) flatSizes[`Long ${k}`] = v;
    for (const [k, v] of Object.entries(shortSizes)) if (v > 0) flatSizes[`Short ${k}`] = v;
    MMCart.addQuote({
      kind: 'office-full',
      name: p.name + ' · full custom',
      specs: [fullMaterial, fullCollar].filter(Boolean).join(' · '),
      units: fullTotal,
      sizesLabel,
      sizes: flatSizes,
      swatch: colorHex(p.colors[0]),
      fabric: fullMaterial,
      artwork: fullArt?.url ?? null,
      artName: fullArt?.name ?? null,
    });
    setToast({ title: 'Added to quote', sub: p.name + ' · ' + fullTotal + ' units', href: '/quote' });
    setModal(null);
  };

  const chip = (on: boolean) => ({
    border: on ? 'none' : '1px solid rgba(0,0,0,.14)',
    background: on ? '#db5795' : 'transparent',
    color: on ? '#200612' : '#705260',
  });

  const p = modal?.product;
  const semiSleeveOpts = p && p.sleeves.length > 0
    ? data.builderOptions.sleeves.filter(s => p.sleeves.includes(s.label))
    : [];
  const semiCollarOpts = p && p.necks.length > 0
    ? data.builderOptions.necks.filter(n => p.necks.includes(n.label))
    : [];
  const fullCollarOpts = semiCollarOpts;
  const productSizes = p?.sizes ?? [];
  const productMaterials = p?.materials ?? [];
  const fullStyleOpts = products.filter(pr => pr.customizable);

  const isBespoke = colMeta?.bespoke ?? false;
  const colLabel = colMeta?.label ?? colKey;

  // ── Bespoke card (semi + full customize buttons)
  const renderBespokeCard = (p: Product) => (
    <div className="bg-[#f5f1f3] border border-[rgba(0,0,0,.08)] rounded-2xl overflow-hidden hover:-translate-y-1 hover:border-[rgba(219,87,149,.3)] transition-all">
      <ProductImage img={p.img} colorImages={p.colorImages} className="h-[200px] relative">
        {p.customizable && (
          <span className="absolute top-3 left-3 text-[10px] font-extrabold tracking-[.06em] uppercase text-[#200612] bg-rose-500 px-[9px] py-1 rounded-[6px]">
            Customize
          </span>
        )}
        {isSoldOut(p) && (
          <div className="absolute inset-0 bg-[rgba(8,8,8,.55)] flex items-center justify-center">
            <span className="text-[11px] font-extrabold tracking-[.1em] uppercase text-[#ffe9f3] border border-[rgba(255,255,255,.25)] px-3 py-1.5 rounded-[8px]">Sold out</span>
          </div>
        )}
        <div className="absolute bottom-[10px] right-3 text-[10px] tracking-[.14em] uppercase text-[rgba(255,255,255,.4)]">{p.category}</div>
      </ProductImage>
      <div className="p-4">
        <div className="font-bold text-[14.5px] text-body">{p.name}</div>
        <div className="text-[11.5px] text-muted mt-[3px]">{p.sub}</div>
        <div className="flex gap-[6px] mt-[11px]">
          {p.colors.map(c => (
            <span key={c} className="w-[15px] h-[15px] rounded-[4px] border border-[rgba(0,0,0,.12)]" style={{ background: colorHex(c) }} />
          ))}
        </div>
        <div className="flex items-center justify-between mt-[13px]">
          <span className="font-extrabold text-[16px] text-rose-700 tabular">MVR {p.price}</span>
          {isSoldOut(p) ? (
            <Button variant="secondary" size="xs" disabled>Notify</Button>
          ) : p.customizable ? (
            <Button variant="secondary" size="xs" onClick={() => openModal(p, 'semi')} className="whitespace-nowrap">Customize</Button>
          ) : (
            <Button variant="secondary" size="xs" onClick={() => addToCart(p)}>+ Add</Button>
          )}
        </div>
      </div>
    </div>
  );

  // ── Standard card (add to cart or link to product page)
  const renderStandardCard = (p: Product) => (
    <div className="bg-[#f5f1f3] border border-[rgba(0,0,0,.08)] rounded-2xl overflow-hidden hover:-translate-y-1 hover:border-[rgba(219,87,149,.3)] transition-all">
      <ProductImage href={`/product/${p.id}`} img={p.img} colorImages={p.colorImages} className="block no-underline h-[200px] relative">
        {p.badge && (
          <span className="absolute top-3 left-3 text-[10px] font-extrabold tracking-[.06em] uppercase text-[#200612] bg-rose-500 px-[9px] py-1 rounded-[6px]">{p.badge}</span>
        )}
        {isSoldOut(p) && (
          <div className="absolute inset-0 bg-[rgba(8,8,8,.55)] flex items-center justify-center">
            <span className="text-[11px] font-extrabold tracking-[.1em] uppercase text-[#ffe9f3] border border-[rgba(255,255,255,.25)] px-3 py-1.5 rounded-[8px]">Sold out</span>
          </div>
        )}
        <div className="absolute bottom-[10px] right-3 text-[10px] tracking-[.14em] uppercase text-[rgba(255,255,255,.4)]">{p.category}</div>
      </ProductImage>
      <div className="p-4">
        <Link href={`/product/${p.id}`} className="no-underline text-body font-bold text-[14.5px] block hover:text-rose-600 transition-colors">{p.name}</Link>
        <div className="text-[11.5px] text-muted mt-[3px]">{p.sub}</div>
        <div className="flex gap-[6px] mt-[11px]">
          {p.colors.map(c => (
            <span key={c} className="w-[15px] h-[15px] rounded-[4px] border border-[rgba(0,0,0,.12)]" style={{ background: colorHex(c) }} />
          ))}
        </div>
        <div className="flex items-center justify-between mt-[13px]">
          <div>
            <span className="font-extrabold text-[16px] text-rose-700 tabular">MVR {p.price}</span>
            {p.was && <span className="ml-2 text-[12px] text-muted line-through tabular">MVR {p.was}</span>}
          </div>
          {isSoldOut(p) ? (
            <Button variant="secondary" size="xs" disabled>Notify</Button>
          ) : p.customizable ? (
            <Button variant="secondary" size="xs" href={`/product/${p.id}`}>Customise →</Button>
          ) : (
            <Button variant="secondary" size="xs" href={`/product/${p.id}`}>View options</Button>
          )}
        </div>
      </div>
    </div>
  );

  const bespokeIntro = (
    <div className="inline-flex items-center gap-[9px] bg-[rgba(219,87,149,.07)] border border-[rgba(219,87,149,.25)] text-rose-700 text-[11.5px] font-bold tracking-[.04em] px-[13px] py-2 rounded-[9px]"><Wand2 size={14} /> SEMI &amp; FULL CUSTOMIZATION AVAILABLE</div>
  );

  const fullCustomHeaderAction = isBespoke && fullStyleOpts.length > 0 ? (
    <Button size="xs" onClick={openFullCustomModal} className="whitespace-nowrap">Full Custom →</Button>
  ) : undefined;

  return (
    <div className="min-h-screen bg-page text-body font-archivo">
      <Header active={colKey} />
      <CatalogLayout
        breadcrumb={colLabel}
        title={colLabel}
        subtitle={isBespoke
          ? `Branded ${colLabel.toLowerCase()} — semi-customize your fit and finishes, or go fully bespoke.`
          : `Shop our ${colLabel.toLowerCase()} collection.`}
        categoryLabel="Type"
        products={products}
        loading={loading}
        renderCard={isBespoke ? renderBespokeCard : renderStandardCard}
        intro={isBespoke ? bespokeIntro : undefined}
        headerAction={fullCustomHeaderAction}
        noun="items"
        sizeChart={chart}
      />
      <Footer />

      {/* ── Semi-customize modal ─────────────────────────────────── */}
      {modal?.kind === 'semi' && p && (
        <div className="fixed inset-0 z-[80] bg-[rgba(4,8,7,.78)] backdrop-blur-md flex items-center justify-center p-4 sm:p-6" onClick={() => setModal(null)}>
          <div className="w-[600px] max-w-full max-h-[92vh] overflow-auto bg-surface border border-[rgba(193,57,120,.3)] rounded-[20px] p-[24px]" onClick={e => e.stopPropagation()}>
            <div className="flex items-start justify-between gap-3 mb-5">
              <div>
                <div className="flex items-center gap-[9px]">
                  <h3 className="font-archivo-narrow font-bold text-[22px]">Semi-customize</h3>
                  <span className="text-[9px] font-extrabold uppercase text-rose-600 bg-[rgba(193,57,120,.15)] px-2 py-[3px] rounded-[5px]">Quote</span>
                </div>
                <p className="text-[13px] text-sub mt-[6px]">{p.name} · choose your finishes and upload artwork. We&apos;ll quote the production cost.</p>
              </div>
              <button onClick={() => setModal(null)} className="border-none bg-transparent text-muted cursor-pointer flex-none"><X size={20} /></button>
            </div>

            {productMaterials.length > 0 && (
              <div className="mb-5">
                <div className="text-[12px] font-bold text-[#705260] mb-[9px]">Material</div>
                <div className="flex gap-[8px] flex-wrap">
                  {productMaterials.map(m => (
                    <button key={m} onClick={() => setSemiMaterial(m)}
                      className="font-semibold text-[12.5px] px-[13px] py-[8px] rounded-[9px] cursor-pointer transition-all"
                      style={chip(semiMaterial === m)}>
                      {m}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {semiSleeveOpts.length > 0 && (
              <div className="mb-5">
                <div className="text-[12px] font-bold text-[#705260] mb-[9px]">Sleeve</div>
                <div className="flex gap-[8px] flex-wrap">
                  {semiSleeveOpts.map(s => (
                    <button key={s.id} onClick={() => setSemiSleeve(s.label)}
                      className="font-semibold text-[12.5px] px-[13px] py-[8px] rounded-[9px] cursor-pointer transition-all"
                      style={chip(semiSleeve === s.label)}>
                      {s.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {semiCollarOpts.length > 0 && (
              <div className="mb-5">
                <div className="text-[12px] font-bold text-[#705260] mb-[9px]">Collar</div>
                <div className="flex gap-[8px] flex-wrap">
                  {semiCollarOpts.map(n => (
                    <button key={n.id} onClick={() => setSemiCollar(n.label)}
                      className="font-semibold text-[12.5px] px-[13px] py-[8px] rounded-[9px] cursor-pointer transition-all"
                      style={chip(semiCollar === n.label)}>
                      {n.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {p.colors.length > 0 && (
              <div className="mb-5">
                <div className="text-[12px] font-bold text-[#705260] mb-[9px]">Colour</div>
                <div className="flex gap-[9px] flex-wrap">
                  {p.colors.map(c => (
                    <button key={c} onClick={() => setSemiColor(c)}
                      className="flex items-center gap-[7px] font-semibold text-[12.5px] px-[13px] py-[8px] rounded-[9px] cursor-pointer transition-all"
                      style={chip(semiColor === c)}>
                      <span className="w-[13px] h-[13px] rounded-[3px] flex-none" style={{ background: colorHex(c), border: '1px solid rgba(0,0,0,.2)' }} />
                      {c}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="mb-5">
              <div className="flex items-center justify-between mb-[10px]">
                <div className="flex items-center gap-3">
                  <div className="text-[12px] font-bold text-[#705260]">Sizes &amp; quantity</div>
                  <SizeChartTrigger chart={chart} label="Size chart" />
                </div>
                <div className="text-[12px] text-sub">Total <span className="text-rose-700 font-extrabold tabular">{semiTotal} units</span></div>
              </div>
              <div className={`grid gap-[9px] ${productSizes.length <= 4 ? 'grid-cols-4' : 'grid-cols-3 sm:grid-cols-6'}`}>
                {productSizes.map(sz => {
                  const q = semiSizes[sz] ?? 0;
                  return (
                    <div key={sz} className="bg-well rounded-xl p-[9px_6px] text-center"
                      style={{ border: q ? '1px solid rgba(219,87,149,.3)' : '1px solid rgba(0,0,0,.08)' }}>
                      <div className="text-[11.5px] font-extrabold text-[#705260]">{sz}</div>
                      <div className="flex items-center justify-center gap-[3px] mt-[7px]">
                        <button onClick={() => setSemiSizes(s => ({ ...s, [sz]: Math.max(0, (s[sz] ?? 0) - 1) }))} className="w-[22px] h-[22px] rounded-[6px] border-none bg-[rgba(0,0,0,.08)] text-rose-700 text-[14px] cursor-pointer">−</button>
                        <span className="w-5 text-center font-extrabold text-[14px] tabular" style={{ color: q ? '#600a32' : '#b29fa8' }}>{q}</span>
                        <button onClick={() => setSemiSizes(s => ({ ...s, [sz]: (s[sz] ?? 0) + 1 }))} className="w-[22px] h-[22px] rounded-[6px] border-none bg-[rgba(0,0,0,.08)] text-rose-700 text-[14px] cursor-pointer">+</button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="mb-5">
              <div className="text-[12px] font-bold text-[#705260] mb-[9px]">Artwork uploads <span className="text-muted font-normal">(all optional)</span></div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-[9px]">
                {ARTWORK_SLOTS.map(slot => {
                  const art = semiArts[slot.key];
                  return (
                    <div key={slot.key}>
                      <div className="text-[11px] font-semibold text-sub mb-[5px]">{slot.label}</div>
                      {!art ? (
                        <label className="flex items-center gap-3 border border-dashed border-[rgba(219,87,149,.3)] rounded-[12px] p-[10px_13px] bg-[rgba(219,87,149,.03)] cursor-pointer hover:bg-[rgba(219,87,149,.06)] transition-colors">
                          <input type="file" accept={ARTWORK_FILE_ACCEPT} onChange={e => onSlotFile(slot.key, e)} className="hidden" />
                          <div className="w-8 h-8 rounded-lg bg-[rgba(219,87,149,.12)] flex items-center justify-center text-rose-700 flex-none"><Upload size={16} /></div>
                          <div>
                            <div className="text-[12px] font-semibold text-[#705260]">Upload</div>
                            <div className="text-[10.5px] text-muted">PNG, SVG, PDF, AI, PSD</div>
                          </div>
                        </label>
                      ) : (
                        <div className="flex items-center gap-2 bg-well border border-[rgba(219,87,149,.25)] rounded-[12px] p-[10px]">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          {art.previewable
                            ? <img src={art.url} alt="" className="w-10 h-10 rounded-[8px] object-cover flex-none bg-white" />
                            : <div className="w-10 h-10 rounded-[8px] flex-none bg-white flex items-center justify-center text-[9px] font-bold text-[#200612]">FILE</div>}
                          <div className="flex-1 min-w-0">
                            <div className="text-[11.5px] text-[#705260] truncate">{art.name}</div>
                            <div className="text-[10.5px] text-rose-600">Uploaded</div>
                          </div>
                          <button onClick={() => setSemiArts(a => ({ ...a, [slot.key]: null }))} className="border-none bg-transparent text-muted cursor-pointer flex-none"><X size={15} /></button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            <Button onClick={addSemi} disabled={semiTotal === 0} className="w-full">
              Add to quote {semiTotal > 0 ? `· ${semiTotal} units` : ''}
            </Button>
          </div>
        </div>
      )}

      {/* ── Full-customize modal ─────────────────────────────────── */}
      {modal?.kind === 'full' && p && (
        <div className="fixed inset-0 z-[80] bg-[rgba(4,8,7,.78)] backdrop-blur-md flex items-center justify-center p-4 sm:p-6" onClick={() => setModal(null)}>
          <div className="w-[680px] max-w-full max-h-[92vh] overflow-auto bg-surface border border-[rgba(193,57,120,.3)] rounded-[20px] p-[24px]" onClick={e => e.stopPropagation()}>
            <div className="flex items-start justify-between gap-3 mb-5">
              <div>
                <div className="flex items-center gap-[9px]">
                  <h3 className="font-archivo-narrow font-bold text-[22px]">Full customize</h3>
                  <span className="text-[9px] font-extrabold uppercase text-rose-600 bg-[rgba(193,57,120,.15)] px-2 py-[3px] rounded-[5px]">Quote</span>
                </div>
                <p className="text-[13px] text-sub mt-[6px]">{p.name} · design from scratch — choose your material, collar, sleeve quantities, and upload your design.</p>
              </div>
              <button onClick={() => setModal(null)} className="border-none bg-transparent text-muted cursor-pointer flex-none"><X size={20} /></button>
            </div>

            {fullStyleOpts.length > 1 && (
              <div className="mb-5">
                <div className="text-[12px] font-bold text-[#705260] mb-[9px]">Style</div>
                <div className="flex gap-[8px] flex-wrap">
                  {fullStyleOpts.map(sp => (
                    <button key={sp.id} onClick={() => switchFullStyle(sp)}
                      className="font-semibold text-[12.5px] px-[13px] py-[8px] rounded-[9px] cursor-pointer transition-all"
                      style={chip(p.id === sp.id)}>
                      {sp.name}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {productMaterials.length > 0 && (
              <div className="mb-5">
                <div className="text-[12px] font-bold text-[#705260] mb-[9px]">Material</div>
                <div className="flex gap-[8px] flex-wrap">
                  {productMaterials.map(m => (
                    <button key={m} onClick={() => setFullMaterial(m)}
                      className="font-semibold text-[12.5px] px-[13px] py-[8px] rounded-[9px] cursor-pointer transition-all"
                      style={chip(fullMaterial === m)}>
                      {m}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {fullCollarOpts.length > 0 && (
              <div className="mb-5">
                <div className="text-[12px] font-bold text-[#705260] mb-[9px]">Collar</div>
                <div className="flex gap-[8px] flex-wrap">
                  {fullCollarOpts.map(n => (
                    <button key={n.id} onClick={() => setFullCollar(n.label)}
                      className="font-semibold text-[12.5px] px-[13px] py-[8px] rounded-[9px] cursor-pointer transition-all"
                      style={chip(fullCollar === n.label)}>
                      {n.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="mb-5">
              <div className="flex items-center justify-between mb-[10px]">
                <div className="flex items-center gap-3">
                  <div className="text-[12px] font-bold text-[#705260]">Quantities by sleeve &amp; size</div>
                  <SizeChartTrigger chart={chart} label="Size chart" />
                </div>
                <div className="text-[12px] text-sub">Total <span className="text-rose-700 font-extrabold tabular">{fullTotal} units</span></div>
              </div>
              <div className="flex flex-col sm:flex-row gap-[12px]">
                <div className="flex-1 bg-well border border-[rgba(0,0,0,.08)] rounded-[14px] p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="text-[12px] font-extrabold text-[#705260]">Long Sleeve</div>
                    <div className="text-[11px] text-rose-700 tabular font-bold">{longTotal} units</div>
                  </div>
                  <div className={`grid gap-[7px] ${productSizes.length <= 4 ? 'grid-cols-2' : 'grid-cols-3'}`}>
                    {productSizes.map(sz => {
                      const q = longSizes[sz] ?? 0;
                      return (
                        <div key={sz} className="bg-[rgba(0,0,0,.06)] rounded-[10px] p-[7px_5px] text-center"
                          style={{ border: q ? '1px solid rgba(219,87,149,.3)' : '1px solid rgba(0,0,0,.07)' }}>
                          <div className="text-[11px] font-extrabold text-[#705260]">{sz}</div>
                          <div className="flex items-center justify-center gap-[2px] mt-[5px]">
                            <button onClick={() => setLongSizes(s => ({ ...s, [sz]: Math.max(0, (s[sz] ?? 0) - 1) }))} className="w-[20px] h-[20px] rounded-[5px] border-none bg-[rgba(0,0,0,.08)] text-rose-700 text-[13px] cursor-pointer">−</button>
                            <span className="w-4 text-center font-extrabold text-[13px] tabular" style={{ color: q ? '#600a32' : '#b29fa8' }}>{q}</span>
                            <button onClick={() => setLongSizes(s => ({ ...s, [sz]: (s[sz] ?? 0) + 1 }))} className="w-[20px] h-[20px] rounded-[5px] border-none bg-[rgba(0,0,0,.08)] text-rose-700 text-[13px] cursor-pointer">+</button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
                <div className="flex-1 bg-well border border-[rgba(0,0,0,.08)] rounded-[14px] p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="text-[12px] font-extrabold text-[#705260]">Short Sleeve</div>
                    <div className="text-[11px] text-rose-700 tabular font-bold">{shortTotal} units</div>
                  </div>
                  <div className={`grid gap-[7px] ${productSizes.length <= 4 ? 'grid-cols-2' : 'grid-cols-3'}`}>
                    {productSizes.map(sz => {
                      const q = shortSizes[sz] ?? 0;
                      return (
                        <div key={sz} className="bg-[rgba(0,0,0,.06)] rounded-[10px] p-[7px_5px] text-center"
                          style={{ border: q ? '1px solid rgba(219,87,149,.3)' : '1px solid rgba(0,0,0,.07)' }}>
                          <div className="text-[11px] font-extrabold text-[#705260]">{sz}</div>
                          <div className="flex items-center justify-center gap-[2px] mt-[5px]">
                            <button onClick={() => setShortSizes(s => ({ ...s, [sz]: Math.max(0, (s[sz] ?? 0) - 1) }))} className="w-[20px] h-[20px] rounded-[5px] border-none bg-[rgba(0,0,0,.08)] text-rose-700 text-[13px] cursor-pointer">−</button>
                            <span className="w-4 text-center font-extrabold text-[13px] tabular" style={{ color: q ? '#600a32' : '#b29fa8' }}>{q}</span>
                            <button onClick={() => setShortSizes(s => ({ ...s, [sz]: (s[sz] ?? 0) + 1 }))} className="w-[20px] h-[20px] rounded-[5px] border-none bg-[rgba(0,0,0,.08)] text-rose-700 text-[13px] cursor-pointer">+</button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>

            <div className="mb-5">
              <div className="text-[12px] font-bold text-[#705260] mb-[9px]">Your design <span className="text-muted font-normal">(optional — share more files after submitting)</span></div>
              {!fullArt ? (
                <label className="flex items-center gap-3 border border-dashed border-[rgba(219,87,149,.35)] rounded-[14px] p-[14px_16px] bg-[rgba(219,87,149,.03)] cursor-pointer hover:bg-[rgba(219,87,149,.06)] transition-colors">
                  <input type="file" accept={ARTWORK_FILE_ACCEPT} onChange={onFullArt} className="hidden" />
                  <div className="w-10 h-10 rounded-[10px] bg-[rgba(219,87,149,.12)] flex items-center justify-center text-rose-700 flex-none"><Upload size={20} /></div>
                  <div>
                    <div className="text-[13px] font-semibold text-[#705260]">Upload design / logo</div>
                    <div className="text-[11px] text-muted">PNG, SVG, PDF, AI, PSD · original quality kept</div>
                  </div>
                </label>
              ) : (
                <div className="flex items-center gap-3 bg-well border border-[rgba(219,87,149,.25)] rounded-xl p-[13px]">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  {fullArt.previewable
                    ? <img src={fullArt.url} alt="" className="w-[54px] h-[54px] rounded-[10px] object-cover flex-none bg-white" />
                    : <div className="w-[54px] h-[54px] rounded-[10px] flex-none bg-white flex items-center justify-center text-[10px] font-bold text-[#200612]">FILE</div>}
                  <div className="flex-1 min-w-0">
                    <div className="text-[13px] text-[#705260] truncate">{fullArt.name}</div>
                    <div className="text-[11.5px] text-rose-600 mt-1">{fullArt.size}</div>
                  </div>
                  <button onClick={() => setFullArt(null)} className="border-none bg-transparent text-muted cursor-pointer"><X size={17} /></button>
                </div>
              )}
            </div>

            <div className="mb-5 p-[13px_14px] rounded-[12px] text-[12.5px] leading-[1.55]"
              style={{ background: 'rgba(255,168,40,.07)', border: '1px solid rgba(255,168,40,.28)', color: '#ffa828' }}>
              <strong className="font-extrabold">Before you submit:</strong> Please email or WhatsApp us with your complete design files (AI, PDF, or high-res PNG) so we can prepare a digital mock-up before production begins.
              {data.settings.phone && (
                <span className="block mt-[5px] text-[11.5px] opacity-80">
                  WhatsApp: {data.settings.phone} · Email: {data.settings.email}
                </span>
              )}
            </div>

            <Button onClick={addFull} disabled={fullTotal === 0} className="w-full">
              Add to quote {fullTotal > 0 ? `· ${fullTotal} units` : ''}
            </Button>
          </div>
        </div>
      )}

      {toast && (
        <Toast
          title={toast.title}
          sub={toast.sub}
          href={toast.href}
          variant={toast.href.includes('quote') ? 'quote' : 'cart'}
          onDismiss={() => setToast(null)}
        />
      )}
    </div>
  );
}
