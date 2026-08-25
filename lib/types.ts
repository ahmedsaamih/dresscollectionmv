// Dress Collection — shared TypeScript types

import type { Permissions } from './permissions';

// ─── Cart ────────────────────────────────────────────────────────────────────

export interface FixedLineItem {
  id: string;
  sku: string;
  name: string;
  meta: string;
  price: number;          // integer MVR (already includes variant adjustments)
  img: string;            // gradient string or image URL
  size: string;
  color: string;
  qty: number;
}

export interface Cart {
  fixed: FixedLineItem[];
}

export interface CartCounts {
  fixed: number;
  total: number;
}

// ─── Store / Catalog ─────────────────────────────────────────────────────────

export interface SizeChart {
  id: string;
  name: string;        // e.g. "Adult", "Kids"
  note: string;
  columns: string[];   // e.g. ["Size","Chest (cm)","Length (cm)","Shoulder (cm)"]
  rows: string[][];    // each row aligns to columns
  isDefault: boolean;  // used when a collection has no chart assigned
}

export interface BankAccount {
  name: string;
  accountNumber: string;
}

export interface ProductSection { id: string; title: string; body: string }

export interface StorefrontCopy {
  homepageNavigation: {
    navOccasionLabel: string; navAboutLabel: string; statusLabel: string; supportSizeGuideLabel: string; supportShippingLabel: string; supportFaqLabel: string;
    footerShopTitle: string; footerSupportTitle: string; footerCompanyTitle: string; footerIntro: string;
    heroEyebrow: string; heroTitle: string; heroPrimaryCta: string; heroSecondaryCta: string;
    heroStatOneValue: string; heroStatOneLabel: string; heroStatTwoValue: string; heroStatTwoLabel: string; heroStatThreeValue: string; heroStatThreeLabel: string;
    categoryReadyDesc: string; categoryOccasionDesc: string; categoryCasualDesc: string; categoryAccessoriesDesc: string; categoryExploreLabel: string;
    featuredEyebrow: string; featuredTitle: string; featuredViewAll: string;
    buildPromoEyebrow: string; buildPromoTitle: string; buildPromoBody: string; buildPromoCta: string;
    accessoriesTitle: string; accessoriesCta: string; testimonialsEyebrow: string;
    storyEyebrow: string; storyTitle: string; storyBody: string; storyCta: string;
  };
  paymentCheckout: {
    footerPaymentBadge: string; footerPaymentLine: string; checkoutNoCardLine: string;
    paymentHeading: string; noCardBadge: string; paymentIntro: string;
    paymentInstructionsTitle: string; paymentInstructionsBody: string;
    slipUploadTitle: string; slipUploadHelp: string; slipReceived: string;
    orderPlacedTitle: string; orderPlacedBody: string; receiptFileHint: string;
    depositDueNowLabel: string; depositBalanceLabel: string; depositExplainerBody: string;
    depositConfirmationTitle: string; depositConfirmationBody: string;
  };
  shippingPickup: {
    shippingPageTitle: string; shippingPageIntro: string;
    pickupCardTitle: string; pickupCardBody: string; pickupCardMeta: string;
    deliveryCardTitle: string; deliveryCardBody: string; deliveryCardMeta: string;
    pickupOptionLabel: string; pickupOptionDesc: string; deliveryOptionLabel: string; deliveryOptionDesc: string;
    pickupAddressLine: string; deliveryAddressPlaceholder: string;
    productionTitle: string; productionBody: string; deliveryEstimateTitle: string; deliveryEstimateBody: string; manualPaymentTitle: string; manualPaymentBody: string;
  };
  productCatalog: {
    viewOptionsLabel: string; loadMoreLabel: string; noItemsTitle: string; noItemsBody: string; clearFiltersLabel: string;
    productStockLine: string;
    accordionDescriptionTitle: string; accordionJerseyDescription: string; accordionCareTitle: string; accordionCareBody: string;
    accordionShippingTitle: string; accordionShippingBody: string; accessoriesDescriptionBody: string; casualDescriptionBody: string;
    trustOneLabel: string; trustTwoLabel: string; trustThreeLabel: string; relatedTitle: string;
    sizeGuideMeasureTitle: string; sizeGuideMeasureBody: string; sizeGuideTeamTitle: string; sizeGuideTeamBody: string; sizeGuideContactCta: string;
  };
  cartQuoteStatus: {
    cartTitle: string; cartEmptyHeadline: string; cartFixedHeadline: string;
    cartEmptyTitle: string; cartEmptyBody: string; shopReadyCta: string; buildKitCta: string; checkoutCta: string; noCardCartNote: string;
    preOrderCartNote: string;
    upsellTitle: string; upsellBody: string; upsellSkip: string;
    statusEyebrow: string; statusTitle: string; statusIntro: string; statusNoMatchTitle: string; statusNoMatchBody: string;
  };
}

