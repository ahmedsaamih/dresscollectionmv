'use client';
export const dynamic = 'force-dynamic';
import React, { useState, useRef, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { Toast } from '@/components/Toast';
import { Button } from '@/components/Button';
import { ProductDetailSkeleton } from '@/components/ProductSkeleton';
import { SizeChartTrigger } from '@/components/SizeChart';
import { MMCart, groupFixedLines } from '@/lib/cart';
import { useStore } from '@/contexts/StoreContext';
import { useCart } from '@/contexts/CartContext';
import { useReveal } from '@/lib/useReveal';
import { formatMVR, COLOR_MAP, LOW_STOCK_THRESHOLD, STOCK_BAR_MAX } from '@/lib/utils';
import { resolveSizeChart } from '@/lib/sizeChart';
import { Wand2, Store, Home, Undo2, Check } from 'lucide-react';
import { StarRating } from '@/components/StarRating';

const ACCORDIONS = [
  { title: 'Description', body: 'A soft, breathable weave that moves with you — cut for an easy, flattering fit in tropical heat.' },
  { title: 'Fabric & care', body: 'Machine wash cold, inside out, with similar colours. Do not tumble dry. Hang to dry and iron on a low heat if needed.' },
  { title: 'Shipping & delivery', body: 'Ships across the Maldives in 1–3 days. Delivery only — no pickup or showroom. Bank transfer, no card needed.' },
];

const COLLECTION_PATHS: Record<string, string> = {
  ready: '/ready-made',
  casual: '/casual-wear',
  accessories: '/accessories',
};

const collectionHref = (key: string) => COLLECTION_PATHS[key] ?? `/${key}`;

function StockBar({ stock }: { stock: number }) {
  const pct = Math.min(100, (stock / STOCK_BAR_MAX) * 100);
  const color = stock === 0 ? '#b80f1d' : stock <= LOW_STOCK_THRESHOLD ? '#e81a2b' : '#db5795';
  return (
    <div className="w-full">
      <div className="h-[5px] rounded-full bg-[rgba(0,0,0,.08)] overflow-hidden">
        <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: color }} />
      </div>
      {stock <= LOW_STOCK_THRESHOLD && (
        <div className="text-[10.5px] font-bold mt-[3px]" style={{ color }}>
          {stock === 0 ? 'Out of stock' : `Only ${stock} left`}
        </div>
      )}
    </div>
  );
}

