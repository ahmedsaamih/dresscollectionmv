import { prisma } from '@/lib/prisma';
import type {
  Product,
  ProductBadge,
  StoreSetting,
  StoreCollection,
  StoreCategory,
  BuilderOptions,
  SizeChart,
  BankAccount,
  BuilderField,
  Location,
  DeliveryArea,
  ProductSection,
  CustomizationProfile,
  Testimonial,
} from '@/lib/types';
import { customizationProfileInclude, serializeCustomizationProfile } from '@/lib/customization-profiles';
import { normalizeStorefrontCopy } from '@/lib/storefront-copy';

type ProductRow = Awaited<ReturnType<typeof prisma.product.findMany<{ include: { inventory: { include: { location: true } } } }>>>[number];

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
    sleeves: p.sleeves,
    necks: p.necks,
    materials: p.materials,
    sleeveImages: (p.sleeveImages as Record<string, string>) ?? {},
    colorImages: (p.colorImages as Record<string, string>) ?? {},
    sleeveAdjustments: (p.sleeveAdjustments as Record<string, number>) ?? {},
    sizeAdjustments: (p.sizeAdjustments as Record<string, number>) ?? {},
    descriptionSections: (p.descriptionSections as unknown as ProductSection[]) ?? [],
    customizable: p.customizable,
    showInWebStore: p.showInWebStore,
    img: p.img,
  };
}

export interface CatalogData {
  settings: StoreSetting;
  collections: StoreCollection[];
  categories: StoreCategory[];
  products: Product[];
  customizationProfiles: CustomizationProfile[];
  builderOptions: BuilderOptions;
  locations: Location[];
  deliveryAreas: DeliveryArea[];
  sizeCharts: SizeChart[];
  reviews: Testimonial[];
}

/** Fetch the full public catalog in one round-trip. */
export async function getCatalog(): Promise<CatalogData> {
  const [
    setting,
    collections,
    categories,
    rawProducts,
    types,
    fabrics,
    sleeves,
    necks,
    colors,
    sizes,
    locations,
    deliveryAreas,
    sizeCharts,
    customizationProfiles,
    reviewRows,
  ] = await Promise.all([
    prisma.setting.findUnique({ where: { id: 'singleton' } }),
    prisma.collection.findMany(),
    prisma.category.findMany(),
    prisma.product.findMany({
      where: { status: 'active', showInWebStore: true },
      include: { inventory: { include: { location: true } } },
      orderBy: { name: 'asc' },
    }),
    prisma.builderType.findMany(),
    prisma.builderFabric.findMany(),
    prisma.builderSleeve.findMany(),
    prisma.builderNeck.findMany(),
    prisma.builderColor.findMany(),
    prisma.builderSize.findMany(),
    prisma.location.findMany({ orderBy: { sortOrder: 'asc' } }),
    prisma.deliveryArea.findMany({ where: { active: true }, orderBy: { sortOrder: 'asc' } }),
    prisma.sizeChart.findMany({ orderBy: { createdAt: 'asc' } }),
    prisma.customizationProfile.findMany({
      include: customizationProfileInclude,
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    }),
    prisma.review.findMany({
      where: { status: 'approved', featured: true },
      orderBy: { resolvedAt: 'desc' },
      take: 6,
    }),
  ]);

  // Only include products that have stock in at least one web-visible location
  const products = rawProducts
    .map(mapProduct)
    .filter(p => p.stock > 0 || p.customizable);

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
        adminEmail: setting.adminEmail,
        phone: setting.phone,
        address: setting.address,
        bank: setting.bank,
        bankAccounts: (setting.bankAccounts as BankAccount[] | null) ?? [],
        builderFields: (setting.builderFields as BuilderField[] | null) ?? [],
        currency: setting.currency,
        pickupEnabled: setting.pickupEnabled,
        deliveryFee: setting.deliveryFee,
        heroTitle: setting.heroTitle,
        heroSub: setting.heroSub,
        heroImage: setting.heroImage,
        heroImages: (setting.heroImages as string[] | null) ?? [],
        workshopImage: setting.workshopImage,
        categoryReadyImage: setting.categoryReadyImage,
        categoryCustomImage: setting.categoryCustomImage,
        categoryCasualImage: setting.categoryCasualImage,
        categoryAccessoriesImage: setting.categoryAccessoriesImage,
        customizationGuidePdfUrl: setting.customizationGuidePdfUrl,
        customizationTemplateXlsxUrl: setting.customizationTemplateXlsxUrl,
        storefrontCopy: normalizeStorefrontCopy(setting.storefrontCopy),
        taxId: setting.taxId,
        taxRate: setting.taxRate,
        taxLabel: setting.taxLabel,
        termsConditions: setting.termsConditions,
        googleDriveUploadsEnabled: setting.googleDriveUploadsEnabled,
        googleDriveFolderId: setting.googleDriveFolderId,
        googleDriveFolderName: setting.googleDriveFolderName,
        googleDriveLastTestAt: setting.googleDriveLastTestAt?.toISOString() ?? null,
        googleDriveConnectedEmail: setting.googleDriveConnectedEmail,
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
    collections: collections.map((c) => ({ id: c.id, key: c.key, label: c.label, bespoke: c.bespoke, sizeChartId: c.sizeChartId })),
    categories: categories.map((c) => ({
      id: c.id,
      name: c.name,
      collection: c.collectionKey,
      count: countByCategory.get(c.name) ?? c.count,
    })),
    products,
    customizationProfiles: customizationProfiles.map(serializeCustomizationProfile),
    builderOptions: {
      types: types.map((t) => ({ id: t.id, label: t.label, desc: t.desc })),
      fabrics: fabrics.map((f) => ({ id: f.id, name: f.name, desc: f.desc, img: f.img ?? '' })),
      sleeves: sleeves.map((s) => ({ id: s.id, label: s.label })),
      necks: necks.map((n) => ({ id: n.id, label: n.label })),
      colors: colors.map((c) => ({ id: c.id, name: c.name, hex: c.hex })),
      sizes: sizes.map((s) => ({ id: s.id, label: s.label })),
    },
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

const EMPTY_SETTINGS: StoreSetting = {
  storeName: 'Dress Collection',
  tagline: '',
  email: '',
  adminEmail: '',
  phone: '',
  address: '',
  bank: '',
  bankAccounts: [],
  builderFields: [],
  currency: 'MVR',
  pickupEnabled: true,
  deliveryFee: 0,
  heroTitle: '',
  heroSub: '',
  heroImage: '',
  heroImages: [],
  workshopImage: '',
  categoryReadyImage: '',
  categoryCustomImage: '',
  categoryCasualImage: '',
  categoryAccessoriesImage: '',
  customizationGuidePdfUrl: '',
  customizationTemplateXlsxUrl: '',
  storefrontCopy: normalizeStorefrontCopy(null),
  taxId: '',
  taxRate: 0,
  taxLabel: 'GST',
  termsConditions: '',
  googleDriveUploadsEnabled: false,
  googleDriveFolderId: '',
  googleDriveFolderName: '',
  googleDriveLastTestAt: null,
  googleDriveConnectedEmail: '',
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
