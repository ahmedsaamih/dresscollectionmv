import { z } from 'zod';
import { STOREFRONT_COPY_DEFAULTS, STOREFRONT_COPY_LIMITS } from './storefront-copy';

// Robust email check that doesn't depend on Zod version specifics.
const email = z
  .string()
  .trim()
  .max(254)
  .refine((v) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v), 'Enter a valid email');

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
  email,
  mobile: requiredMobile,
};

// ─── Checkout (fixed-price order) ────────────────────────────────────────────

const fixedItem = z.object({
  sku: z.string().trim().min(1).max(120),
  name: z.string().trim().min(1).max(180),
  meta: z.string().max(300).optional().default(''),
  img: z.string().max(2048).optional().default(''),
  size: z.string().trim().max(60).optional().default(''),
  color: z.string().trim().max(80).optional().default(''),
  qty: z.number().int().positive().max(100),
  sleeve: z.string().max(80).optional().default(''),
  neck: z.string().max(80).optional().default(''),
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
  })
  .refine((d) => d.method !== 'delivery' || !!d.address?.trim(), {
    message: 'Delivery address is required',
    path: ['address'],
  })
  .refine((d) => d.method !== 'delivery' || !!d.deliveryAreaId?.trim(), {
    message: 'Delivery area is required',
    path: ['deliveryAreaId'],
  });

export type CheckoutInput = z.infer<typeof checkoutSchema>;

// ─── Quote (custom, no price) ────────────────────────────────────────────────

const quoteItem = z.object({
  kind: z.enum(['jersey', 'casual', 'office', 'office-full', 'profile']),
  name: z.string().trim().min(1).max(180),
  specs: z.string().max(1200).optional().default(''),
  units: z.number().int().nonnegative().max(10000).default(0),
  sizesLabel: z.string().max(500).optional().default(''),
  sizes: z.record(z.string().max(80), z.number().int().nonnegative().max(10000)).optional().default({}),
  swatch: z.string().max(80).optional().default(''),
  type: z.string().max(120).nullish(),
  fabric: z.string().max(120).nullish(),
  sleeve: z.string().max(80).nullish(),
  neck: z.string().max(80).nullish(),
  collar: z.boolean().nullish(),
  accent: z.string().max(120).nullish(),
  logoName: z.string().max(180).nullish(),
  notes: z.string().max(1200).nullish(),
  placement: z.string().max(180).nullish(),
  artName: z.string().max(180).nullish(),
  customizationProfileId: z.string().max(120).nullish(),
  customizationProfileName: z.string().max(180).nullish(),
  customizationAnswers: z.record(z.string(), z.unknown()).optional().default({}),
});

// A URL a client claims points at an uploaded file must actually point at our
// own storage (local dev path, Vercel Blob, the configured R2 host, or a
// Drive file the server itself uploaded to) — never an arbitrary scheme like
// `javascript:`/`data:`, since these URLs get rendered back as
// <a href>/<iframe src> in the admin dashboard.
const DRIVE_HOST_RE = /^(drive\.google\.com|.+\.googleusercontent\.com)$/;
// Vercel Blob — kept unconditionally alongside R2, same reasoning as
// next.config.mjs's image/CSP allowlist: production is still on Blob until
// STORAGE_DRIVER is deliberately switched to `r2`, so URLs it hands back
// (artwork uploads, payment-slip receipts) must keep validating.
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
  if (DRIVE_HOST_RE.test(url.hostname)) return true;
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

const uploadedArtwork = z.union([
  storageUrl(),
  z.object({
    url: storageUrl(),
    name: z.string().trim().max(180).nullish(),
    provider: z.string().trim().max(30).optional().default('local'),
    fileId: z.string().trim().max(200).nullish(),
    mimeType: z.string().trim().max(120).nullish(),
    size: z.coerce.number().int().nonnegative().nullish(),
  }),
]);

export const quoteSchema = z.object({
  ...contact,
  message: z.string().trim().max(2000).nullish(),
  items: z.array(quoteItem).min(1, 'No configurations to quote').max(25),
  artworkUrls: z.array(uploadedArtwork).max(50).optional().default([]),
});

export type QuoteInput = z.infer<typeof quoteSchema>;

// ─── Admin: products ─────────────────────────────────────────────────────────

const badge = z.preprocess(
  (v) => (v === '' || v == null ? null : v),
  z.enum(['New', 'Sale']).nullable()
);