export default function ProductPage() {
  const params = useParams();
  const router = useRouter();
  const { data, loading } = useStore();
  const { cart } = useCart();
  const copy = data.settings.storefrontCopy.productCatalog;
  useReveal();
  const realProduct = data.products.find(p => p.id === params.id);
  const product = realProduct ?? data.products[0];
  const colorHex = (name: string) => data.builderOptions.colors.find(c => c.name === name)?.hex ?? COLOR_MAP[name] ?? '#888';
  const colMeta = data.collections.find(c => c.key === product.collection);
  const colLabel = colMeta?.label ?? product.collection;
  const categoryMeta = data.categories.find(c => c.collection === product.collection && c.name === product.category);
  const customizationProfile = useMemo(() => {
    const activeProfiles = (data.customizationProfiles ?? []).filter(p => p.active);
    const productProfile = activeProfiles.find(p => p.assignments.some(a => a.scope === 'product' && a.productId === product.id));
    if (productProfile) return productProfile;
    const categoryProfile = activeProfiles.find(p => p.assignments.some(a => a.scope === 'category' && a.categoryId === categoryMeta?.id));
    if (categoryProfile) return categoryProfile;
    return activeProfiles.find(p => p.assignments.some(a => a.scope === 'collection' && a.collectionKey === product.collection)) ?? null;
  }, [data.customizationProfiles, product.id, product.collection, categoryMeta?.id]);
  const isCasual = product.collection === 'casual';
  const isQuoteFirst = product.customizable && !isCasual;
  const chart = resolveSizeChart(data.sizeCharts, colMeta?.sizeChartId);

  const [color, setColor]     = useState(product.colors[0] ?? '');
  const [sizes, setSizes]     = useState<Record<string, number>>({});
  const [qty, setQty]         = useState(1);
  const [activeImg, setActiveImg] = useState(product.img);
  const [openAcc, setOpenAcc] = useState(0);
  const [sizeError, setSizeError] = useState(false);
  const [toast, setToast]     = useState(false);
  const [justAdded, setJustAdded] = useState(false);

  // Customizable-only state — default to first available option from builder or product restriction
  const sleeveOpts = useMemo(() => (
    product.sleeves.length > 0
      ? data.builderOptions.sleeves.filter(s => product.sleeves.includes(s.label))
      : []
  ), [data.builderOptions.sleeves, product.sleeves]);
  const neckOpts = useMemo(() => (
    product.necks.length > 0
      ? data.builderOptions.necks.filter(n => product.necks.includes(n.label))
      : []
  ), [data.builderOptions.necks, product.necks]);
  const [sleeve, setSleeve] = useState(sleeveOpts[0]?.label ?? '');
  const [neck, setNeck]     = useState(neckOpts[0]?.label ?? '');

  // The static seed renders first (server/first paint); useStore() then swaps in the
  // live catalog a moment later. If the selected colour/sleeve/neck isn't valid for
  // that live product (e.g. a Builder Option was renamed since the seed was baked),
  // fall back to the first valid option instead of silently keeping a stale selection.
  useEffect(() => {
    if (product.colors.length > 0 && !product.colors.includes(color)) setColor(product.colors[0]);
  }, [product.colors, color]);
  useEffect(() => {
    if (sleeveOpts.length > 0 && !sleeveOpts.some(s => s.label === sleeve)) setSleeve(sleeveOpts[0].label);
    else if (sleeveOpts.length === 0 && sleeve) setSleeve('');
  }, [sleeveOpts, sleeve]);
  useEffect(() => {
    if (neckOpts.length > 0 && !neckOpts.some(n => n.label === neck)) setNeck(neckOpts[0].label);
    else if (neckOpts.length === 0 && neck) setNeck('');
  }, [neckOpts, neck]);

  useEffect(() => {
    setActiveImg(product.colorImages?.[color] || product.sleeveImages[sleeve] || product.img);
  }, [color, sleeve, product]);
  const [notes, setNotes]   = useState('');
  const [artwork, setArtwork]     = useState<string | null>(null);
  const [artworkName, setArtworkName] = useState<string | null>(null);
  const [artworkError, setArtworkError] = useState(false);
  const [profileAnswers, setProfileAnswers] = useState<Record<string, unknown>>({});
  const [profileErrors, setProfileErrors] = useState<Record<string, boolean>>({});
  const artRef = useRef<HTMLInputElement>(null);

  const readArtwork = (file: File) => {
    const reader = new FileReader();
    reader.onload = e => { setArtwork(e.target?.result as string); setArtworkName(file.name); setArtworkError(false); };
    reader.readAsDataURL(file);
  };

  useEffect(() => {
    setProfileAnswers({});
    setProfileErrors({});
  }, [customizationProfile?.id, product.id]);

  const setProfileAnswer = (label: string, value: unknown) => {
    setProfileAnswers((answers) => ({ ...answers, [label]: value }));
    setProfileErrors((errors) => ({ ...errors, [label]: false }));
  };

  const readProfileFile = (label: string, file: File) => {
    const reader = new FileReader();
    reader.onload = e => {
      setProfileAnswer(label, { name: file.name, dataUrl: e.target?.result as string });
    };
    reader.readAsDataURL(file);
  };

  const profileAnswerIsFilled = (value: unknown, requiredCheckbox = false) => {
    if (typeof value === 'boolean') return requiredCheckbox ? value : true;
    if (Array.isArray(value)) return value.length > 0;
    if (value && typeof value === 'object') return Object.keys(value).length > 0;
    return String(value ?? '').trim().length > 0;
  };

  const displayPrice = product.price
    + ((product.sleeveAdjustments ?? {})[sleeve] ?? 0);

  // Total units across all selected sizes (or the shared qty for zero-configured-sizes products).
  const totalUnits = product.sizes.length > 0
    ? Object.values(sizes).reduce((a, b) => a + b, 0)
    : qty;

  // Compact "S2 M4 L4"-style label — matches the format used in app/builder/page.tsx's
  // sizesLabel() helper and app/casual-wear/page.tsx's inline equivalent.
  const sizesLabelStr = product.sizes.filter(s => sizes[s]).map(s => s + sizes[s]).join(' ');

  // Real total price to charge/display, summed per-size (each size can carry its own
  // sizeAdjustments). Falls back to today's displayPrice * qty for zero-size products.
  const lineTotal = product.sizes.length > 0
    ? Object.entries(sizes).reduce((sum, [s, q]) => {
        if (!q) return sum;
        const unitPrice = product.price
          + ((product.sleeveAdjustments ?? {})[sleeve] ?? 0)
          + ((product.sizeAdjustments   ?? {})[s]      ?? 0);
        return sum + unitPrice * q;
      }, 0)
    : displayPrice * qty;

  const addToCart = () => {
    if (product.sizes.length > 0) {
      const entries = Object.entries(sizes).filter(([, q]) => q > 0);
      if (entries.length === 0) { setSizeError(true); return; }
      entries.forEach(([s, q]) => {
        MMCart.addFixed({ sku: product.id, name: product.name, meta: product.sub, price: displayPrice, img: activeImg, size: s, color, qty: q, sleeve: sleeve || undefined, neck: neck || undefined });
      });
      setSizes({});
    } else {
      if (stockForSize('') === 0) return;
      MMCart.addFixed({ sku: product.id, name: product.name, meta: product.sub, price: displayPrice, img: activeImg, size: '', color, qty, sleeve: sleeve || undefined, neck: neck || undefined });
      setQty(1);
    }
    setToast(true);
    setJustAdded(true);
    setTimeout(() => setJustAdded(false), 1100);
  };

  // Swapped into every "Add to Cart" button's label for a moment after a
  // successful add — a quick, low-key companion to the toast (which some
  // users won't look at if their eyes stay on the button they just pressed).
  const addToCartLabel = justAdded
    ? <span className="inline-flex items-center gap-[7px]"><Check key="added-check" size={16} strokeWidth={3} className="animate-tick-pop" /> Added</span>
    : <>Add to Cart · {formatMVR(lineTotal)}</>;
  const addToCartLabelCompact = justAdded
    ? <span className="inline-flex items-center gap-[6px]"><Check key="added-check-sm" size={14} strokeWidth={3} className="animate-tick-pop" /> Added</span>
    : 'Add to Cart';

  // Live summary of everything accumulated for this product across repeated
  // colour/sleeve/neck picks — addFixed already merges correctly per combo,
  // this just makes the resulting stack visible instead of looking like a
  // silent replace.
  const addedGroups = useMemo(
    () => groupFixedLines(cart.fixed.filter(i => i.sku === product.id)),
    [cart.fixed, product.id]
  );

  const requestQuote = () => {
    // Size is only required if the product has configured sizes
    if (product.sizes.length > 0 && !Object.values(sizes).some(q => q > 0)) { setSizeError(true); return; }
    if (!artwork) { setArtworkError(true); return; }
    const specParts = [color];
    if (sleeve) specParts.push(sleeve);
    if (neck) specParts.push(neck);
    MMCart.addQuote({
      kind: isCasual ? 'casual' : 'jersey',
      name: product.name,
      specs: specParts.join(' · '),
      units: totalUnits,
      sizesLabel: product.sizes.length > 0 ? sizesLabelStr : `×${qty}`,
      sizes: product.sizes.length > 0 ? Object.fromEntries(Object.entries(sizes).filter(([, q]) => q > 0)) : {},
      swatch: colorHex(color),
      sleeve: sleeve || undefined,
      neck: neck || undefined,
      notes: notes || undefined,
      artwork,
      logoName: artworkName,
    });
    router.push('/quote');
  };

  const requestCustomizationQuote = () => {
    if (!customizationProfile) return;
    if (product.sizes.length > 0 && !Object.values(sizes).some(q => q > 0)) { setSizeError(true); return; }
    const errors: Record<string, boolean> = {};
    for (const field of customizationProfile.fields) {
      if (field.required && !profileAnswerIsFilled(profileAnswers[field.label], field.type === 'checkbox')) {
        errors[field.label] = true;
      }
    }
    if (Object.keys(errors).length) { setProfileErrors(errors); return; }

    const specParts = [color];
    if (sizesLabelStr) specParts.push(sizesLabelStr);
    if (sleeve) specParts.push(sleeve);
    if (neck) specParts.push(neck);
    const answerSummary = customizationProfile.fields
      .map((field) => {
        const value = profileAnswers[field.label];
        if (!profileAnswerIsFilled(value, false)) return null;
        if (value && typeof value === 'object' && 'name' in value) return `${field.label}: ${(value as { name?: string }).name}`;
        if (Array.isArray(value)) return `${field.label}: ${value.join(', ')}`;
        if (typeof value === 'boolean') return `${field.label}: ${value ? 'Yes' : 'No'}`;
        return `${field.label}: ${String(value)}`;
      })
      .filter(Boolean) as string[];

    MMCart.addQuote({
      kind: 'profile',
      name: product.name,
      specs: [...specParts, ...answerSummary].join(' · '),
      units: totalUnits,
      sizesLabel: product.sizes.length > 0 ? sizesLabelStr : `×${qty}`,
      sizes: product.sizes.length > 0 ? Object.fromEntries(Object.entries(sizes).filter(([, q]) => q > 0)) : {},
      swatch: colorHex(color),
      sleeve: sleeve || undefined,
      neck: neck || undefined,
      notes: notes || undefined,
      customizationProfileId: customizationProfile.id,
      customizationProfileName: customizationProfile.name,
      customizationAnswers: profileAnswers,
    });
    router.push('/quote');
  };

  const related = data.products
    .filter(p => p.collection === product.collection && p.id !== product.id)
    .slice(0, 4);
  const defaultAccordions = product.collection === 'accessories'
    ? [
        { title: copy.accordionDescriptionTitle, body: `${product.name} ${copy.accessoriesDescriptionBody}` },
        { title: copy.accordionCareTitle, body: 'Keep dry and clean gently as needed. Follow any product-specific care guidance included with your delivery.' },
        { title: copy.accordionShippingTitle, body: copy.accordionShippingBody },
      ]
    : isCasual
      ? [
          { title: copy.accordionDescriptionTitle, body: `${product.name} is ${copy.casualDescriptionBody}` },
          { title: copy.accordionCareTitle, body: 'Wash cold, inside out. Do not iron printed areas. Hang dry for best results.' },
          { title: copy.accordionShippingTitle, body: copy.accordionShippingBody },
        ]
      : ACCORDIONS;
  const accordions = (product.descriptionSections?.length ?? 0) > 0
    ? product.descriptionSections!.map(s => ({ title: s.title, body: s.body }))
    : defaultAccordions;

  // Quantity of this exact sku+color+size already sitting in the customer's own
  // cart (across any sleeve/neck variant, since those don't draw from separate
  // stock — Inventory is keyed by size+color only) — subtracted from the raw DB
  // stock so the picker can't be re-used to add more than what's really left.
  const cartQtyFor = (c: string, s: string) =>
    cart.fixed.filter(i => i.sku === product.id && i.color === c && i.size === s).reduce((a, i) => a + i.qty, 0);

  const stockForSize = (s: string) =>
    Math.max(0, ((product.colorSizeStock?.[color] ?? {})[s] ?? 0) - cartQtyFor(color, s));

  const renderProfileField = (field: NonNullable<typeof customizationProfile>['fields'][number]) => {
    const value = profileAnswers[field.label];
    const hasError = !!profileErrors[field.label];
    const baseInput = "w-full bg-well border rounded-[10px] px-[14px] py-3 text-body font-archivo text-[13.5px] outline-none focus:border-rose-500";
    const borderStyle = { borderColor: hasError ? '#ff6370' : 'rgba(0,0,0,.12)' };
    const options = field.options.length > 0 ? field.options : ['Front', 'Back', 'Left side', 'Right side'];

    return (
      <div key={field.id}>
        <div className="flex items-center justify-between mb-[8px]">
          <span className="text-[12.5px] font-bold text-[#705260]">{field.label}</span>
          {field.required && <span className="text-[10px] uppercase tracking-[.1em] text-[#e81a2b]">Required</span>}
        </div>
        {field.type === 'textarea' ? (
          <textarea
            value={String(value ?? '')}
            onChange={e => setProfileAnswer(field.label, e.target.value)}
            placeholder={field.placeholder}
            className={`${baseInput} h-[82px] resize-none`}
            style={borderStyle}
          />
        ) : field.type === 'select' ? (
          <select
            value={String(value ?? '')}
            onChange={e => setProfileAnswer(field.label, e.target.value)}
            className={baseInput}
            style={borderStyle}
          >
            <option value="">Choose option</option>
            {field.options.map(option => <option key={option} value={option}>{option}</option>)}
          </select>
        ) : field.type === 'multiselect' ? (
          <div className="flex gap-[9px] flex-wrap">
            {field.options.map(option => {
              const selected = Array.isArray(value) && value.includes(option);
              return (
                <button
                  type="button"
                  key={option}
                  onClick={() => {
                    const current = Array.isArray(value) ? value as string[] : [];
                    setProfileAnswer(field.label, selected ? current.filter(v => v !== option) : [...current, option]);
                  }}
                  className="font-semibold text-[12.5px] px-[14px] h-[38px] rounded-xl cursor-pointer transition-all"
                  style={{
                    border: selected ? 'none' : `1px solid ${hasError ? '#ff6370' : 'rgba(0,0,0,.16)'}`,
                    background: selected ? '#db5795' : 'transparent',
                    color: selected ? '#200612' : '#705260',
                  }}
                >
                  {option}
                </button>
              );
            })}
          </div>
        ) : field.type === 'checkbox' ? (
          <label className="flex items-center gap-3 bg-well border rounded-[10px] px-[14px] py-3 cursor-pointer" style={borderStyle}>
            <input
              type="checkbox"
              checked={Boolean(value)}
              onChange={e => setProfileAnswer(field.label, e.target.checked)}
              className="accent-rose-500"
            />
            <span className="text-[13px] text-sub">{field.placeholder || 'Yes'}</span>
          </label>
        ) : field.type === 'file' ? (
          <label
            className="w-full flex items-center justify-center gap-[10px] border-2 border-dashed rounded-[12px] py-[18px] cursor-pointer transition-all"
            style={{ borderColor: hasError ? '#ff6370' : 'rgba(219,87,149,.25)', background: hasError ? 'rgba(255,61,77,.04)' : 'rgba(219,87,149,.03)' }}
          >
            <input
              type="file"
              accept="image/*,application/pdf,.xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              className="hidden"
              onChange={e => { const f = e.target.files?.[0]; if (f) readProfileFile(field.label, f); }}
            />
            <span className="text-rose-700 text-[18px]">↑</span>
            <span className="font-semibold text-[13px]" style={{ color: hasError ? '#e81a2b' : '#705260' }}>
              {value && typeof value === 'object' && 'name' in value ? String((value as { name?: string }).name) : field.placeholder || 'Upload file'}
            </span>
            <span className="text-[11px] text-muted">PNG, JPG, PDF, XLSX</span>
          </label>
        ) : field.type === 'quantity' ? (
          <input
            type="number"
            min={0}
            value={String(value ?? '')}
            onChange={e => setProfileAnswer(field.label, e.target.value ? Number(e.target.value) : '')}
            placeholder={field.placeholder || '0'}
            className={baseInput}
            style={borderStyle}
          />
        ) : field.type === 'placement' ? (
          <div className="flex gap-[9px] flex-wrap">
            {options.map(option => {
              const selected = value === option;
              return (
                <button
                  type="button"
                  key={option}
                  onClick={() => setProfileAnswer(field.label, option)}
                  className="font-semibold text-[12.5px] px-[14px] h-[38px] rounded-xl cursor-pointer transition-all"
                  style={{
                    border: selected ? 'none' : `1px solid ${hasError ? '#ff6370' : 'rgba(0,0,0,.16)'}`,
                    background: selected ? '#db5795' : 'transparent',
                    color: selected ? '#200612' : '#705260',
                  }}
                >
                  {option}
                </button>
              );
            })}
          </div>
        ) : (
          <input
            value={String(value ?? '')}
            onChange={e => setProfileAnswer(field.label, e.target.value)}
            placeholder={field.placeholder}
            className={baseInput}
            style={borderStyle}
          />
        )}
        {field.helpText && <div className="text-[11.5px] text-muted mt-[6px] leading-[1.45]">{field.helpText}</div>}
        {hasError && <div className="text-[11.5px] text-[#e81a2b] mt-[6px]">Please complete this field.</div>}
      </div>
    );
  };

  // realProduct is undefined until either the live catalog resolves this id
  // or it genuinely doesn't exist. Every hook above still runs against the
  // seed-fallback `product` so hook order stays stable — this only changes
  // what gets rendered, not what gets computed.
  if (!realProduct) {
    return (
      <div className="min-h-screen bg-page text-body font-archivo">
        <Header />
        <div className="max-w-[1180px] mx-auto px-5 sm:px-8 py-[26px] pb-20">
          {loading ? (
            <ProductDetailSkeleton />
          ) : (
            <div className="text-center py-20">
              <div className="font-archivo-narrow font-bold text-[26px]">Product not found</div>
              <div className="text-[13.5px] text-sub mt-2">It may have been removed or the link is out of date.</div>
              <Link href="/ready-made" className="inline-block mt-6 no-underline bg-rose-500 text-onPrimary font-extrabold text-[13.5px] px-[22px] py-3 rounded-xl">Browse Ready-Made</Link>
            </div>
          )}
        </div>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-page text-body font-archivo">
      <Header active={product.collection} />

      <div className="max-w-[1180px] mx-auto px-5 sm:px-8 py-[26px] pb-20">
        {/* Breadcrumb */}
        <div className="text-[12.5px] text-muted mb-6">
          <Link href="/" className="text-muted no-underline hover:text-rose-700">Home</Link>
          <span className="mx-[7px]">/</span>
          <Link href={collectionHref(product.collection)} className="text-muted no-underline hover:text-rose-700">{colLabel}</Link>
          <span className="mx-[7px]">/</span>
          <span className="text-sub">{product.name}</span>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[1.05fr_.95fr] gap-12 items-start">
          {/* Gallery */}
          <div data-hero-reveal className="opacity-0 lg:sticky lg:top-[90px]">
            <div
              className="h-[520px] rounded-[18px] overflow-hidden border border-[rgba(0,0,0,.08)] relative"
              style={{ background: activeImg }}
            >
              {product.badge && (
                <span className={`absolute top-4 left-4 text-[10px] font-extrabold tracking-[.07em] uppercase px-[11px] py-[5px] rounded-[7px] ${product.badge === 'Sale' ? 'bg-[#ff3d4d] text-white' : 'bg-rose-500 text-[#200612]'}`}>
                  {product.badge}
                </span>
              )}
              {(product.customizable || customizationProfile) && (
                <span className="absolute top-4 right-4 text-[10px] font-extrabold tracking-[.07em] uppercase px-[11px] py-[5px] rounded-[7px] bg-[rgba(219,87,149,.15)] border border-[rgba(219,87,149,.35)] text-rose-600">
                  Customizable
                </span>
              )}
            </div>
            {/* Sleeve variant thumbnails — shown only when sleeve images are set */}
            {sleeveOpts.some(s => product.sleeveImages[s.label]) && (
              <div className="flex gap-3 mt-[14px]">
                <button
                  onClick={() => { setSleeve(''); setActiveImg(product.colorImages?.[color] || product.img); }}
                  className="h-[84px] flex-1 rounded-xl overflow-hidden cursor-pointer relative p-0"
                  style={{ background: product.img, border: !sleeve ? '2px solid #db5795' : '1px solid rgba(0,0,0,.1)' }}
                />
                {sleeveOpts.filter(s => product.sleeveImages[s.label]).map(s => (
                  <button
                    key={s.id}
                    onClick={() => setSleeve(s.label)}
                    className="h-[84px] flex-1 rounded-xl overflow-hidden cursor-pointer relative p-0"
                    style={{ background: product.sleeveImages[s.label], border: sleeve === s.label ? '2px solid #db5795' : '1px solid rgba(0,0,0,.1)' }}
                  >
                    <span className="absolute bottom-[6px] left-0 right-0 text-center text-[9px] font-extrabold tracking-[.06em] uppercase text-white" style={{ textShadow: '0 1px 3px rgba(0,0,0,.8)' }}>{s.label}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Info */}
          <div data-hero-reveal className="opacity-0">
            <div className="text-[12px] tracking-[.16em] uppercase text-rose-600 font-bold">
              {product.category} · {colLabel}
            </div>
            <h1 className="font-archivo-narrow font-bold text-[30px] sm:text-[42px] tracking-[.01em] mt-[10px] leading-[1.02]">
              {product.name}
            </h1>

            {product.customizable && (
              <div className="mt-[10px] flex items-center gap-[9px] bg-[rgba(219,87,149,.05)] border border-[rgba(219,87,149,.2)] rounded-[11px] px-[14px] py-[10px]">
                <span className="text-rose-700"><Wand2 size={14} /></span>
                <span className="text-[12.5px] text-sub leading-[1.45]">
                  {isCasual
                    ? copy.customizableCasualHelp
                    : copy.customizableJerseyHelp}
                </span>
              </div>
            )}
            {customizationProfile && (
              <div className="mt-[10px] flex items-center gap-[9px] bg-[rgba(219,87,149,.05)] border border-[rgba(219,87,149,.2)] rounded-[11px] px-[14px] py-[10px]">
                <span className="text-rose-700"><Wand2 size={14} /></span>
                <span className="text-[12.5px] text-sub leading-[1.45]">
                  {customizationProfile.name} {copy.customizationProfileHelp}
                </span>
              </div>
            )}

            <div className="flex items-center gap-3 mt-[14px]">
              <StarRating rating={5} size={14} className="text-rose-700" />
              <span className="text-[12.5px] text-muted">4.8 · 36 reviews</span>
            </div>
            <div className="flex items-baseline gap-3 mt-5">
              {isQuoteFirst ? (
                <span className="font-extrabold text-[28px] text-rose-700">{copy.quoteOnRequestLabel}</span>
              ) : (
                <>
                  <span className="font-extrabold text-[34px] text-rose-700 tabular">{formatMVR(displayPrice)}</span>
                  {product.was && <span className="text-[13px] text-muted line-through tabular">{formatMVR(product.was)}</span>}
                  <span className="text-[13px] text-muted">{copy.productStockLine}</span>
                </>
              )}
            </div>

            {/* Colour */}
            <div className="mt-[26px]">
              <div className="flex items-center justify-between mb-[11px]">
                <span className="text-[12.5px] font-bold text-[#705260]">Colour</span>
                <span className="text-[12.5px] text-sub">{color}</span>
              </div>
              <div className="flex gap-[11px]">
                {product.colors.map(c => (
                  <span
                    key={c} onClick={() => setColor(c)} title={c}
                    className="w-[38px] h-[38px] rounded-[10px] cursor-pointer transition-all"
                    style={{
                      background: colorHex(c),
                      boxShadow: color === c
                        ? '0 0 0 2px #ffffff,0 0 0 4px #db5795'
                        : '0 0 0 1px rgba(0,0,0,.14)',
                    }}
                  />
                ))}
              </div>
            </div>

            {/* Sleeve selector */}
            {sleeveOpts.length > 0 && (
              <div className="mt-6">
                <div className="text-[12.5px] font-bold text-[#705260] mb-[11px]">Sleeve</div>
                <div className="flex gap-[9px] flex-wrap">
                  {sleeveOpts.map(s => (
                    <button
                      key={s.id} onClick={() => setSleeve(s.label)}
                      className="font-semibold text-[12.5px] px-[14px] h-[40px] rounded-xl cursor-pointer transition-all"
                      style={{
                        border: sleeve === s.label ? 'none' : '1px solid rgba(0,0,0,.16)',
                        background: sleeve === s.label ? '#db5795' : 'transparent',
                        color: sleeve === s.label ? '#200612' : '#705260',
                      }}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Collar / neck selector */}
            {neckOpts.length > 0 && (
              <div className="mt-6">
                <div className="text-[12.5px] font-bold text-[#705260] mb-[11px]">Neck / collar</div>
                <div className="flex gap-[9px] flex-wrap">
                  {neckOpts.map(n => (
                    <button
                      key={n.id} onClick={() => setNeck(n.label)}
                      className="font-semibold text-[12.5px] px-[14px] h-[40px] rounded-xl cursor-pointer transition-all"
                      style={{
                        border: neck === n.label ? 'none' : '1px solid rgba(0,0,0,.16)',
                        background: neck === n.label ? '#db5795' : 'transparent',
                        color: neck === n.label ? '#200612' : '#705260',
                      }}
                    >
                      {n.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Size */}
            <div className="mt-6">
              <div className="flex items-center justify-between mb-[11px]">
                <span className="text-[12.5px] font-bold text-[#705260]">Size</span>
                <SizeChartTrigger chart={chart} />
              </div>
              <div className="flex flex-col gap-[9px]">
                {product.sizes.map(s => {
                  const stock = stockForSize(s);
                  const outOfStock = stock === 0;
                  const q = sizes[s] ?? 0;
                  return (
                    <div
                      key={s}
                      className="relative flex items-center justify-between gap-[14px] px-[14px] py-[9px] rounded-xl transition-all"
                      style={{
                        border: '1px solid rgba(0,0,0,.16)',
                        background: outOfStock ? 'rgba(0,0,0,.05)' : q > 0 ? 'rgba(219,87,149,.06)' : 'transparent',
                        opacity: outOfStock ? .6 : 1,
                      }}
                    >
                      <div className="flex-1 min-w-0">
                        <span className="font-bold text-[13.5px]" style={{ color: outOfStock ? 'rgba(0,0,0,.25)' : '#705260', textDecoration: outOfStock ? 'line-through' : 'none' }}>
                          {s}
                        </span>
                        <div className="mt-[6px] max-w-[120px]">
                          <StockBar stock={stock} />
                        </div>
                      </div>
                      <div className="inline-flex items-center border border-[rgba(0,0,0,.14)] rounded-xl overflow-hidden">
                        <button
                          disabled={outOfStock}
                          onClick={() => { setSizes(sv => ({ ...sv, [s]: Math.max(0, (sv[s] ?? 0) - 1) })); setSizeError(false); }}
                          className="border-none bg-[rgba(0,0,0,.06)] text-rose-700 w-[46px] h-[52px] text-[20px] cursor-pointer font-archivo disabled:cursor-not-allowed disabled:opacity-50"
                        >−</button>
                        <span key={q} className="w-[52px] text-center font-bold text-[16px] tabular animate-tick-pop">{q}</span>
                        <button
                          disabled={outOfStock}
                          onClick={() => {
                            setSizes(sv => {
                              const current = sv[s] ?? 0;
                              if (current >= stock) return sv;
                              return { ...sv, [s]: current + 1 };
                            });
                            setSizeError(false);
                          }}
                          className="border-none bg-[rgba(0,0,0,.06)] text-rose-700 w-[46px] h-[52px] text-[20px] cursor-pointer font-archivo disabled:cursor-not-allowed disabled:opacity-50"
                        >+</button>
                      </div>
                    </div>
                  );
                })}
              </div>
              {sizeError && <div className="text-[12px] text-[#e81a2b] mt-[9px]">Please select at least one size.</div>}
            </div>

            {/* Qty + Add/Quote */}
            <div className="flex gap-[14px] mt-7 items-start">
              {product.sizes.length === 0 && (() => {
                const stock0 = stockForSize('');
                const atCap = qty >= stock0;
                return (
                  <div className="flex flex-col gap-[6px]">
                    <div className="inline-flex items-center border border-[rgba(0,0,0,.14)] rounded-xl overflow-hidden">
                      <button onClick={() => setQty(q => Math.max(1, q - 1))} className="border-none bg-[rgba(0,0,0,.06)] text-rose-700 w-[46px] h-[52px] text-[20px] cursor-pointer font-archivo">−</button>
                      <span key={qty} className="w-[52px] text-center font-bold text-[16px] tabular animate-tick-pop">{qty}</span>
                      <button
                        disabled={atCap}
                        onClick={() => setQty(q => atCap ? q : q + 1)}
                        className="border-none bg-[rgba(0,0,0,.06)] text-rose-700 w-[46px] h-[52px] text-[20px] cursor-pointer font-archivo disabled:cursor-not-allowed disabled:opacity-50"
                      >+</button>
                    </div>
                    <div className="w-[144px]">
                      <StockBar stock={stock0} />
                    </div>
                  </div>
                );
              })()}
              {isQuoteFirst ? (
                <div className="flex-1 flex flex-col gap-[10px]">
                  <Button onClick={customizationProfile ? requestCustomizationQuote : requestQuote}>
                    {customizationProfile ? 'Request Customization →' : 'Request a Quote →'}
                  </Button>
                  <Button variant="secondary" onClick={addToCart}>
                    {addToCartLabel}
                  </Button>
                </div>
              ) : product.customizable ? (
                <div className="flex-1 flex flex-col gap-[10px]">
                  <Button onClick={addToCart}>
                    {addToCartLabel}
                  </Button>
                  <Button variant="secondary" onClick={customizationProfile ? requestCustomizationQuote : requestQuote}>
                    {customizationProfile ? 'Request Customization →' : 'Request Print Quote →'}
                  </Button>
                </div>
              ) : customizationProfile ? (
                <div className="flex-1 flex flex-col gap-[10px]">
                  <Button onClick={addToCart}>
                    {addToCartLabel}
                  </Button>
                  <Button variant="secondary" onClick={requestCustomizationQuote}>
                    Request Customization →
                  </Button>
                </div>
              ) : (
                <Button onClick={addToCart} className="flex-1">
                  {addToCartLabel}
                </Button>
              )}
            </div>

            {addedGroups.length > 0 && (
              <div className="mt-5 flex flex-col gap-[8px] bg-[#f9f6f7] border border-[rgba(193,57,120,.18)] rounded-[12px] p-[14px]">
                <div className="text-[11px] tracking-[.14em] uppercase text-rose-600 font-bold">Added so far</div>
                {addedGroups.map(g => (
                  <div key={g.key} className="flex items-center justify-between gap-[10px] text-[12.5px]">
                    <span className="font-semibold text-[#705260]">
                      {[g.color, g.sleeve, g.neck].filter(Boolean).join(' · ')}
                    </span>
                    <span className="text-muted font-semibold tabular whitespace-nowrap">
                      {Object.entries(g.sizes).filter(([, q]) => q > 0).map(([s, q]) => s ? `${s}×${q}` : `×${q}`).join(', ')}
                    </span>
                  </div>
                ))}
              </div>
            )}

            {customizationProfile && (
              <div className="mt-6 flex flex-col gap-[14px] bg-[#f9f6f7] border border-[rgba(193,57,120,.18)] rounded-[14px] p-[16px]">
                <div>
                  <div className="text-[12px] tracking-[.16em] uppercase text-rose-600 font-bold">Customization profile</div>
                  <div className="font-archivo-narrow font-bold text-[20px] mt-[4px]">{customizationProfile.name}</div>
                  {customizationProfile.description && (
                    <div className="text-[12.5px] text-sub mt-[4px] leading-[1.5]">{customizationProfile.description}</div>
                  )}
                  {(data.settings.customizationGuidePdfUrl || data.settings.customizationTemplateXlsxUrl) && (
                    <div className="flex flex-wrap gap-x-[16px] gap-y-[4px] mt-[10px]">
                      {data.settings.customizationGuidePdfUrl && (
                        <a href={data.settings.customizationGuidePdfUrl} target="_blank" rel="noopener noreferrer"
                          className="text-[12px] font-semibold text-rose-700 underline">
                          Download our logo placement guide (PDF)
                        </a>
                      )}
                      {data.settings.customizationTemplateXlsxUrl && (
                        <a href={data.settings.customizationTemplateXlsxUrl} target="_blank" rel="noopener noreferrer"
                          className="text-[12px] font-semibold text-rose-700 underline">
                          Download the details template (Excel)
                        </a>
                      )}
                    </div>
                  )}
                </div>
                {customizationProfile.fields.length > 0 ? (
                  customizationProfile.fields.map(renderProfileField)
                ) : (
                  <div className="text-[12.5px] text-sub leading-[1.5]">
                    No extra fields are configured yet. You can still request customization and add details in the message step.
                  </div>
                )}
                <Button onClick={requestCustomizationQuote} className="w-full">
                  Request Customization Quote →
                </Button>
              </div>
            )}

            {/* Artwork upload + notes (customizable only) */}
            {product.customizable && (
              <div className="mt-6 flex flex-col gap-[14px]">
                {/* Design upload */}
                <div>
                  <div className="text-[12.5px] font-bold text-[#705260] mb-[9px]">
                    Your design / artwork <span className="text-[#e81a2b] font-normal text-[11px]">{artworkError ? '— required' : ''}</span>
                  </div>
                  <input ref={artRef} type="file" accept="image/*,application/pdf" className="hidden"
                    onChange={e => { const f = e.target.files?.[0]; if (f) readArtwork(f); }} />
                  {artwork ? (
                    <div className="flex items-center gap-3 bg-[rgba(219,87,149,.05)] border border-[rgba(219,87,149,.25)] rounded-[12px] p-[12px_14px]">
                      <img src={artwork} alt="artwork preview" className="w-[52px] h-[52px] rounded-[8px] object-cover flex-none border border-[rgba(0,0,0,.1)]" />
                      <div className="flex-1 min-w-0">
                        <div className="text-[12.5px] font-semibold text-[#705260] truncate">{artworkName}</div>
                        <div className="text-[11px] text-rose-700 mt-[2px]">Design attached</div>
                      </div>
                      <button onClick={() => artRef.current?.click()}
                        className="flex-none border border-[rgba(0,0,0,.18)] bg-transparent text-body font-semibold text-[12px] px-[12px] py-[7px] rounded-[8px] cursor-pointer hover:border-rose-500 hover:text-rose-700 transition-all">
                        Replace
                      </button>
                    </div>
                  ) : (
                    <button onClick={() => artRef.current?.click()}
                      className="w-full flex items-center justify-center gap-[10px] border-2 border-dashed rounded-[12px] py-[22px] cursor-pointer transition-all"
                      style={{ borderColor: artworkError ? '#ff6370' : 'rgba(219,87,149,.25)', background: artworkError ? 'rgba(255,61,77,.04)' : 'rgba(219,87,149,.03)' }}>
                      <span className="text-rose-700 text-[18px]">↑</span>
                      <span className="font-semibold text-[13px]" style={{ color: artworkError ? '#e81a2b' : '#705260' }}>Upload design file</span>
                      <span className="text-[11px] text-muted">PNG, JPG, PDF</span>
                    </button>
                  )}
                </div>
                {/* Notes */}
                <div>
                  <div className="text-[12.5px] font-bold text-[#705260] mb-[9px]">Additional details <span className="text-muted font-normal text-[11.5px]">(optional)</span></div>
                  <textarea value={notes} onChange={e => setNotes(e.target.value)}
                    placeholder="Name printing, number, special requests…"
                    className="w-full h-[72px] resize-none bg-well border border-[rgba(0,0,0,.12)] rounded-[11px] px-[14px] py-[11px] text-body font-archivo text-[13.5px] outline-none focus:border-rose-500" />
                </div>
                <div className="text-[11.5px] text-muted leading-[1.55]">
                  {copy.customizationUploadHelp}
                </div>
              </div>
            )}

            {/* Trust strip */}
            <div className="grid grid-cols-3 gap-[10px] mt-[22px]">
              {[
                { icon: Store, label: copy.trustOneLabel },
                { icon: Home, label: copy.trustTwoLabel },
                { icon: Undo2, label: copy.trustThreeLabel },
              ].map(t => (
                <div key={t.label} className="bg-[#f9f6f7] border border-[rgba(0,0,0,.07)] rounded-xl p-3">
                  <div className="text-rose-700"><t.icon size={15} /></div>
                  <div className="text-[11.5px] text-sub mt-1.5 leading-[1.35]">{t.label}</div>
                </div>
              ))}
            </div>

            {/* Accordion */}
            <div className="mt-[26px] border-t border-[rgba(0,0,0,.08)]">
              {accordions.map((a, i) => (
                <div key={i} className="border-b border-[rgba(0,0,0,.08)]">
                  <button
                    onClick={() => setOpenAcc(openAcc === i ? -1 : i)}
                    className="w-full flex items-center justify-between bg-transparent border-none text-body font-bold text-[14px] py-[17px] cursor-pointer text-left gap-4"
                  >
                    {a.title}
                    <span className="text-rose-700 text-[18px] flex-none">{openAcc === i ? '–' : '+'}</span>
                  </button>
                  {openAcc === i && (
                    <div className="text-[13.5px] leading-[1.65] text-sub pb-[18px] max-w-[480px]">{a.body}</div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Related */}
        <div data-reveal className="mt-[72px]">
          <h2 className="font-archivo-narrow font-bold text-[28px] mb-[22px]">{copy.relatedTitle}</h2>
          <div className="grid grid-cols-1 min-[380px]:grid-cols-2 lg:grid-cols-4 gap-[18px]">
            {related.map(p => (
              <Link
                key={p.id} href={`/product/${p.id}`}
                className="no-underline bg-[#f5f1f3] border border-[rgba(0,0,0,.08)] rounded-2xl overflow-hidden hover:-translate-y-1 hover:border-[rgba(219,87,149,.3)] transition-all block"
              >
                <div className="h-[160px] relative" style={{ background: p.img }} />
                <div className="p-4">
                  <div className="font-bold text-[14px] text-body">{p.name}</div>
                  <div className="text-[11.5px] text-muted mt-[3px]">{p.sub}</div>
                  <div className="font-extrabold text-[15px] text-rose-700 mt-[10px] tabular">
                    {`MVR ${p.price}`}{p.customizable && <span className="text-muted font-normal text-[11px] ml-1">+ quote</span>}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </div>

      <Footer />

      {/* Sticky mobile bar */}
      <div className="product-sticky-cta lg:hidden fixed bottom-0 inset-x-0 z-40 flex items-center gap-2 px-3 py-3 border-t border-[rgba(0,0,0,.1)] max-w-full flex-wrap" style={{ background: 'rgba(255,255,255,.95)', backdropFilter: 'blur(12px)' }}>
        <div className="flex-1 min-w-0">
          <div className="text-[10px] uppercase tracking-[.1em] text-muted truncate">{product.name}</div>
          <div className="font-extrabold text-[18px] text-rose-700 tabular leading-tight">
            {formatMVR(lineTotal)}
          </div>
        </div>
        {isQuoteFirst ? (
          <>
            <Button variant="secondary" size="sm" onClick={addToCart} className="flex-1 min-w-[88px] whitespace-nowrap">
              + Cart
            </Button>
            <Button size="sm" onClick={customizationProfile ? requestCustomizationQuote : requestQuote} className="flex-1 min-w-[92px] whitespace-nowrap">
              {customizationProfile ? 'Custom →' : 'Quote →'}
            </Button>
          </>
        ) : product.customizable ? (
          <>
            <Button variant="secondary" size="sm" onClick={customizationProfile ? requestCustomizationQuote : requestQuote} className="flex-1 min-w-[112px] whitespace-nowrap">
              {customizationProfile ? 'Custom' : 'Print Quote'}
            </Button>
            <Button size="sm" onClick={addToCart} className="flex-1 min-w-[112px] whitespace-nowrap">
              {addToCartLabelCompact}
            </Button>
          </>
        ) : customizationProfile ? (
          <>
            <Button variant="secondary" size="sm" onClick={requestCustomizationQuote} className="flex-1 min-w-[92px] whitespace-nowrap">
              Custom
            </Button>
            <Button size="sm" onClick={addToCart} className="flex-1 min-w-[112px] whitespace-nowrap">
              {addToCartLabelCompact}
            </Button>
          </>
        ) : (
          <Button size="sm" onClick={addToCart} className="flex-1">
            {addToCartLabelCompact}
          </Button>
        )}
      </div>

      {toast && (
        <Toast
          title="Added to cart"
          sub={[product.name, color, sleeve, neck].filter(Boolean).join(' · ') + (sizesLabelStr ? ` · ${sizesLabelStr}` : ` ×${qty}`)}
          href="/cart"
          onDismiss={() => setToast(false)}
        />
      )}
    </div>
  );
}
