import { z } from 'zod';
import { STOREFRONT_COPY_DEFAULTS, STOREFRONT_COPY_LIMITS } from './storefront-copy';

// Phone-number-safe characters only (digits, spaces, +, -, parens) — rejects
// list-separator characters like `,`/`;` and letters. Not a strict national
// format check; the goal is closing off a possible multi-recipient injection
// into the SMS provider's `recipients` field (a single "mobile" value could
// otherwise smuggle several real numbers past the per-phone rate limit,
// which keys on the raw string), not rejecting legitimate international
// numbers.
const mobilePattern = /^[0-9+\-\s()]{5,20}$/;
export const requiredMobile = z.string().trim().max(40).regex(mobilePattern, 'Enter a valid phone number');
export const optionalMobile = z.string().trim().max(40).refine((v) => v === '' || mobilePattern.test(v), 'Enter a valid phone number');

const contact = {
  name: z.string().trim().min(1, 'Name is required').max(120),
  email: z.string().trim().max(254).optional().default(''),
  mobile: requiredMobile,
};

// A URL a client claims points at an uploaded file must actually point at our
// own storage (local dev path, Vercel Blob, or the configured R2 host) —
// never an arbitrary scheme like `javascript:`/`data:`, since these URLs get
// rendered back as <a href>/<iframe src> in the admin dashboard.
// Vercel Blob — kept unconditionally alongside R2, same reasoning as
// next.config.mjs's image/CSP allowlist: production is still on Blob until
// STORAGE_DRIVER is deliberately switched to `r2`, so URLs it hands back
// (payment-slip receipts) must keep validating.
const BLOB_HOST_RE = /^[a-z0-9]+\.public\.blob\.vercel-storage\.com$/;
function isSafeStorageUrl(value: string): boolean {
  if (value.startsWith('/api/files/')) return true;
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return false;
  }
  if (url.protocol !== 'https:') return false;
  if (BLOB_HOST_RE.test(url.hostname)) return true;
  const r2Base = process.env.R2_PUBLIC_BASE_URL;
  if (r2Base) {
    try {
      if (url.hostname === new URL(r2Base).hostname) return true;
    } catch {
      // ignore malformed R2_PUBLIC_BASE_URL
    }
  }
  return false;
}
export const storageUrl = (max = 2048) =>
  z.string().min(1).max(max).refine(isSafeStorageUrl, 'File URL is not from an allowed storage host');

// ─── Checkout (fixed-price order) ────────────────────────────────────────────

const fixedItem = z.object({
  sku: z.string().trim().min(1).max(120),
  name: z.string().trim().min(1).max(180),
  meta: z.string().max(300).optional().default(''),
  img: z.string().max(2048).optional().default(''),
  size: z.string().trim().max(60).optional().default(''),
  color: z.string().trim().max(80).optional().default(''),
  qty: z.number().int().positive().max(100),
});

export const checkoutSchema = z
  .object({
    ...contact,
    method: z.enum(['pickup', 'delivery']),
    address: z.string().trim().max(500).nullish(),
    deliveryAreaId: z.string().trim().nullish(),
    notes: z.string().trim().max(1000).nullish(),
    items: z.array(fixedItem).min(1, 'Cart is empty').max(50),
    promoCode: z.string().trim().max(40).nullish(),
    // Stock is committed (decremented) immediately at checkout for regular items — so proof
    // of payment is required up front rather than deferred to a follow-up upload. Pre-order
    // items skip the stock commitment and only require 50% of their price up front (see
    // depositRequired/balanceDue computed server-side in the checkout route); either way a
    // slip covering the amount actually due now is required at checkout.
    paymentSlipUrl: storageUrl(),
  })
  .refine((d) => d.method !== 'delivery' || !!d.address?.trim(), {
    message: 'Delivery address is required',
    path: ['address'],
  })
  .refine((d) => d.method !== 'delivery' || !!d.deliveryAreaId?.trim(), {
    message: 'Delivery area is required',
    path: ['deliveryAreaId'],
  });

// ─── Admin: products ─────────────────────────────────────────────────────────

const badge = z.preprocess(
  (v) => (v === '' || v == null ? null : v),
  z.enum(['New', 'Sale', 'Pre-order']).nullable()
);

