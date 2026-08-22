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
  sleeve?: string;        // selected sleeve label — passed to checkout for server re-pricing
  neck?: string;          // selected collar/neck label for fixed-price items
}

export interface QuoteLineItem {
  id: string;
  kind: 'jersey' | 'casual' | 'office' | 'office-full' | 'profile';
  name: string;
  specs: string;          // human-readable summary
  units: number;
  sizesLabel: string;     // e.g. "S2 M4 L4 XL2"
  sizes: Record<string, number | Record<string, number>>;
  swatch: string;         // hex or gradient
  // jersey-specific
  type?: string;
  fabric?: string;        // also used for office-wear material
  sleeve?: string;
  neck?: string;
  collar?: boolean;
  accent?: string;
  logoName?: string | null;
  notes?: string;
  // casual-print-specific
  placement?: 'front' | 'back' | 'both' | 'sleeve';
  artName?: string | null;
  // client-held artwork (base64 data URL) → uploaded to a stored URL at quote submit
  artwork?: string | null;
  // office-wear: named artwork slots (frontLogo, backLogo, frontLabel, backLabel, placement)
  artworks?: Record<string, string | null>;
  customizationProfileId?: string | null;
  customizationProfileName?: string | null;
  customizationAnswers?: Record<string, unknown>;
}

export interface Cart {
  fixed: FixedLineItem[];
  quote: QuoteLineItem[];
}