const productFields = {
  name: z.string().trim().min(1, 'Name is required'),
  collection: z.string().trim().min(1, 'Collection is required'),
  category: z.string().trim().min(1, 'Category is required'),
  sub: z.string().trim(),
  price: z.coerce.number().int().nonnegative(),
  was: z.coerce.number().int().positive().nullable(),
  costPrice: z.coerce.number().int().nonnegative(),
  stock: z.coerce.number().int().nonnegative(),
  status: z.enum(['active', 'soldout', 'draft']),
  badge,
  colors: z.array(z.string()),
  sizes: z.array(z.string()),
  sizeStock: z.record(z.string(), z.number().int().nonnegative()),
  colorSizeStock: z.record(z.string(), z.record(z.string(), z.number().int().nonnegative())),
  sleeves: z.array(z.string()),
  necks: z.array(z.string()),
  materials: z.array(z.string()),
  sleeveImages: z.record(z.string(), z.string()),
  colorImages: z.record(z.string(), z.string()),
  sleeveAdjustments: z.record(z.string(), z.number().int()),
  sizeAdjustments: z.record(z.string(), z.number().int()),
  descriptionSections: z.array(z.object({
    id: z.string(),
    title: z.string().trim().min(1),
    body: z.string().trim(),
  })),
  customizable: z.boolean(),
  showInWebStore: z.boolean(),
  img: z.string(),
};

export const productCreateSchema = z.object({
  locationId: z.string().trim().min(1, 'Location is required'),
  name: productFields.name,
  collection: productFields.collection,
  category: productFields.category,
  sub: productFields.sub.optional().default(''),
  price: productFields.price,
  was: productFields.was.optional().default(null),
  costPrice: productFields.costPrice.optional().default(0),
  stock: productFields.stock.optional().default(0),
  status: productFields.status.optional().default('active'),
  badge: badge.optional(),
  colors: productFields.colors.optional().default([]),
  sizes: productFields.sizes.optional().default([]),
  sizeStock: productFields.sizeStock.optional().default({}),
  colorSizeStock: productFields.colorSizeStock.optional().default({}),
  sleeves: productFields.sleeves.optional().default([]),
  necks: productFields.necks.optional().default([]),
  materials: productFields.materials.optional().default([]),
  sleeveImages: productFields.sleeveImages.optional().default({}),
  colorImages: productFields.colorImages.optional().default({}),
  sleeveAdjustments: productFields.sleeveAdjustments.optional().default({}),
  sizeAdjustments: productFields.sizeAdjustments.optional().default({}),
  descriptionSections: productFields.descriptionSections.optional().default([]),
  customizable: productFields.customizable.optional().default(false),
  showInWebStore: productFields.showInWebStore.optional().default(true),
  img: productFields.img.optional().default(''),
});

// Partial — only provided keys are updated (preserves colors/sizes the admin UI doesn't edit).
// colorSizeStock is omitted: stock can only be changed via product creation or the
// Inventory menu (Receive/Adjust/Transfer) — never by editing an existing product.
export const productUpdateSchema = z.object(productFields).omit({ colorSizeStock: true }).partial();

// ─── Admin: collections & categories ─────────────────────────────────────────

export const collectionCreateSchema = z.object({
  label: z.string().trim().min(1, 'Name is required'),
  bespoke: z.boolean().optional().default(false),
  sizeChartId: z.string().trim().nullish(),
});
export const collectionUpdateSchema = z.object({
  label: z.string().trim().min(1),
  bespoke: z.boolean().optional(),
  sizeChartId: z.string().trim().nullish(),
});

export const categoryCreateSchema = z.object({
  name: z.string().trim().min(1, 'Name is required'),
  collection: z.string().trim().min(1, 'Collection is required'),
});
export const categoryUpdateSchema = z
  .object({ name: z.string().trim().min(1), collection: z.string().trim().min(1) })
  .partial();

// ─── Admin: customization profiles ──────────────────────────────────────────

const customizationFieldType = z.enum(['text', 'textarea', 'select', 'multiselect', 'checkbox', 'file', 'quantity', 'placement']);
const customizationScope = z.enum(['collection', 'category', 'product']);

export const customizationProfileSchema = z.object({
  name: z.string().trim().min(1, 'Profile name is required'),
  description: z.string().trim().optional().default(''),
  active: z.boolean().optional().default(true),
  sortOrder: z.coerce.number().int().optional().default(0),
  fields: z.array(z.object({
    id: z.string().optional(),
    label: z.string().trim().min(1, 'Field label is required'),
    type: customizationFieldType,
    required: z.boolean().optional().default(false),
    helpText: z.string().trim().optional().default(''),
    placeholder: z.string().trim().optional().default(''),
    options: z.array(z.string().trim().min(1)).optional().default([]),
    sortOrder: z.coerce.number().int().optional().default(0),
  })).optional().default([]),
  assignments: z.array(z.object({
    id: z.string().optional(),
    scope: customizationScope,
    collectionKey: z.string().trim().nullish(),
    categoryId: z.string().trim().nullish(),
    productId: z.string().trim().nullish(),
  })).optional().default([]),
}).superRefine((profile, ctx) => {
  profile.assignments.forEach((assignment, index) => {
    if (assignment.scope === 'collection' && !assignment.collectionKey) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Choose a collection', path: ['assignments', index, 'collectionKey'] });
    }
    if (assignment.scope === 'category' && !assignment.categoryId) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Choose a category', path: ['assignments', index, 'categoryId'] });
    }
    if (assignment.scope === 'product' && !assignment.productId) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Choose a product', path: ['assignments', index, 'productId'] });
    }
  });
});