const productFields = {
  name: z.string().trim().min(1, 'Name is required'),
  collection: z.string().trim().min(1, 'Collection is required'),
  category: z.string().trim().min(1, 'Category is required'),
  sub: z.string().trim(),
  price: z.coerce.number().int().nonnegative(),
  was: z.coerce.number().int().positive().nullable(),
  discountType: z.preprocess((v) => (v === '' || v == null ? null : v), z.enum(['percent', 'fixed']).nullable()),
  discountValue: z.coerce.number().int().nonnegative(),
  costPrice: z.coerce.number().int().nonnegative(),
  stock: z.coerce.number().int().nonnegative(),
  status: z.enum(['active', 'soldout', 'draft']),
  badge,
  colors: z.array(z.string()),
  sizes: z.array(z.string()),
  sizeStock: z.record(z.string(), z.number().int().nonnegative()),
  colorSizeStock: z.record(z.string(), z.record(z.string(), z.number().int().nonnegative())),
  descriptionSections: z.array(z.object({
    id: z.string(),
    title: z.string().trim().min(1),
    body: z.string().trim(),
  })),
  showInWebStore: z.boolean(),
  img: z.string(),
  colorImages: z.record(z.string(), z.string()),
  colorHex: z.record(z.string(), z.string()),
  preOrder: z.boolean(),
};

export const productCreateSchema = z.object({
  locationId: z.string().trim().min(1, 'Location is required'),
  name: productFields.name,
  collection: productFields.collection,
  category: productFields.category,
  sub: productFields.sub.optional().default(''),
  price: productFields.price,
  was: productFields.was.optional().default(null),
  discountType: productFields.discountType.optional().default(null),
  discountValue: productFields.discountValue.optional().default(0),
  costPrice: productFields.costPrice.optional().default(0),
  stock: productFields.stock.optional().default(0),
  status: productFields.status.optional().default('active'),
  badge: badge.optional(),
  colors: productFields.colors.optional().default([]),
  sizes: productFields.sizes.optional().default([]),
  sizeStock: productFields.sizeStock.optional().default({}),
  colorSizeStock: productFields.colorSizeStock.optional().default({}),
  descriptionSections: productFields.descriptionSections.optional().default([]),
  showInWebStore: productFields.showInWebStore.optional().default(true),
  img: productFields.img.optional().default(''),
  colorImages: productFields.colorImages.optional().default({}),
  colorHex: productFields.colorHex.optional().default({}),
  preOrder: productFields.preOrder.optional().default(false),
});

// Partial — only provided keys are updated (preserves colors/sizes the admin UI doesn't edit).
// colorSizeStock is omitted: existing stock can only be changed via product creation or the
// Inventory menu (Receive/Adjust/Transfer) — never by editing an existing product. The one
// exception is newColorSizeStock below, which lets the edit form seed *brand-new* colour/size
// combos (ones with no Inventory row anywhere yet) so a newly added colour isn't stranded at
// 0 stock — additive-only, never touches a combo that already has an Inventory row.
export const productUpdateSchema = z.object(productFields).omit({ colorSizeStock: true }).partial().extend({
  newColorSizeStock: z.record(z.string(), z.record(z.string(), z.number().int().nonnegative())).optional(),
  newStockLocationId: z.string().trim().optional(),
});

// ─── Admin: collections & categories ─────────────────────────────────────────

export const collectionCreateSchema = z.object({
  label: z.string().trim().min(1, 'Name is required'),
  sizeChartId: z.string().trim().nullish(),
});
export const collectionUpdateSchema = z.object({
  label: z.string().trim().min(1),
  sizeChartId: z.string().trim().nullish(),
  sortOrder: z.number().int().optional(),
});

export const categoryCreateSchema = z.object({
  name: z.string().trim().min(1, 'Name is required'),
  collection: z.string().trim().min(1, 'Collection is required'),
});
export const categoryUpdateSchema = z
  .object({ name: z.string().trim().min(1), collection: z.string().trim().min(1) })
  .partial();

// ─── Admin: orders ────────────────────────────────────────────────────────────

export const orderUpdateSchema = z
  .object({
    stage: z.coerce.number().int().min(0).max(7),
    paid: z.boolean(),
    paidCash: z.coerce.number().int().nonnegative(),
    paidTransfer: z.coerce.number().int().nonnegative(),
    balancePaid: z.boolean(),
    paidVerified: z.boolean(),
    balancePaidVerified: z.boolean(),
  })
  .partial()
  .refine((d) => Object.values(d).some((v) => v !== undefined), 'Nothing to update');

// Shared by the review rejection endpoint.
export const rejectNoteSchema = z.object({
  note: z.string().trim().max(500).optional(),
});

// ─── Public: reviews ──────────────────────────────────────────────────────────

export const reviewSubmitSchema = z.object({
  token: z.string().trim().min(1).max(200),
  rating: z.coerce.number().int().min(1).max(5),
  quote: z.string().trim().min(1, 'Please write a short review').max(1000),
  authorName: z.string().trim().max(120).optional(),
  authorRole: z.string().trim().max(120).optional(),
});

