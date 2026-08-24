import type { StorefrontCopy } from './types';

type CopySection = keyof StorefrontCopy;
type CopyKey<S extends CopySection> = keyof StorefrontCopy[S] & string;

export const STOREFRONT_COPY_DEFAULTS: StorefrontCopy = {
  homepageNavigation: {
    navOccasionLabel: 'Party & Occasion',
    navAboutLabel: 'About',
    statusLabel: 'Order Status',
    supportSizeGuideLabel: 'Size Guide',
    supportShippingLabel: 'Shipping & Delivery',
    supportFaqLabel: 'FAQ',
    footerShopTitle: 'Shop',
    footerSupportTitle: 'Support',
    footerCompanyTitle: 'Company',
    footerIntro: 'New arrivals, casual dresses, occasion wear and accessories — delivered to your door.',
    heroEyebrow: 'Online only · Maldives-wide delivery',
    heroTitle: 'Dresses, delivered to your door.',
    heroPrimaryCta: 'Shop new arrivals',
    heroSecondaryCta: 'Shop casual dresses',
    heroStatOneValue: '5k+',
    heroStatOneLabel: 'Dresses delivered',
    heroStatTwoValue: '1–3d',
    heroStatTwoLabel: 'Greater Malé delivery',
    heroStatThreeValue: '100%',
    heroStatThreeLabel: 'Online, no showroom',
    categoryReadyDesc: 'Fresh styles, ready to ship.',
    categoryOccasionDesc: 'Dresses for every celebration.',
    categoryCasualDesc: 'Easy, everyday dressing.',
    categoryAccessoriesDesc: 'Bags, jewellery & more.',
    categoryExploreLabel: 'Explore',
    featuredEyebrow: 'New Arrivals',
    featuredTitle: 'Featured dresses',
    featuredViewAll: 'View all',
    buildPromoEyebrow: 'The edit · Party & Occasion',
    buildPromoTitle: 'Dressed up, made easy.',
    buildPromoBody: 'From dinner dates to weddings — browse our occasion edit and get it delivered before the big day.',
    buildPromoCta: 'Shop occasion wear',
    accessoriesTitle: 'Complete the look · Accessories',
    accessoriesCta: 'Shop all',
    testimonialsEyebrow: 'Loved by shoppers across the Maldives',
    storyEyebrow: 'Our story',
    storyTitle: 'A dress shop, not a warehouse.',
    storyBody: 'We hand-pick every style before it goes online — no physical store, just a curated collection and quick delivery across the Maldives.',
    storyCta: 'More about us',
  },
  paymentCheckout: {
    footerPaymentBadge: 'Bank transfer · Manual checkout',
    footerPaymentLine: 'No card payments — manual checkout by bank transfer, verified before dispatch.',
    checkoutNoCardLine: 'Guest checkout · no account needed. Manual payment — we never ask for card details.',
    paymentHeading: 'Payment',
    noCardBadge: 'No card',
    paymentIntro: "Pay by bank transfer. You'll get a reference number after placing your order.",
    paymentInstructionsTitle: 'Payment instructions',
    paymentInstructionsBody: "Transfer to one of the accounts below using your reference. We'll confirm by SMS once received.",
    slipUploadTitle: 'Upload payment slip',
    slipUploadHelp: 'Already transferred? Upload your bank slip so we can verify faster.',
    slipReceived: "Payment slip received — we'll verify and confirm your order.",
    orderPlacedTitle: 'Order placed',
    orderPlacedBody: "We've received your order and emailed a confirmation.",
    receiptFileHint: 'PNG, JPG or PDF · max 8 MB',
    depositDueNowLabel: 'Due now (50% deposit)',
    depositBalanceLabel: 'Balance due on arrival',
    depositExplainerBody: "Your cart includes a pre-order item. You'll pay a 50% deposit now — the remaining balance is due once it arrives.",
    depositConfirmationTitle: 'Deposit received',
    depositConfirmationBody: "We've received your 50% deposit and emailed a confirmation. We'll be in touch when the balance is due.",
  },
  shippingPickup: {
    shippingPageTitle: 'Shipping & delivery',
    shippingPageIntro: 'How we get your dress to you across the Maldives.',
    pickupCardTitle: 'Online only',
    pickupCardBody: "We're a delivery-only boutique — there's no showroom to visit. Every order ships straight to you.",
    pickupCardMeta: 'No pickup',
    deliveryCardTitle: 'Island delivery',
    deliveryCardBody: 'Flat-rate delivery across the Maldives via trusted ferry & courier partners.',
    deliveryCardMeta: 'MVR 75',
    pickupOptionLabel: 'Delivery only',
    pickupOptionDesc: 'We deliver every order — there is no pickup option.',
    deliveryOptionLabel: 'Delivery',
    deliveryOptionDesc: 'Island-wide delivery available.',
    pickupAddressLine: 'Dress Collection is delivery-only — we have no walk-in store or counter to collect from.',
    deliveryAddressPlaceholder: 'Island · house · ferry details',
    productionTitle: 'Dispatch times',
    productionBody: 'In-stock items dispatch within 1–2 business days of your order being confirmed and payment verified.',
    deliveryEstimateTitle: 'Delivery estimates',
    deliveryEstimateBody: "Greater Malé deliveries usually arrive in 1–3 days. Outer-atoll deliveries take 3–7 days depending on ferry schedules. We'll share a tracking update by SMS.",
    manualPaymentTitle: 'Manual payment before dispatch',
    manualPaymentBody: "Because we don't take card payments, orders are dispatched once your bank transfer is received. Use your DC- reference as the transfer note.",
  },
  productCatalog: {
    viewOptionsLabel: 'View options',
    loadMoreLabel: 'Load more',
    noItemsTitle: 'No items match those filters',
    noItemsBody: 'Try widening your price range or clearing a filter.',
    clearFiltersLabel: 'Clear all filters',
    productStockLine: 'In stock · ships 1–2 days',
    accordionDescriptionTitle: 'Description',
    accordionJerseyDescription: 'A soft, breathable weave that moves with you — cut for an easy, flattering fit in tropical heat.',
    accordionCareTitle: 'Fabric & care',
    accordionCareBody: 'Machine wash cold, inside out, with similar colours. Do not tumble dry. Hang to dry and iron on a low heat if needed.',
    accordionShippingTitle: 'Shipping & delivery',
    accordionShippingBody: 'Ships across the Maldives in 1–3 days. Delivery only — no pickup or showroom. Bank transfer, no card needed.',
    accessoriesDescriptionBody: 'Part of the Dress Collection accessories edit, chosen to complete your look.',
    casualDescriptionBody: 'Easy, everyday dressing. Choose your colour and size — comfortable enough for daytime, pretty enough for anywhere.',
    trustOneLabel: 'Hand-checked before dispatch',
    trustTwoLabel: 'Delivered island-wide',
    trustThreeLabel: '7-day exchange',
    relatedTitle: 'You might also like',
    sizeGuideMeasureTitle: 'How to measure',
    sizeGuideMeasureBody: 'Bust: measure around the fullest part of your chest. Waist: measure around your natural waistline. Hips: measure around the fullest part of your hips.',
    sizeGuideTeamTitle: 'Not sure of your size?',
    sizeGuideTeamBody: 'Message us your measurements and the style you like — we\'ll help you pick the right size before you order.',
    sizeGuideContactCta: 'Contact us',
  },
  cartQuoteStatus: {
    cartTitle: 'Your cart',
    cartEmptyHeadline: 'Nothing here yet.',
    cartFixedHeadline: 'Ready to check out with manual payment.',
    cartEmptyTitle: 'Your cart is empty',
    cartEmptyBody: 'Add a dress from new arrivals or browse casual styles to get started.',
    shopReadyCta: 'Shop new arrivals',
    buildKitCta: 'Shop casual dresses',
    checkoutCta: 'Proceed to checkout',
    noCardCartNote: 'Bank transfer only · no card',
    preOrderCartNote: 'Includes a pre-order item — 50% deposit due now, balance on arrival.',
    upsellTitle: 'Complete your look',
    upsellBody: 'Choose accessory options before you check out.',
    upsellSkip: 'Skip, go to checkout',
    statusEyebrow: 'No login needed',
    statusTitle: 'Track your order',
    statusIntro: 'Enter the reference from your order confirmation — DC- for orders.',
    statusNoMatchTitle: 'No match for that reference',
    statusNoMatchBody: 'Double-check the reference from your confirmation. Still stuck? Contact us.',
  },
};