// ─── Admin: builder options ──────────────────────────────────────────────────

export const builderSchemas = {
  types: z.object({ label: z.string().trim().min(1), desc: z.string().trim().optional().default('') }),
  fabrics: z.object({ name: z.string().trim().min(1), desc: z.string().trim().optional().default(''), img: z.string().optional().default('') }),
  sleeves: z.object({ label: z.string().trim().min(1) }),
  necks: z.object({ label: z.string().trim().min(1) }),
  colors: z.object({ name: z.string().trim().min(1), hex: z.string().trim().min(1) }),
  sizes: z.object({ label: z.string().trim().min(1) }),
} as const;

export type BuilderKind = keyof typeof builderSchemas;

// ─── Admin: orders & quotes ──────────────────────────────────────────────────

export const orderUpdateSchema = z
  .object({
    stage: z.coerce.number().int().min(0).max(6),
    paid: z.boolean(),
    paidCash: z.coerce.number().int().nonnegative(),
    paidCard: z.coerce.number().int().nonnegative(),
    paidTransfer: z.coerce.number().int().nonnegative(),
  })
  .partial()
  .refine((d) => d.stage !== undefined || d.paid !== undefined || d.paidCash !== undefined || d.paidCard !== undefined || d.paidTransfer !== undefined, 'Nothing to update');

export const quoteUpdateSchema = z
  .object({
    stage: z.coerce.number().int().min(0).max(3),
    price: z.coerce.number().int().nonnegative().nullable(),
  })
  .partial()
  .refine((d) => d.stage !== undefined || d.price !== undefined, 'Nothing to update');

// Shared by quote-change-request and review rejection endpoints — same shape.
export const rejectNoteSchema = z.object({
  note: z.string().trim().max(500).optional(),
});

export const sendQuoteConfirmationSchema = z.object({
  ttlDays: z.coerce.number().int().min(1).max(3),
});

// ─── Public: reviews ──────────────────────────────────────────────────────────

export const reviewSubmitSchema = z.object({
  token: z.string().trim().min(1).max(200),
  rating: z.coerce.number().int().min(1).max(5),
  quote: z.string().trim().min(1, 'Please write a short review').max(1000),
  authorName: z.string().trim().max(120).optional(),
  authorRole: z.string().trim().max(120).optional(),
});

// ─── Public: quote confirmation ───────────────────────────────────────────────

export const quoteConfirmDecisionSchema = z.object({
  token: z.string().trim().min(1).max(200),
  decision: z.enum(['confirmed', 'rejected']),
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

const posCustomizationLine = z.object({
  label: z.string().trim().min(1),
  cost: z.coerce.number().int().nonnegative(),
});

const posItem = z.object({
  sku: z.string().min(1),
  name: z.string().min(1),
  meta: z.string().optional().default(''),
  img: z.string().optional().default(''),
  size: z.string().optional().default(''),
  color: z.string().optional().default(''),
  sleeve: z.string().optional().default(''),
  neck: z.string().optional().default(''),
  qty: z.number().int().positive(),
  manualPrice: z.coerce.number().int().nonnegative().optional(),
  customizationNote: z.string().trim().optional().default(''),
  customizationLines: z.array(posCustomizationLine).optional().default([]),
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
  paidCard: z.coerce.number().int().nonnegative().default(0),
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
    adminEmail: z.string().trim(),
    phone: z.string().trim(),
    address: z.string().trim(),
    bank: z.string().trim(),
    bankAccounts: z.array(z.object({ name: z.string().trim().min(1), accountNumber: z.string().trim().min(1) })).optional(),
    builderFields: z.array(z.object({
      id: z.string().min(1),
      label: z.string().trim().min(1),
      type: z.enum(['text', 'select', 'checkbox']),
      options: z.array(z.string()).optional(),
      required: z.boolean().optional(),
      placeholder: z.string().optional(),
    })).optional(),
    currency: z.string().trim().min(1),
    pickupEnabled: z.boolean(),
    deliveryFee: z.coerce.number().int().nonnegative(),
    heroTitle: z.string().trim(),
    heroSub: z.string().trim(),
    heroImage: z.string().trim(),
    heroImages: z.array(z.string().trim().min(1)).max(8).optional(),
    workshopImage: z.string().trim(),
    categoryReadyImage: z.string().trim(),
    categoryCustomImage: z.string().trim(),
    categoryCasualImage: z.string().trim(),
    categoryAccessoriesImage: z.string().trim(),
    customizationGuidePdfUrl: z.string().trim(),
    customizationTemplateXlsxUrl: z.string().trim(),
    storefrontCopy: storefrontCopySchema,
    taxId: z.string().trim(),
    taxRate: z.coerce.number().nonnegative().max(100),
    taxLabel: z.string().trim(),
    termsConditions: z.string().trim(),
    googleDriveUploadsEnabled: z.boolean(),
    googleDriveFolderId: z.string().trim(),
    googleDriveFolderName: z.string().trim(),
    googleDriveLastTestAt: z.coerce.date().nullable(),
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
