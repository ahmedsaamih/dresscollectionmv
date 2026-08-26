'use client';
import type { StoreData, Product } from './types';
import { SEED_SIZE_CHARTS } from './sizeChart';
import { normalizeStorefrontCopy } from './storefront-copy';

const SEED: StoreData = {
  settings: {
    storeName: 'Dress Collection',
    tagline: 'Womenswear, delivered',
    email: 'hello@dresscollectionmv.com',
    phone: '+960 777 0123',
    address: 'Malé, Maldives',
    bank: 'BML · Dress Collection · 7730000012345',
    bankAccounts: [
      { name: 'BML (Bank of Maldives)', accountNumber: '7730000012345' },
      { name: 'MIB (Maldives Islamic Bank)', accountNumber: '9910000067890' },
    ],
    currency: 'MVR',
    heroTitle: 'Dresses, delivered to your door.',
    heroSub: 'Shop new arrivals, casual dresses and occasion wear — delivered across the Maldives. No showroom, just great dresses.',
    heroImage: '',
    heroImages: [],
    workshopImage: '',
    categoryReadyImage: '',
    categoryCustomImage: '',
    categoryCasualImage: '',
    categoryAccessoriesImage: '',
    storefrontCopy: normalizeStorefrontCopy(null),
    taxId: '',
    taxRate: 0,
    taxLabel: 'GST',
    termsConditions: '',
    telegramConnected: false,
    telegramChatId: '',
    telegramBotUsername: '',
    telegramAlertsEnabled: false,
    telegramLastTestAt: null,
    emailConnected: false,
    emailFromUser: '',
    emailFromName: '',
    emailAlertsEnabled: false,
    emailLastTestAt: null,
    smsConnected: false,
    msgowlSenderId: '',
    smsAlertsEnabled: false,
    smsLastTestAt: null,
  },
  collections: [
    { id: 'cl-ready',       key: 'ready',       label: 'New Arrivals',     sizeChartId: null },
    { id: 'cl-casual',      key: 'casual',      label: 'Casual Dresses',   sizeChartId: null },
    { id: 'cl-occasion',    key: 'occasion',    label: 'Party & Occasion', sizeChartId: null },
    { id: 'cl-accessories', key: 'accessories', label: 'Accessories',      sizeChartId: null },
  ],
  categories: [
    { id: 'c-midi',       name: 'Midi Dresses',     collection: 'ready',       count: 2 },
    { id: 'c-maxi',       name: 'Maxi Dresses',     collection: 'ready',       count: 2 },
    { id: 'c-mini',       name: 'Mini Dresses',     collection: 'ready',       count: 2 },
    { id: 'c-day',        name: 'Day Dresses',      collection: 'casual',      count: 2 },
    { id: 'c-shirtdress', name: 'Shirt Dresses',    collection: 'casual',      count: 2 },
    { id: 'c-wrap',       name: 'Wrap Dresses',     collection: 'casual',      count: 2 },
    { id: 'c-evening',    name: 'Evening Gowns',    collection: 'occasion',    count: 2 },
    { id: 'c-cocktail',   name: 'Cocktail Dresses', collection: 'occasion',    count: 2 },
    { id: 'c-wedding',    name: 'Wedding Guest',    collection: 'occasion',    count: 2 },
    { id: 'c-bags',       name: 'Bags',             collection: 'accessories', count: 2 },
    { id: 'c-jewellery',  name: 'Jewellery',        collection: 'accessories', count: 2 },
    { id: 'c-belts',      name: 'Belts & Scarves',  collection: 'accessories', count: 2 },
  ],
  products: [
    // New Arrivals
    { id: 'rd-amara',   name: 'Amara Wrap Midi',       collection: 'ready',    category: 'Midi Dresses',   sub: 'Wrap · true to size',      price: 620, was: null, stock: 24, status: 'active', badge: 'New',  colors: ['Blush','Terracotta'], sizes: ['XS','S','M','L','XL'],      sizeStock: { XS:3, S:6, M:7, L:5, XL:3 },     showInWebStore: true, img: 'linear-gradient(150deg,#e63387,#600a32)' },
    { id: 'rd-coral',   name: 'Coral Bay Midi',        collection: 'ready',    category: 'Midi Dresses',   sub: 'A-line · lined',           price: 590, was: 690,  stock: 15, status: 'active', badge: 'Sale', colors: ['Terracotta','Ivory'], sizes: ['XS','S','M','L'],           sizeStock: { XS:2, S:5, M:5, L:3 },           showInWebStore: true, img: 'linear-gradient(150deg,#c9704f,#402a33)' },
    { id: 'rd-horizon', name: 'Horizon Maxi Dress',    collection: 'ready',    category: 'Maxi Dresses',   sub: 'Flowy · adjustable tie',   price: 780, was: null, stock: 18, status: 'active', badge: 'New',  colors: ['Navy','Gold'],        sizes: ['S','M','L','XL'],           sizeStock: { S:4, M:6, L:5, XL:3 },           showInWebStore: true, img: 'linear-gradient(150deg,#232a3d,#0e0a0b)' },
    { id: 'rd-sunset',  name: 'Sunset Pleated Maxi',   collection: 'ready',    category: 'Maxi Dresses',   sub: 'Pleated · flutter sleeve', price: 810, was: null, stock: 10, status: 'active', badge: null,   colors: ['Blush','Gold'],       sizes: ['S','M','L'],                sizeStock: { S:3, M:4, L:3 },                 showInWebStore: true, img: 'linear-gradient(150deg,#f04f9a,#8a1d50)' },
    { id: 'rd-lagoon',  name: 'Lagoon Mini Dress',     collection: 'ready',    category: 'Mini Dresses',   sub: 'Fit & flare',              price: 480, was: null, stock: 26, status: 'active', badge: null,   colors: ['Sage','Ivory'],       sizes: ['XS','S','M','L'],           sizeStock: { XS:5, S:8, M:8, L:5 },           showInWebStore: true, img: 'linear-gradient(150deg,#9caf88,#402a33)' },
    { id: 'rd-palm',    name: 'Palm Print Mini',       collection: 'ready',    category: 'Mini Dresses',   sub: 'Printed · lined',          price: 460, was: null, stock: 20, status: 'active', badge: null,   colors: ['Sage','Black'],       sizes: ['XS','S','M','L','XL'],      sizeStock: { XS:3, S:5, M:6, L:4, XL:2 },     showInWebStore: true, img: 'linear-gradient(150deg,#5c3c48,#180f13)' },
    // Casual Dresses
    { id: 'cs-linen',   name: 'Everyday Linen Dress',  collection: 'casual',   category: 'Day Dresses',    sub: 'Relaxed · breathable',     price: 420, was: null, stock: 30, status: 'active', badge: 'New',  colors: ['Ivory','Sage'],       sizes: ['XS','S','M','L','XL','2XL'], sizeStock: { XS:4, S:6, M:8, L:6, XL:4, '2XL':2 }, showInWebStore: true, img: 'linear-gradient(150deg,#f1e9ec,#a17787)' },
    { id: 'cs-sunday',  name: 'Sunday Cotton Dress',   collection: 'casual',   category: 'Day Dresses',    sub: 'Soft cotton · pockets',    price: 395, was: null, stock: 34, status: 'active', badge: null,   colors: ['Blush','Navy'],       sizes: ['XS','S','M','L','XL'],      sizeStock: { XS:5, S:7, M:8, L:6, XL:4 },     showInWebStore: true, img: 'linear-gradient(150deg,#fc8ec1,#600a32)' },
    { id: 'cs-poplin',  name: 'Poplin Shirt Dress',    collection: 'casual',   category: 'Shirt Dresses',  sub: 'Collared · belted',        price: 470, was: null, stock: 22, status: 'active', badge: null,   colors: ['Ivory','Black'],      sizes: ['XS','S','M','L','XL'],      sizeStock: { XS:3, S:5, M:6, L:5, XL:3 },     showInWebStore: true, img: 'linear-gradient(150deg,#dfc9d1,#291a20)' },
    { id: 'cs-chambray',name: 'Chambray Shirt Dress',  collection: 'casual',   category: 'Shirt Dresses',  sub: 'Lightweight denim feel',   price: 450, was: 520,  stock: 16, status: 'active', badge: 'Sale', colors: ['Navy'],               sizes: ['S','M','L','XL'],           sizeStock: { S:4, M:6, L:4, XL:2 },           showInWebStore: true, img: 'linear-gradient(150deg,#232a3d,#180f13)' },
    { id: 'cs-breezy',  name: 'Breezy Wrap Dress',     collection: 'casual',   category: 'Wrap Dresses',   sub: 'Viscose · V-neck',         price: 430, was: null, stock: 25, status: 'active', badge: null,   colors: ['Terracotta','Sage'],  sizes: ['XS','S','M','L','XL'],      sizeStock: { XS:4, S:6, M:7, L:5, XL:3 },     showInWebStore: true, img: 'linear-gradient(150deg,#c9704f,#5c3c48)' },
    { id: 'cs-terrace', name: 'Terrace Wrap Dress',    collection: 'casual',   category: 'Wrap Dresses',   sub: 'Jersey knit · tie waist',  price: 445, was: null, stock: 19, status: 'active', badge: null,   colors: ['Mauve','Blush'],      sizes: ['XS','S','M','L'],           sizeStock: { XS:3, S:5, M:6, L:4 },           showInWebStore: true, img: 'linear-gradient(150deg,#a17787,#402a33)' },
    // Party & Occasion
    { id: 'oc-starlight', name: 'Starlight Evening Gown',      collection: 'occasion', category: 'Evening Gowns',    sub: 'Floor length · beaded',    price: 1450, was: null, stock: 8,  status: 'active', badge: 'New',  colors: ['Navy','Gold'],   sizes: ['S','M','L'],           sizeStock: { S:2, M:4, L:2 },             showInWebStore: true, img: 'linear-gradient(150deg,#232a3d,#0e0a0b)' },
    { id: 'oc-velvet',    name: 'Velvet Noir Gown',            collection: 'occasion', category: 'Evening Gowns',    sub: 'Velvet · fitted',          price: 1520, was: null, stock: 6,  status: 'active', badge: null,   colors: ['Black','Mauve'], sizes: ['S','M','L'],           sizeStock: { S:2, M:2, L:2 },             showInWebStore: true, img: 'linear-gradient(150deg,#5c3c48,#0e0a0b)' },
    { id: 'oc-champagne', name: 'Champagne Cocktail Dress',    collection: 'occasion', category: 'Cocktail Dresses', sub: 'Satin · midi',             price: 980,  was: null, stock: 12, status: 'active', badge: null,   colors: ['Gold','Ivory'],  sizes: ['XS','S','M','L'],      sizeStock: { XS:2, S:4, M:4, L:2 },       showInWebStore: true, img: 'linear-gradient(150deg,#c9a227,#402a33)' },
    { id: 'oc-sequin',    name: 'Sequin Cocktail Dress',       collection: 'occasion', category: 'Cocktail Dresses', sub: 'Fully sequinned',          price: 1050, was: 1200, stock: 7,  status: 'active', badge: 'Sale', colors: ['Black','Gold'],  sizes: ['XS','S','M','L'],      sizeStock: { XS:1, S:3, M:2, L:1 },       showInWebStore: true, img: 'linear-gradient(150deg,#291a20,#0e0a0b)' },
    { id: 'oc-garden',    name: 'Garden Party Dress',          collection: 'occasion', category: 'Wedding Guest',    sub: 'Floral · midi',            price: 890,  was: null, stock: 14, status: 'active', badge: null,   colors: ['Blush','Sage'],  sizes: ['XS','S','M','L','XL'], sizeStock: { XS:2, S:4, M:4, L:3, XL:1 }, showInWebStore: true, img: 'linear-gradient(150deg,#f04f9a,#9caf88)' },
    { id: 'oc-blossom',   name: 'Blossom Wedding Guest Dress', collection: 'occasion', category: 'Wedding Guest',    sub: 'Chiffon · flutter sleeve', price: 920,  was: null, stock: 11, status: 'active', badge: null,   colors: ['Mauve','Ivory'], sizes: ['XS','S','M','L'],      sizeStock: { XS:2, S:4, M:3, L:2 },       showInWebStore: true, img: 'linear-gradient(150deg,#a17787,#f1e9ec)' },
    // Accessories
    { id: 'ac-straw', name: 'Woven Straw Bag',        collection: 'accessories', category: 'Bags',            sub: 'Handwoven · lined',   price: 320, was: null, stock: 20, status: 'active',  badge: null,  colors: ['Ivory'],              sizes: ['One'], sizeStock: { One:20 }, showInWebStore: true, img: 'linear-gradient(135deg,#f3e6d8,#c2a1ae)' },
    { id: 'ac-cross', name: 'Mini Crossbody Bag',     collection: 'accessories', category: 'Bags',            sub: 'Vegan leather',       price: 380, was: null, stock: 18, status: 'active',  badge: 'New', colors: ['Black','Terracotta'], sizes: ['One'], sizeStock: { One:18 }, showInWebStore: true, img: 'linear-gradient(135deg,#291a20,#c9704f)' },
    { id: 'ac-pearl', name: 'Pearl Drop Earrings',    collection: 'accessories', category: 'Jewellery',       sub: 'Freshwater pearl',    price: 150, was: null, stock: 40, status: 'active',  badge: null,  colors: ['Gold'],               sizes: ['One'], sizeStock: { One:40 }, showInWebStore: true, img: 'linear-gradient(135deg,#c9a227,#402a33)' },
    { id: 'ac-chain', name: 'Layered Chain Necklace', collection: 'accessories', category: 'Jewellery',       sub: '3-layer · adjustable',price: 190, was: null, stock: 32, status: 'active',  badge: null,  colors: ['Gold'],               sizes: ['One'], sizeStock: { One:32 }, showInWebStore: true, img: 'linear-gradient(135deg,#c9a227,#180f13)' },
    { id: 'ac-scarf', name: 'Silk Scarf',             collection: 'accessories', category: 'Belts & Scarves', sub: '90cm square',         price: 140, was: null, stock: 0,  status: 'soldout', badge: null,  colors: ['Blush'],              sizes: ['One'], sizeStock: { One:0 },  showInWebStore: true, img: 'linear-gradient(135deg,#fc8ec1,#600a32)' },
    { id: 'ac-belt',  name: 'Woven Waist Belt',       collection: 'accessories', category: 'Belts & Scarves', sub: 'Adjustable · buckle', price: 160, was: null, stock: 27, status: 'active',  badge: null,  colors: ['Black','Terracotta'], sizes: ['One'], sizeStock: { One:27 }, showInWebStore: true, img: 'linear-gradient(135deg,#180f13,#c9704f)' },
  // Static placeholder data shown before /api/store responds — colorSizeStock isn't tracked
  // per-color here, so every configured colour is given the same per-size totals as a stand-in.
  ].map(p => ({ ...p, colorSizeStock: Object.fromEntries(p.colors.map(c => [c, p.sizeStock])) })) as unknown as Product[],
  orders: [
    { id: 'K7B4X', customer: 'Amina Shareef',    email: 'amina@email.mv',   items: 'Amara Wrap Midi ×1, Silk Scarf ×1', subtotal: 760, discount: 0, productDiscount: 0, deliveryFee: 75, total: 835,  method: 'Delivery' as const, stage: 3 as const, readyForDeliveryAt: null, date: '12 Jun 2026', paid: true,  paidCash: 835, paidTransfer: 0, depositRequired: 835, balanceDue: 0, balancePaid: false, source: 'web' as const, origin: 'web_checkout' as const, locationId: null, locationName: null },
    { id: 'M3Q8Z', customer: 'Aishath Rasheed',  email: 'aishath@email.mv', items: 'Horizon Maxi Dress ×1',              subtotal: 780, discount: 0, productDiscount: 0, deliveryFee: 75, total: 855,  method: 'Delivery' as const, stage: 4 as const, readyForDeliveryAt: '2026-06-11T00:00:00.000Z', date: '11 Jun 2026', paid: true,  paidCash: 855, paidTransfer: 0, depositRequired: 855, balanceDue: 0, balancePaid: false, source: 'web' as const, origin: 'web_checkout' as const, locationId: null, locationName: null },
    { id: 'T5W2C', customer: 'Fathimath Nazly',  email: 'fathimath@email.mv', items: 'Everyday Linen Dress ×2',          subtotal: 840, discount: 0, productDiscount: 0, deliveryFee: 75, total: 915,  method: 'Delivery' as const, stage: 1 as const, readyForDeliveryAt: null, date: '10 Jun 2026', paid: false, paidCash: 0,   paidTransfer: 0, depositRequired: 915, balanceDue: 0, balancePaid: false, source: 'web' as const, origin: 'web_checkout' as const, locationId: null, locationName: null },
    { id: 'R9F6H', customer: 'Mariyam Zoona',    email: 'mariyam@email.mv', items: 'Champagne Cocktail Dress ×1, Layered Chain Necklace ×1', subtotal: 1170, discount: 0, productDiscount: 0, deliveryFee: 75, total: 1245, method: 'Delivery' as const, stage: 0 as const, readyForDeliveryAt: null, date: '09 Jun 2026', paid: false, paidCash: 0, paidTransfer: 0, depositRequired: 1245, balanceDue: 0, balancePaid: false, source: 'web' as const, origin: 'web_checkout' as const, locationId: null, locationName: null },
  ],
  locations: [
    { id: 'loc-online',    name: 'Online Store', showOnWeb: true,  isWebDefault: true,  sortOrder: 0 },
    { id: 'loc-warehouse', name: 'Warehouse',    showOnWeb: false, isWebDefault: false, sortOrder: 1 },
  ],
  deliveryAreas: [],
  sizeCharts: SEED_SIZE_CHARTS,
  reviews: [],
};

const STORE_KEY = 'mm_store_v2';

function normalizeStoreData(d: StoreData): StoreData {
  const base = structuredClone(SEED);
  const next = { ...base, ...d };
  next.settings = { ...base.settings, ...(d.settings ?? {}), storefrontCopy: normalizeStorefrontCopy(d.settings?.storefrontCopy) };
  next.locations = d.locations ?? base.locations;
  next.sizeCharts = d.sizeCharts ?? base.sizeCharts;
  return next;
}

function readStore(): StoreData {
  if (typeof window === 'undefined') return structuredClone(SEED);
  try {
    const v = JSON.parse(localStorage.getItem(STORE_KEY) || 'null') as StoreData | null;
    if (v?.products) {
      return normalizeStoreData(v);
    }
  } catch {}
  return structuredClone(SEED);
}

function writeStore(d: StoreData): StoreData {
  if (typeof window === 'undefined') return d;
  localStorage.setItem(STORE_KEY, JSON.stringify(d));
  window.dispatchEvent(new CustomEvent('mm-store-change'));
  return d;
}

export const MMStore = {
  get: readStore,
  save: writeStore,
  seed(): StoreData { return structuredClone(SEED); },
};