export interface StoreSetting {
  storeName: string;
  tagline: string;
  email: string;
  adminEmail: string;
  phone: string;
  address: string;
  bank: string;
  bankAccounts: BankAccount[];
  currency: string;
  pickupEnabled: boolean;
  deliveryFee: number;
  heroTitle: string;
  heroSub: string;
  heroImage: string;
  heroImages: string[];
  workshopImage: string;
  categoryReadyImage: string;
  categoryCustomImage: string; // "Party & Occasion" category card image (field name predates the rebrand)
  categoryCasualImage: string;
  categoryAccessoriesImage: string;
  storefrontCopy: StorefrontCopy;
  taxId: string;
  taxRate: number;
  taxLabel: string;
  termsConditions: string;
  telegramConnected: boolean;
  telegramChatId: string;
  telegramBotUsername: string;
  telegramAlertsEnabled: boolean;
  telegramLastTestAt?: string | null;
  emailConnected: boolean;
  emailFromUser: string;
  emailFromName: string;
  emailAlertsEnabled: boolean;
  emailLastTestAt?: string | null;
  smsConnected: boolean;
  msgowlSenderId: string;
  smsAlertsEnabled: boolean;
  smsLastTestAt?: string | null;
}

export interface StoreCollection {
  id: string;
  key: string;      // slug, e.g. "ready"
  label: string;    // display, e.g. "Ready-Made"
  sizeChartId: string | null; // → SizeChart.id; null = falls back to the default chart
}

export interface StoreCategory {
  id: string;
  name: string;
  collection: string;  // → StoreCollection.key
  count: number;       // denormalised hint
}

export type ProductStatus = 'active' | 'soldout' | 'draft';
export type ProductBadge = 'New' | 'Sale' | 'Pre-order' | null;

export interface Product {
  id: string;
  name: string;
  collection: string;   // → StoreCollection.key
  category: string;     // → StoreCategory.name
  sub: string;
  price: number;        // integer MVR — the raw regular price, always what admin edits
  was: number | null;   // compare-at or null
  discountType: 'percent' | 'fixed' | null; // automatic per-product discount, distinct from PromoCode
  discountValue: number; // percent (0-100) or fixed MVR off, per discountType
  effectivePrice: number; // price after discountType/discountValue — the real charged/displayed price
  stock: number;
  status: ProductStatus;
  badge: ProductBadge;
  colors: string[];
  sizes: string[];
  sizeStock: Record<string, number>; // { "S": 5, "M": 10, ... } — summed across colors
  colorSizeStock: Record<string, Record<string, number>>; // { "Teal": { "S": 5, "M": 10 }, "": { "S": 2 } }
  showInWebStore: boolean;  // false = POS-only, hidden from storefront
  img: string;          // gradient placeholder → replace with URL
  colorImages: Record<string, string>; // { "Teal": "url(...) center/cover no-repeat" } — optional, falls back to img
  colorHex: Record<string, string>; // { "Teal": "#1c5f5a" } — optional, falls back to COLOR_MAP then grey
  descriptionSections?: ProductSection[]; // optional — falls back to template copy on the product page when empty/absent
  preOrder: boolean; // true = orderable with zero real stock, at a 50% deposit (public reads synthesize availability)
}

export type OrderStage = 0 | 1 | 2 | 3 | 4 | 5 | 6;

// Best-effort, client-submitted (in-browser OCR) fields read off a payment-slip image.
// Informational only — never proof of payment; the receipt's own image is the source of truth.
export interface ReceiptOcr {
  bankName: string | null;
  status: string | null;
  referenceNumber: string | null;
  transactionDate: string | null;
  fromName: string | null;
  toName: string | null;
  toAccount: string | null;
  amount: number | null;
  currency: string | null;
}

export interface OrderReceipt {
  id: string;
  url: string;
  kind: 'payment_slip' | 'payment_receipt' | 'balance_slip' | 'balance_receipt';
  createdAt: string;
  expiresAt: string | null;
  expired: boolean;
  ocr: ReceiptOcr | null;
}

export interface OrderLineItem {
  id: string;
  sku: string;
  name: string;
  meta: string;
  price: number;
  costPrice: number; // snapshot of Product.costPrice at order time
  discount: number; // snapshot of per-unit product discount applied (regular price − effective price)
  img: string;
  size: string;
  color: string;
  qty: number;
}