export const STOREFRONT_COPY_LIMITS: { [S in CopySection]: Record<CopyKey<S>, number> } = {
  homepageNavigation: {
    navOccasionLabel: 32, navAboutLabel: 24, statusLabel: 36, supportSizeGuideLabel: 28, supportShippingLabel: 32, supportFaqLabel: 18,
    footerShopTitle: 24, footerSupportTitle: 24, footerCompanyTitle: 24, footerIntro: 140,
    heroEyebrow: 48, heroTitle: 72, heroPrimaryCta: 32, heroSecondaryCta: 32,
    heroStatOneValue: 18, heroStatOneLabel: 32, heroStatTwoValue: 18, heroStatTwoLabel: 32, heroStatThreeValue: 18, heroStatThreeLabel: 36,
    categoryReadyDesc: 80, categoryOccasionDesc: 80, categoryCasualDesc: 80, categoryAccessoriesDesc: 80, categoryExploreLabel: 24,
    featuredEyebrow: 36, featuredTitle: 48, featuredViewAll: 24,
    buildPromoEyebrow: 48, buildPromoTitle: 64, buildPromoBody: 220, buildPromoCta: 32,
    accessoriesTitle: 48, accessoriesCta: 24, testimonialsEyebrow: 64,
    storyEyebrow: 36, storyTitle: 64, storyBody: 240, storyCta: 36,
  },
  paymentCheckout: {
    footerPaymentBadge: 40, footerPaymentLine: 120, checkoutNoCardLine: 140,
    paymentHeading: 32, noCardBadge: 18, paymentIntro: 180,
    paymentInstructionsTitle: 40, paymentInstructionsBody: 220,
    slipUploadTitle: 40, slipUploadHelp: 140, slipReceived: 140,
    orderPlacedTitle: 40, orderPlacedBody: 140, receiptFileHint: 60,
    depositDueNowLabel: 40, depositBalanceLabel: 40, depositExplainerBody: 220,
    depositConfirmationTitle: 40, depositConfirmationBody: 180,
  },
  shippingPickup: {
    shippingPageTitle: 48, shippingPageIntro: 120,
    pickupCardTitle: 40, pickupCardBody: 140, pickupCardMeta: 24,
    deliveryCardTitle: 40, deliveryCardBody: 160, deliveryCardMeta: 24,
    pickupOptionLabel: 28, pickupOptionDesc: 110, deliveryOptionLabel: 28, deliveryOptionDesc: 110,
    pickupAddressLine: 180, deliveryAddressPlaceholder: 80,
    productionTitle: 56, productionBody: 280, deliveryEstimateTitle: 56, deliveryEstimateBody: 260, manualPaymentTitle: 56, manualPaymentBody: 260,
  },
  productCatalog: {
    viewOptionsLabel: 32, loadMoreLabel: 28, noItemsTitle: 56, noItemsBody: 120, clearFiltersLabel: 32,
    productStockLine: 48,
    accordionDescriptionTitle: 32, accordionJerseyDescription: 220, accordionCareTitle: 32, accordionCareBody: 220,
    accordionShippingTitle: 36, accordionShippingBody: 220, accessoriesDescriptionBody: 180, casualDescriptionBody: 180,
    trustOneLabel: 32, trustTwoLabel: 32, trustThreeLabel: 32, relatedTitle: 48,
    sizeGuideMeasureTitle: 40, sizeGuideMeasureBody: 200, sizeGuideTeamTitle: 40, sizeGuideTeamBody: 180, sizeGuideContactCta: 32,
  },
  cartQuoteStatus: {
    cartTitle: 36, cartEmptyHeadline: 64, cartFixedHeadline: 90,
    cartEmptyTitle: 48, cartEmptyBody: 140, shopReadyCta: 32, buildKitCta: 36, checkoutCta: 36, noCardCartNote: 80,
    preOrderCartNote: 140,
    upsellTitle: 48, upsellBody: 120, upsellSkip: 36,
    statusEyebrow: 36, statusTitle: 56, statusIntro: 160, statusNoMatchTitle: 56, statusNoMatchBody: 160,
  },
};

