import { cache } from 'react';
import { Prisma } from '@prisma/client';
import { unstable_cache } from 'next/cache';
import { prisma } from '@/lib/prisma';
import type {
  Product,
  ProductBadge,
  StoreSetting,
  StoreCollection,
  StoreCategory,
  SizeChart,
  BankAccount,
  Location,
  DeliveryArea,
  ProductSection,
  Testimonial,
} from '@/lib/types';
import { normalizeStorefrontCopy } from '@/lib/storefront-copy';
import { PRODUCT_SIZES, computeEffectivePrice } from '@/lib/utils';

/**
 * Scoped to exactly what mapProduct reads (drops costPrice and the legacy
 * stock/sizeStock columns, which are recomputed from Inventory and never
 * read directly), and scopes the inventory relation to web-visible
 * locations only — avoids fetching POS-only stock rows for public reads.
 * Admin routes need the full model (costPrice, all locations) and
 * deliberately don't use this.
 */
export const productListSelect = {
  id: true,
  name: true,
  collection: true,
  category: true,
  sub: true,
  price: true,
  was: true,
  discountType: true,
  discountValue: true,
  status: true,
  badge: true,
  colors: true,
  descriptionSections: true,
  showInWebStore: true,
  img: true,
  colorImages: true,
  colorHex: true,
  preOrder: true,
  inventory: {
    where: { location: { showOnWeb: true } },
    select: {
      size: true,
      color: true,
      qty: true,
      location: { select: { showOnWeb: true } },
    },
  },
} satisfies Prisma.ProductSelect;

type ProductRow = Prisma.ProductGetPayload<{ select: typeof productListSelect }>;

export function mapProduct(p: ProductRow): Product {
  // Compute stock + sizeStock + colorSizeStock from Inventory rows (web-visible locations only)
  const webInventory = p.inventory?.filter(i => i.location?.showOnWeb) ?? [];
  const sizeStock: Record<string, number> = {};
  const colorSizeStock: Record<string, Record<string, number>> = {};
  for (const row of webInventory) {
    if (row.size !== '') {
      sizeStock[row.size] = (sizeStock[row.size] ?? 0) + row.qty;
    }
    const bySize = colorSizeStock[row.color] ?? (colorSizeStock[row.color] = {});
    bySize[row.size] = (bySize[row.size] ?? 0) + row.qty;
  }
  const stock = Object.values(sizeStock).reduce((a, b) => a + b, 0)
    || webInventory.filter(i => i.size === '').reduce((a, i) => a + i.qty, 0);

  return {
    id: p.id,
    name: p.name,
    collection: p.collection,
    category: p.category,
    sub: p.sub,
    price: p.price,
    was: p.was ?? null,
    discountType: (p.discountType as 'percent' | 'fixed' | null) ?? null,
    discountValue: p.discountValue,
    effectivePrice: computeEffectivePrice(p.price, p.discountType, p.discountValue),
    stock,
    status: p.status,
    badge: (p.badge as ProductBadge) ?? null,
    colors: p.colors,
    // Every size with an Inventory row is shown (even at qty 0) so it renders
    // as out-of-stock instead of vanishing — a size with no row at all still
    // never appears here (see syncColorSizeStock, which now seeds 0-qty rows
    // for every size the admin's grid renders at creation).
    sizes: Object.keys(sizeStock),
    sizeStock,
    colorSizeStock,
    descriptionSections: (p.descriptionSections as unknown as ProductSection[]) ?? [],
    showInWebStore: p.showInWebStore,
    img: p.img,
    colorImages: (p.colorImages as Record<string, string>) ?? {},
    colorHex: (p.colorHex as Record<string, string>) ?? {},
    preOrder: p.preOrder,
  };
}

/** Flat pseudo-quantity used to represent "available" for a pre-order product
 *  that has no real Inventory yet — large enough to never read as low-stock. */
const PRE_ORDER_PSEUDO_QTY = 99;

/**
 * Public-read-only display synthesis: a pre-order product has no real Inventory
 * (nothing to sell yet), so `mapProduct()`'s ground-truth stock/sizes would be
 * empty and the product would vanish from the storefront and show no sizes.
 * This makes it orderable in every configured colour, across the full standard
 * size scale, for display/checkout-eligibility purposes only — known v1
 * limitation: pre-order always offers every size, no per-size exclusion yet.
 * Never call this for admin inventory-management surfaces (Products tab,
 * Receive/Adjust/Transfer, POS) — those must keep showing real (zero) stock.
 */
export function synthesizePreOrderAvailability(p: Product): Product {
  if (!p.preOrder) return p;
  const colors = p.colors.length > 0 ? p.colors : [''];
  const colorSizeStock: Record<string, Record<string, number>> = {};
  for (const color of colors) {
    colorSizeStock[color] = Object.fromEntries(PRODUCT_SIZES.map((s) => [s, PRE_ORDER_PSEUDO_QTY]));
  }
  const sizeStock = Object.fromEntries(PRODUCT_SIZES.map((s) => [s, PRE_ORDER_PSEUDO_QTY * colors.length]));
  return {
    ...p,
    stock: PRE_ORDER_PSEUDO_QTY * colors.length * PRODUCT_SIZES.length,
    sizes: [...PRODUCT_SIZES],
    sizeStock,
    colorSizeStock,
  };
}

interface CatalogData {
  settings: StoreSetting;
  collections: StoreCollection[];
  categories: StoreCategory[];
  products: Product[];
  locations: Location[];
  deliveryAreas: DeliveryArea[];
  sizeCharts: SizeChart[];
  reviews: Testimonial[];
}