// ─── Admin: size charts ───────────────────────────────────────────────────────

const sizeChartFields = {
  name: z.string().trim().min(1, 'Name is required'),
  note: z.string().trim(),
  columns: z.array(z.string()).min(1),
  rows: z.array(z.array(z.string())),
  isDefault: z.boolean(),
};

export const sizeChartCreateSchema = z.object({
  name: sizeChartFields.name,
  note: sizeChartFields.note.optional().default(''),
  columns: sizeChartFields.columns,
  rows: sizeChartFields.rows.optional().default([]),
  isDefault: sizeChartFields.isDefault.optional().default(false),
});

// Partial — only provided keys are updated (no defaults, unlike the create schema above).
export const sizeChartUpdateSchema = z.object(sizeChartFields).partial();

// ─── Admin: promo / referral codes ───────────────────────────────────────────

const promoFields = {
  code: z.string().trim().min(1, 'Code is required').max(40),
  description: z.string().trim().nullish(),
  discountType: z.enum(['percent', 'fixed']),
  discountValue: z.coerce.number().int().positive(),
  scope: z.enum(['all', 'collection', 'category']),
  scopeValue: z.string().trim().nullish(),
  minSubtotal: z.coerce.number().int().nonnegative(),
  maxRedemptions: z.coerce.number().int().positive().nullish(),
  expiresAt: z.coerce.date().nullish(),
  active: z.boolean(),
  referrer: z.string().trim().nullish(),
  commissionType: z.enum(['none', 'percent_of_order', 'percent_of_discount', 'fixed']),
  commissionValue: z.coerce.number().int().nonnegative(),
};

const promoRefine = (d: { discountType?: string; discountValue?: number; scope?: string; scopeValue?: string | null }) => {
  if (d.discountType === 'percent' && d.discountValue !== undefined && (d.discountValue < 1 || d.discountValue > 100)) return false;
  if (d.scope && d.scope !== 'all' && !d.scopeValue) return false;
  return true;
};

export const promoCreateSchema = z
  .object({
    code: promoFields.code,
    description: promoFields.description,
    discountType: promoFields.discountType,
    discountValue: promoFields.discountValue,
    scope: promoFields.scope.default('all'),
    scopeValue: promoFields.scopeValue,
    minSubtotal: promoFields.minSubtotal.default(0),
    maxRedemptions: promoFields.maxRedemptions,
    expiresAt: promoFields.expiresAt,
    active: promoFields.active.default(true),
    referrer: promoFields.referrer,
    commissionType: promoFields.commissionType.default('none'),
    commissionValue: promoFields.commissionValue.default(0),
  })
  .refine(promoRefine, { message: 'Percent must be 1–100, and a scope target is required for collection/category codes.' });

export const promoUpdateSchema = z.object(promoFields).partial().refine(promoRefine, {
  message: 'Percent must be 1–100, and a scope target is required for collection/category codes.',
});

// ─── Admin: locations ────────────────────────────────────────────────────────

export const locationCreateSchema = z.object({
  name: z.string().trim().min(1, 'Name is required'),
  showOnWeb: z.boolean().default(false),
  isWebDefault: z.boolean().default(false),
  sortOrder: z.coerce.number().int().nonnegative().default(0),
});

export const locationUpdateSchema = locationCreateSchema.partial();

// ─── Admin: delivery areas ───────────────────────────────────────────────────

export const deliveryAreaCreateSchema = z.object({
  name: z.string().trim().min(1, 'Name is required'),
  rate: z.coerce.number().int().nonnegative(),
  active: z.boolean().default(true),
  sortOrder: z.coerce.number().int().nonnegative().default(0),
});

export const deliveryAreaUpdateSchema = deliveryAreaCreateSchema.partial();

// ─── Admin: inventory ────────────────────────────────────────────────────────

export const receiveStockSchema = z.object({
  locationId: z.string().min(1),
  productId: z.string().min(1),
  size: z.string().default(''),
  color: z.string().default(''),
  qty: z.coerce.number().int().positive('Qty must be at least 1'),
});

export const inventoryPlacementSchema = z.object({
  locationId: z.string().min(1),
  productId: z.string().min(1),
  physicalLocation: z.string().trim().max(120).default(''),
});

export const transferStockSchema = z.object({
  fromId: z.string().min(1),
  toId: z.string().min(1),
  productId: z.string().min(1),
  size: z.string().default(''),
  color: z.string().default(''),
  qty: z.coerce.number().int().positive('Qty must be at least 1'),
  note: z.string().trim().nullish(),
});