export interface Order {
  id: string;
  customer: string;
  email: string;
  mobile?: string | null;
  address?: string | null;
  notes?: string | null;
  items: string;
  subtotal?: number;
  discount?: number; // promo/manual cart-level discount
  productDiscount: number; // Σ(OrderItem.discount × qty) — automatic per-product discounts
  deliveryFee?: number;
  deliveryAreaId?: string | null;
  deliveryAreaName?: string | null;
  discountNote?: string | null;
  total: number;
  method: 'Pickup' | 'Delivery';
  stage: OrderStage;
  readyForDeliveryAt?: string | null;
  date: string;
  paid: boolean; // for a pre-order (depositRequired>0), means "deposit confirmed"
  paidCash: number;
  paidCard: number;
  paidTransfer: number;
  depositRequired: number; // amount required at checkout; equals `total` for a non-pre-order order
  balanceDue: number; // total − depositRequired; 0 unless the order contained pre-order items
  balancePaid: boolean;
  source: 'web' | 'pos';
  origin: 'web_checkout' | 'pos_sale' | 'manual_order' | 'quote_conversion';
  locationId?: string | null;
  locationName?: string | null;
  quoteRef?: string | null;
  pdfUrl?: string | null;
  pdfExpiresAt?: string | null;
  pdfExpired?: boolean;
  lineItems?: OrderLineItem[];
  receipts?: OrderReceipt[];
}

// ─── Inventory & Locations ────────────────────────────────────────────────────

export interface Location {
  id: string;
  name: string;
  showOnWeb: boolean;
  isWebDefault: boolean;
  sortOrder: number;
}

export interface DeliveryArea {
  id: string;
  name: string;
  rate: number;
  active: boolean;
  sortOrder: number;
}

// ─── Customers ────────────────────────────────────────────────────────────

export interface Customer {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  createdAt: string;
}

export interface NotificationLog {
  id: string;
  channel: string; // 'email' | 'sms'
  event: string;
  orderRef: string | null;
  recipient: string;
  provider: string;
  providerMessageId: string | null;
  status: string; // 'sent' | 'delivered' | 'failed' | 'skipped'
  error: string | null;
  deliveredAt: string | null;
  createdAt: string;
}

export interface InventoryRow {
  locationId: string;
  locationName: string;
  productId: string;
  size: string;
  color: string;
  qty: number;
  physicalLocation: string;
}

export interface StockTransferRecord {
  id: string;
  fromId: string;
  fromName: string;
  toId: string;
  toName: string;
  productId: string;
  productName: string;
  size: string;
  color: string;
  qty: number;
  note: string | null;
  actor: string;
  date: string;
}

export interface Review {
  id: string;
  orderId: string;
  orderCustomer: string;
  orderEmail: string;
  rating: number | null;
  quote: string | null;
  authorName: string | null;
  authorRole: string | null;
  submittedAt: string | null;
  status: 'pending' | 'approved' | 'rejected';
  featured: boolean;
  resolvedBy: string | null;
  resolvedAt: string | null;
  rejectionNote: string | null;
  createdAt: string;
}

// ─── Admin users ─────────────────────────────────────────────────────────────

export type AdminRole = 'admin' | 'staff';

export interface AdminUser {
  id: string;
  email: string;
  role: AdminRole;
  permissions: Permissions;
  createdAt: string;
}

// ─── Promo / referral codes ──────────────────────────────────────────────────

export type DiscountType = 'percent' | 'fixed';
export type PromoScope = 'all' | 'collection' | 'category';
export type CommissionType = 'none' | 'percent_of_order' | 'percent_of_discount' | 'fixed';

export interface PromoCode {
  id: string;
  code: string;
  description: string | null;
  discountType: DiscountType;
  discountValue: number;
  scope: PromoScope;
  scopeValue: string | null;
  minSubtotal: number;
  maxRedemptions: number | null;
  expiresAt: string | null; // ISO date
  active: boolean;
  referrer: string | null;
  commissionType: CommissionType;
  commissionValue: number;
  timesUsed: number;
}

export interface Redemption {
  id: string;
  code: string;
  orderId: string;
  subtotal: number;
  eligible: number;
  discount: number;
  referrer: string | null;
  commission: number;
  date: string; // ISO timestamp
}

export interface Testimonial {
  quote: string;
  name: string;
  role: string;
  rating?: number; // 1–5; absent for the static placeholder fallback quotes
}

export interface StoreData {
  settings: StoreSetting;
  collections: StoreCollection[];
  categories: StoreCategory[];
  products: Product[];
  locations: Location[];
  deliveryAreas: DeliveryArea[];
  orders: Order[];
  sizeCharts: SizeChart[];
  reviews: Testimonial[];
}