export function normalizeStorefrontCopy(input: unknown): StorefrontCopy {
  const source = input && typeof input === 'object' ? input as Partial<Record<CopySection, Record<string, unknown>>> : {};
  const copy = structuredClone(STOREFRONT_COPY_DEFAULTS);
  (Object.keys(copy) as CopySection[]).forEach((section) => {
    const sectionSource = source[section];
    if (!sectionSource || typeof sectionSource !== 'object') return;
    const sectionCopy = copy[section] as Record<string, string>;
    (Object.keys(copy[section]) as CopyKey<typeof section>[]).forEach((key) => {
      const raw = sectionSource[key];
      if (typeof raw !== 'string') return;
      const trimmed = raw.trim();
      sectionCopy[key] = trimmed.slice(0, STOREFRONT_COPY_LIMITS[section][key]);
    });
  });
  return copy;
}

export const STOREFRONT_COPY_GROUPS: {
  section: CopySection;
  title: string;
  description: string;
  fields: { key: string; label: string; maxLength: number }[];
}[] = (Object.keys(STOREFRONT_COPY_DEFAULTS) as CopySection[]).map((section) => ({
  section,
  title: ({
    homepageNavigation: 'Homepage & Navigation',
    paymentCheckout: 'Payment & Checkout',
    shippingPickup: 'Shipping & Pickup',
    productCatalog: 'Product & Catalog',
    cartQuoteStatus: 'Cart & Status',
  })[section],
  description: ({
    homepageNavigation: 'Hero, homepage cards, navigation labels, footer and support phrases.',
    paymentCheckout: 'Payment messaging, checkout no-card copy, receipt and slip upload text.',
    shippingPickup: 'Shipping promises, pickup address and delivery helper text.',
    productCatalog: 'Catalog actions, product fallback accordions, trust strip and size-guide copy.',
    cartQuoteStatus: 'Cart empty states, upsell modal and status page headings.',
  })[section],
  fields: (Object.keys(STOREFRONT_COPY_DEFAULTS[section]) as string[]).map((key) => ({
    key,
    label: key.replace(/([A-Z])/g, ' $1').replace(/^./, (s) => s.toUpperCase()),
    maxLength: STOREFRONT_COPY_LIMITS[section][key as CopyKey<typeof section>],
  })),
}));