/** Fetch the full public catalog in one round-trip. */
async function fetchCatalog(): Promise<CatalogData> {
  const [
    setting,
    collections,
    categories,
    rawProducts,
    locations,
    deliveryAreas,
    sizeCharts,
    reviewRows,
  ] = await Promise.all([
    prisma.setting.findUnique({ where: { id: 'singleton' } }),
    prisma.collection.findMany(),
    prisma.category.findMany(),
    prisma.product.findMany({
      where: { status: 'active', showInWebStore: true },
      select: productListSelect,
      orderBy: { name: 'asc' },
    }),
    prisma.location.findMany({ orderBy: { sortOrder: 'asc' } }),
    prisma.deliveryArea.findMany({ where: { active: true }, orderBy: { sortOrder: 'asc' } }),
    prisma.sizeChart.findMany({ orderBy: { createdAt: 'asc' } }),
    prisma.review.findMany({
      where: { status: 'approved', featured: true },
      orderBy: { resolvedAt: 'desc' },
      take: 6,
    }),
  ]);

  // Only include products that have stock in at least one web-visible location
  // (pre-order products are exempt — synthesizePreOrderAvailability gives them
  // a positive pseudo-stock so they pass this filter with zero real Inventory).
  const products = rawProducts
    .map(mapProduct)
    .map(synthesizePreOrderAvailability)
    .filter(p => p.stock > 0);

  // Recompute category counts from live products
  const countByCategory = new Map<string, number>();
  for (const p of products) {
    countByCategory.set(p.category, (countByCategory.get(p.category) ?? 0) + 1);
  }

  const settings: StoreSetting = setting
    ? {
        storeName: setting.storeName,
        tagline: setting.tagline,
        email: setting.email,
        phone: setting.phone,
        address: setting.address,
        bank: setting.bank,
        bankAccounts: (setting.bankAccounts as BankAccount[] | null) ?? [],
        currency: setting.currency,
        heroTitle: setting.heroTitle,
        heroSub: setting.heroSub,
        heroImage: setting.heroImage,
        heroImages: (setting.heroImages as string[] | null) ?? [],
        workshopImage: setting.workshopImage,
        categoryReadyImage: setting.categoryReadyImage,
        categoryCustomImage: setting.categoryCustomImage,
        categoryCasualImage: setting.categoryCasualImage,
        categoryAccessoriesImage: setting.categoryAccessoriesImage,
        storefrontCopy: normalizeStorefrontCopy(setting.storefrontCopy),
        taxId: setting.taxId,
        taxRate: setting.taxRate,
        taxLabel: setting.taxLabel,
        termsConditions: setting.termsConditions,
        telegramConnected: !!setting.telegramBotToken,
        telegramChatId: setting.telegramChatId,
        telegramBotUsername: setting.telegramBotUsername,
        telegramAlertsEnabled: setting.telegramAlertsEnabled,
        telegramLastTestAt: setting.telegramLastTestAt?.toISOString() ?? null,
        emailConnected: !!setting.emailApiKey,
        emailFromUser: setting.emailFromUser,
        emailFromName: setting.emailFromName,
        emailAlertsEnabled: setting.emailAlertsEnabled,
        emailLastTestAt: setting.emailLastTestAt?.toISOString() ?? null,
        smsConnected: !!setting.msgowlApiKey,
        msgowlSenderId: setting.msgowlSenderId,
        smsAlertsEnabled: setting.smsAlertsEnabled,
        smsLastTestAt: setting.smsLastTestAt?.toISOString() ?? null,
      }
    : EMPTY_SETTINGS;

  return {
    settings,
    collections: collections.map((c) => ({ id: c.id, key: c.key, label: c.label, sizeChartId: c.sizeChartId })),
    categories: categories.map((c) => ({
      id: c.id,
      name: c.name,
      collection: c.collectionKey,
      count: countByCategory.get(c.name) ?? c.count,
    })),
    products,
    locations: locations.map((l) => ({
      id: l.id, name: l.name, showOnWeb: l.showOnWeb, isWebDefault: l.isWebDefault, sortOrder: l.sortOrder,
    })),
    deliveryAreas: deliveryAreas.map((a) => ({
      id: a.id, name: a.name, rate: a.rate, active: a.active, sortOrder: a.sortOrder,
    })),
    sizeCharts: sizeCharts.map((c) => ({
      id: c.id, name: c.name, note: c.note,
      columns: c.columns as string[], rows: c.rows as string[][],
      isDefault: c.isDefault,
    })),
    reviews: reviewRows.map((r) => ({
      quote: r.quote ?? '',
      name: r.authorName ?? '',
      role: r.authorRole ?? '',
      rating: r.rating ?? undefined,
    })),
  };
}

/**
 * Fetch the full public catalog, cached under the `catalog` tag. Every
 * storefront page shares this one cache entry; `revalidateTag('catalog')` is
 * the real freshness mechanism (called from every admin write that affects
 * catalog output), with a 5-minute TTL as a safety net in case a mutation
 * route is ever missed.
 *
 * Wrapped in React's `cache()` on top of `unstable_cache` so that a page's
 * `generateMetadata` and its default export — which both call this — hit
 * the DB at most once per request even when the outer Data Cache entry is
 * cold (unstable_cache dedupes across requests, not within one).
 */
export const getCatalog = cache(unstable_cache(fetchCatalog, ['catalog'], {
  tags: ['catalog'],
  revalidate: 300,
}));

const EMPTY_SETTINGS: StoreSetting = {
  storeName: 'Dress Collection',
  tagline: '',
  email: '',
  phone: '',
  address: '',
  bank: '',
  bankAccounts: [],
  currency: 'MVR',
  heroTitle: '',
  heroSub: '',
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
};