export interface CartCounts {
  fixed: number;
  quote: number;
  quoteUnits: number;
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

export type BuilderFieldType = 'text' | 'select' | 'checkbox';

export interface BuilderField {
  id: string;
  label: string;
  type: BuilderFieldType;
  options?: string[];
  required?: boolean;
  placeholder?: string;
}

export interface ProductSection { id: string; title: string; body: string }

export interface StorefrontCopy {
  homepageNavigation: {
    navCustomLabel: string; navAboutLabel: string; statusLabel: string; supportSizeGuideLabel: string; supportShippingLabel: string; supportFaqLabel: string;
    footerShopTitle: string; footerSupportTitle: string; footerCompanyTitle: string; footerIntro: string;
    heroEyebrow: string; heroTitle: string; heroPrimaryCta: string; heroSecondaryCta: string;
    heroStatOneValue: string; heroStatOneLabel: string; heroStatTwoValue: string; heroStatTwoLabel: string; heroStatThreeValue: string; heroStatThreeLabel: string;
    categoryReadyDesc: string; categoryCustomDesc: string; categoryCasualDesc: string; categoryAccessoriesDesc: string; categoryExploreLabel: string;
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
    productStockLine: string; quoteOnRequestLabel: string;
    customizableCasualHelp: string; customizableJerseyHelp: string; customizationProfileHelp: string;
    accordionDescriptionTitle: string; accordionJerseyDescription: string; accordionCareTitle: string; accordionCareBody: string;
    accordionShippingTitle: string; accordionShippingBody: string; accessoriesDescriptionBody: string; casualDescriptionBody: string;
    trustOneLabel: string; trustTwoLabel: string; trustThreeLabel: string; relatedTitle: string;
    sizeGuideMeasureTitle: string; sizeGuideMeasureBody: string; sizeGuideTeamTitle: string; sizeGuideTeamBody: string; sizeGuideBuilderCta: string;
    customizationUploadHelp: string;
  };
  cartQuoteStatus: {
    cartTitle: string; cartEmptyHeadline: string; cartMixedHeadline: string; cartFixedHeadline: string; cartQuoteHeadline: string;
    cartEmptyTitle: string; cartEmptyBody: string; shopReadyCta: string; buildKitCta: string; checkoutCta: string; noCardCartNote: string;
    quoteSummaryTitle: string; quoteSummaryBody: string; quoteRequestCta: string;
    upsellTitle: string; upsellBody: string; upsellSkip: string;
    quotePageTitle: string; quotePageIntro: string; quoteEmptyTitle: string; quoteEmptyBody: string;
    quoteSuccessTitle: string; quoteSuccessBody: string;
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
  builderFields: BuilderField[];
  currency: string;
  pickupEnabled: boolean;
  deliveryFee: number;
  heroTitle: string;
  heroSub: string;
  heroImage: string;
  heroImages: string[];
  workshopImage: string;
  categoryReadyImage: string;
  categoryCustomImage: string;
  categoryCasualImage: string;
  categoryAccessoriesImage: string;
  customizationGuidePdfUrl: string;
  customizationTemplateXlsxUrl: string;
  storefrontCopy: StorefrontCopy;
  taxId: string;
  taxRate: number;
  taxLabel: string;
  termsConditions: string;
  googleDriveUploadsEnabled: boolean;
  googleDriveFolderId: string;
  googleDriveFolderName: string;
  googleDriveLastTestAt?: string | null;
  googleDriveConnectedEmail: string;
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
  bespoke: boolean; // true = semi/full customize modals; false = standard listing
  sizeChartId: string | null; // → SizeChart.id; null = falls back to the default chart
}

export interface StoreCategory {
  id: string;
  name: string;
  collection: string;  // → StoreCollection.key
  count: number;       // denormalised hint
}

export type CustomizationFieldType = 'text' | 'textarea' | 'select' | 'multiselect' | 'checkbox' | 'file' | 'quantity' | 'placement';
export type CustomizationScope = 'collection' | 'category' | 'product';

export interface CustomizationProfileField {
  id: string;
  label: string;
  type: CustomizationFieldType;
  required: boolean;
  helpText: string;
  placeholder: string;
  options: string[];
  sortOrder: number;
}

export interface CustomizationProfileAssignment {
  id: string;
  profileId: string;
  scope: CustomizationScope;
  collectionKey?: string | null;
  categoryId?: string | null;
  productId?: string | null;
}

export interface CustomizationProfile {
  id: string;
  name: string;
  description: string;
  active: boolean;
  sortOrder: number;
  fields: CustomizationProfileField[];
  assignments: CustomizationProfileAssignment[];
}

export type ProductStatus = 'active' | 'soldout' | 'draft';
export type ProductBadge = 'New' | 'Sale' | null;

export interface Product {
  id: string;
  name: string;
  collection: string;   // → StoreCollection.key
  category: string;     // → StoreCategory.name
  sub: string;
  price: number;        // integer MVR
  was: number | null;   // compare-at or null
  stock: number;
  status: ProductStatus;
  badge: ProductBadge;
  colors: string[];
  sizes: string[];
  sizeStock: Record<string, number>; // { "S": 5, "M": 10, ... } — summed across colors
  colorSizeStock: Record<string, Record<string, number>>; // { "Teal": { "S": 5, "M": 10 }, "": { "S": 2 } }
  sleeves: string[];    // available sleeve labels
  necks: string[];      // available collar/neck labels
  materials: string[];  // available material names (office wear, free-form per-product)
  sleeveImages: Record<string, string>;      // sleeve label → CSS background value
  colorImages: Record<string, string>;       // colour name → CSS background value
  sleeveAdjustments: Record<string, number>; // sleeve label → price delta (MVR)
  sizeAdjustments: Record<string, number>;   // size label → price delta (MVR)
  customizable: boolean;
  showInWebStore: boolean;  // false = POS-only, hidden from storefront
  img: string;          // gradient placeholder → replace with URL
  descriptionSections?: ProductSection[]; // optional — falls back to template copy on the product page when empty/absent
}

export interface BuilderType    { id: string; label: string; desc: string }
export interface BuilderFabric  { id: string; name: string;  desc: string; img?: string }
export interface BuilderSleeve  { id: string; label: string }
export interface BuilderNeck    { id: string; label: string }
export interface BuilderColor   { id: string; name: string; hex: string }
export interface BuilderSize    { id: string; label: string }

export interface BuilderOptions {
  types:   BuilderType[];
  fabrics: BuilderFabric[];
  sleeves: BuilderSleeve[];
  necks:   BuilderNeck[];
  colors:  BuilderColor[];
  sizes:   BuilderSize[];
}

export type OrderStage = 0 | 1 | 2 | 3 | 4 | 5 | 6;
export type QuoteStage = 0 | 1 | 2 | 3;

export interface OrderReceipt {
  id: string;
  url: string;
  kind: 'payment_slip' | 'payment_receipt';
  createdAt: string;
  expiresAt: string | null;
  expired: boolean;
}

export interface OrderLineItem {
  id: string;
  sku: string;
  name: string;
  meta: string;
  price: number;
  img: string;
  size: string;
  color: string;
  sleeve: string;
  neck: string;
  qty: number;
  customizationNote?: string;
  customizationLines?: { label: string; cost: number }[];
  customizationCost?: number;
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
  discount?: number;
  deliveryFee?: number;
  deliveryAreaId?: string | null;
  deliveryAreaName?: string | null;
  discountNote?: string | null;
  total: number;
  method: 'Pickup' | 'Delivery';
  stage: OrderStage;
  readyForDeliveryAt?: string | null;
  date: string;
  paid: boolean;
  paidCash: number;
  paidCard: number;
  paidTransfer: number;
  source: 'web' | 'pos';
  origin: 'web_checkout' | 'pos_sale' | 'manual_order' | 'quote_conversion';
  locationId?: string | null;
  locationName?: string | null;
  quoteRef?: string | null;
  pdfUrl?: string | null;
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

export interface QuoteItemDetail {
  id: string;
  kind: string;
  name: string;
  specs: string;
  units: number;
  sizesLabel: string;
  sizes: Record<string, number>;
  swatch: string;
  colorName?: string | null;
  type?: string | null;
  fabric?: string | null;
  sleeve?: string | null;
  neck?: string | null;
  collar?: boolean | null;
  accent?: string | null;
  logoName?: string | null;
  notes?: string | null;
  placement?: string | null;
  artName?: string | null;
  builder?: Record<string, unknown> | null;
  customizationProfileId?: string | null;
  customizationProfileName?: string | null;
  customizationAnswers?: Record<string, unknown> | null;
  productId?: string | null;
  unitPrice: number;
  customizationLines?: { label: string; cost: number }[];
  customizationCost: number;
}

export type QuoteCustomerDecision = 'pending' | 'confirmed' | 'rejected';

export interface Quote {
  id: string;
  customer: string;
  email: string;
  mobile?: string | null;
  message?: string | null;
  configs: number;
  units: number;
  summary: string;
  stage: QuoteStage;
  price: number | null;
  computedPrice: number;
  date: string;
  pdfUrl?: string | null;
  lineItems?: QuoteItemDetail[];
  artworks?: QuoteArtwork[];
  hasPendingRequest?: boolean;
  customerDecision?: QuoteCustomerDecision;
  sentForConfirmationAt?: string | null;
  confirmationTokenExpiresAt?: string | null;
  respondedAt?: string | null;
  paymentSlipUrl?: string | null;
  paymentSlipUploadedAt?: string | null;
}

export interface QuoteArtwork {
  id: string;
  url: string;
  name: string | null;
  provider: string;
  fileId: string | null;
  mimeType: string | null;
  size: number | null;
  createdAt: string;
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

export interface QuoteChangeRequest {
  id: string;
  quoteId: string;
  quoteCustomer: string;
  quoteEmail: string;
  quoteSummary: string;
  requestedBy: string;
  currentStage: number;
  currentPrice: number | null;
  requestedStage: number | null;
  requestedPrice: number | null;
  status: 'pending' | 'accepted' | 'rejected';
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
  customizationProfiles: CustomizationProfile[];
  builderOptions: BuilderOptions;
  locations: Location[];
  deliveryAreas: DeliveryArea[];
  orders: Order[];
  quotes: Quote[];
  sizeCharts: SizeChart[];
  reviews: Testimonial[];
}