// ─── POS: order ──────────────────────────────────────────────────────────────

const posItem = z.object({
  sku: z.string().min(1),
  name: z.string().min(1),
  meta: z.string().optional().default(''),
  img: z.string().optional().default(''),
  size: z.string().optional().default(''),
  color: z.string().optional().default(''),
  qty: z.number().int().positive(),
});

export const posOrderSchema = z.object({
  customer: z.string().trim().optional().default(''),
  mobile: optionalMobile.optional().default(''),
  email: z.string().trim().optional().default(''),
  locationId: z.string().min(1, 'Location is required'),
  method: z.enum(['Pickup', 'Delivery']).default('Pickup'),
  address: z.string().trim().nullish(),
  deliveryAreaId: z.string().trim().nullish(),
  items: z.array(posItem).min(1, 'No items'),
  discount: z.coerce.number().int().nonnegative().default(0),
  discountNote: z.string().trim().nullish(),
  promoCode: z.string().trim().nullish(),
  paidCash: z.coerce.number().int().nonnegative().default(0),
  paidTransfer: z.coerce.number().int().nonnegative().default(0),
  notes: z.string().trim().nullish(),
}).refine((d) => d.method !== 'Delivery' || !!d.address?.trim(), {
  message: 'Delivery address is required',
  path: ['address'],
}).refine((d) => d.method !== 'Delivery' || !!d.deliveryAreaId?.trim(), {
  message: 'Delivery area is required',
  path: ['deliveryAreaId'],
});

// ─── Admin: stock adjustment ─────────────────────────────────────────────────

export const adjustStockSchema = z.object({
  locationId: z.string().min(1),
  productId: z.string().min(1),
  size: z.string().default(''),
  color: z.string().default(''),
  qty: z.coerce.number().int().refine(v => v !== 0, 'Qty cannot be zero'),
  reason: z.enum(['correction', 'damage', 'write_off', 'found']).default('correction'),
  note: z.string().trim().nullish(),
});

// ─── Admin: settings ─────────────────────────────────────────────────────────

const storefrontCopySchema = z.object(
  Object.fromEntries(
    Object.entries(STOREFRONT_COPY_DEFAULTS).map(([section, defaults]) => [
      section,
      z.object(
        Object.fromEntries(
          Object.keys(defaults).map((key) => [
            key,
            z.string().trim().max((STOREFRONT_COPY_LIMITS as Record<string, Record<string, number>>)[section][key]),
          ]),
        ),
      ).partial(),
    ]),
  ),
).partial();

export const settingsUpdateSchema = z
  .object({
    storeName: z.string().trim().min(1),
    tagline: z.string().trim(),
    email: z.string().trim(),
    phone: z.string().trim(),
    address: z.string().trim(),
    bank: z.string().trim(),
    bankAccounts: z.array(z.object({ name: z.string().trim().min(1), accountNumber: z.string().trim().min(1) })).optional(),
    currency: z.string().trim().min(1),
    heroTitle: z.string().trim(),
    heroSub: z.string().trim(),
    heroImage: z.string().trim(),
    heroImages: z.array(z.string().trim().min(1)).max(8).optional(),
    workshopImage: z.string().trim(),
    categoryReadyImage: z.string().trim(),
    categoryCustomImage: z.string().trim(),
    categoryCasualImage: z.string().trim(),
    categoryAccessoriesImage: z.string().trim(),
    storefrontCopy: storefrontCopySchema,
    taxId: z.string().trim(),
    taxRate: z.coerce.number().nonnegative().max(100),
    taxLabel: z.string().trim(),
    termsConditions: z.string().trim(),
    // telegramBotToken is intentionally omitted — it's a secret, only ever
    // written via the dedicated test/disconnect routes, never this generic PATCH.
    telegramChatId: z.string().trim(),
    telegramBotUsername: z.string().trim(),
    telegramAlertsEnabled: z.boolean(),
    telegramLastTestAt: z.coerce.date().nullable(),
    // emailApiKey is intentionally omitted — a secret, only ever written via
    // the dedicated email/test + email/disconnect routes.
    emailFromUser: z.string().trim(),
    emailFromName: z.string().trim(),
    emailAlertsEnabled: z.boolean(),
    emailLastTestAt: z.coerce.date().nullable(),
    // msgowlApiKey is intentionally omitted — a secret, only ever written via
    // the dedicated sms/test + sms/disconnect routes.
    msgowlSenderId: z.string().trim(),
    smsAlertsEnabled: z.boolean(),
    smsLastTestAt: z.coerce.date().nullable(),
  })
  .partial();
