// Seed the local dev database with the same demo data the front-end ships with
// (ported from lib/store.ts SEED) plus an admin user and ref sequences.
import { Prisma, PrismaClient, ProductStatus, OrderMethod } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { SEED_SIZE_CHARTS } from '../lib/sizeChart';
import { STOREFRONT_COPY_DEFAULTS } from '../lib/storefront-copy';

const prisma = new PrismaClient();

const settings = {
  storeName: 'Dress Collection',
  tagline: 'Womenswear, delivered',
  email: 'hello@dresscollectionmv.com',
  phone: '+960 777 0123',
  address: 'Malé, Maldives',
  bank: 'BML · Dress Collection · 7730000012345',
  currency: 'MVR',
  pickupEnabled: false,
  deliveryFee: 75,
  heroTitle: 'Dresses, delivered to your door.',
  heroSub: 'Shop new arrivals, casual dresses and occasion wear — delivered across the Maldives. No showroom, just great dresses.',
  storefrontCopy: STOREFRONT_COPY_DEFAULTS as unknown as Prisma.InputJsonValue,
};

const collections = [
  { id: 'cl-ready', key: 'ready', label: 'New Arrivals' },
  { id: 'cl-casual', key: 'casual', label: 'Casual Dresses' },
  { id: 'cl-occasion', key: 'occasion', label: 'Party & Occasion' },
  { id: 'cl-accessories', key: 'accessories', label: 'Accessories' },
];

const categories = [
  { id: 'c-midi', name: 'Midi Dresses', collectionKey: 'ready', count: 2 },
  { id: 'c-maxi', name: 'Maxi Dresses', collectionKey: 'ready', count: 2 },
  { id: 'c-mini', name: 'Mini Dresses', collectionKey: 'ready', count: 2 },
  { id: 'c-day', name: 'Day Dresses', collectionKey: 'casual', count: 2 },
  { id: 'c-shirtdress', name: 'Shirt Dresses', collectionKey: 'casual', count: 2 },
  { id: 'c-wrap', name: 'Wrap Dresses', collectionKey: 'casual', count: 2 },
  { id: 'c-evening', name: 'Evening Gowns', collectionKey: 'occasion', count: 2 },
  { id: 'c-cocktail', name: 'Cocktail Dresses', collectionKey: 'occasion', count: 2 },
  { id: 'c-wedding', name: 'Wedding Guest', collectionKey: 'occasion', count: 2 },
  { id: 'c-bags', name: 'Bags', collectionKey: 'accessories', count: 2 },
  { id: 'c-jewellery', name: 'Jewellery', collectionKey: 'accessories', count: 2 },
  { id: 'c-belts', name: 'Belts & Scarves', collectionKey: 'accessories', count: 2 },
];

type SeedProduct = {
  id: string; name: string; collection: string; category: string; sub: string;
  price: number; was: number | null; stock: number; status: ProductStatus;
  badge: string | null; colors: string[]; sizes: string[];
  sizeStock?: Record<string, number>;
  colorSizeStock?: Record<string, Record<string, number>>;
  img: string;
};

const products: SeedProduct[] = [
  { id: 'rd-amara', name: 'Amara Wrap Midi', collection: 'ready', category: 'Midi Dresses', sub: 'Wrap · true to size', price: 620, was: null, stock: 24, status: ProductStatus.active, badge: 'New', colors: ['Blush', 'Terracotta'], sizes: ['XS', 'S', 'M', 'L', 'XL'], colorSizeStock: { Blush: { XS: 2, S: 3, M: 4, L: 3, XL: 1 }, Terracotta: { XS: 1, S: 3, M: 3, L: 2, XL: 2 } }, img: 'linear-gradient(150deg,#e63387,#600a32)' },
  { id: 'rd-coral', name: 'Coral Bay Midi', collection: 'ready', category: 'Midi Dresses', sub: 'A-line · lined', price: 590, was: 690, stock: 15, status: ProductStatus.active, badge: 'Sale', colors: ['Terracotta', 'Ivory'], sizes: ['XS', 'S', 'M', 'L'], img: 'linear-gradient(150deg,#c9704f,#402a33)' },
  { id: 'rd-horizon', name: 'Horizon Maxi Dress', collection: 'ready', category: 'Maxi Dresses', sub: 'Flowy · adjustable tie', price: 780, was: null, stock: 18, status: ProductStatus.active, badge: 'New', colors: ['Navy', 'Gold'], sizes: ['S', 'M', 'L', 'XL'], img: 'linear-gradient(150deg,#232a3d,#0e0a0b)' },
  { id: 'rd-sunset', name: 'Sunset Pleated Maxi', collection: 'ready', category: 'Maxi Dresses', sub: 'Pleated · flutter sleeve', price: 810, was: null, stock: 10, status: ProductStatus.active, badge: null, colors: ['Blush', 'Gold'], sizes: ['S', 'M', 'L'], img: 'linear-gradient(150deg,#f04f9a,#8a1d50)' },
  { id: 'rd-lagoon', name: 'Lagoon Mini Dress', collection: 'ready', category: 'Mini Dresses', sub: 'Fit & flare', price: 480, was: null, stock: 26, status: ProductStatus.active, badge: null, colors: ['Sage', 'Ivory'], sizes: ['XS', 'S', 'M', 'L'], img: 'linear-gradient(150deg,#9caf88,#402a33)' },
  { id: 'rd-palm', name: 'Palm Print Mini', collection: 'ready', category: 'Mini Dresses', sub: 'Printed · lined', price: 460, was: null, stock: 20, status: ProductStatus.active, badge: null, colors: ['Sage', 'Black'], sizes: ['XS', 'S', 'M', 'L', 'XL'], img: 'linear-gradient(150deg,#5c3c48,#180f13)' },
  { id: 'cs-linen', name: 'Everyday Linen Dress', collection: 'casual', category: 'Day Dresses', sub: 'Relaxed · breathable', price: 420, was: null, stock: 30, status: ProductStatus.active, badge: 'New', colors: ['Ivory', 'Sage'], sizes: ['XS', 'S', 'M', 'L', 'XL', '2XL'], img: 'linear-gradient(150deg,#f1e9ec,#a17787)' },
  { id: 'cs-sunday', name: 'Sunday Cotton Dress', collection: 'casual', category: 'Day Dresses', sub: 'Soft cotton · pockets', price: 395, was: null, stock: 34, status: ProductStatus.active, badge: null, colors: ['Blush', 'Navy'], sizes: ['XS', 'S', 'M', 'L', 'XL'], img: 'linear-gradient(150deg,#fc8ec1,#600a32)' },
  { id: 'cs-poplin', name: 'Poplin Shirt Dress', collection: 'casual', category: 'Shirt Dresses', sub: 'Collared · belted', price: 470, was: null, stock: 22, status: ProductStatus.active, badge: null, colors: ['Ivory', 'Black'], sizes: ['XS', 'S', 'M', 'L', 'XL'], img: 'linear-gradient(150deg,#dfc9d1,#291a20)' },
  { id: 'cs-chambray', name: 'Chambray Shirt Dress', collection: 'casual', category: 'Shirt Dresses', sub: 'Lightweight denim feel', price: 450, was: 520, stock: 16, status: ProductStatus.active, badge: 'Sale', colors: ['Navy'], sizes: ['S', 'M', 'L', 'XL'], img: 'linear-gradient(150deg,#232a3d,#180f13)' },
  { id: 'cs-breezy', name: 'Breezy Wrap Dress', collection: 'casual', category: 'Wrap Dresses', sub: 'Viscose · V-neck', price: 430, was: null, stock: 25, status: ProductStatus.active, badge: null, colors: ['Terracotta', 'Sage'], sizes: ['XS', 'S', 'M', 'L', 'XL'], img: 'linear-gradient(150deg,#c9704f,#5c3c48)' },
  { id: 'cs-terrace', name: 'Terrace Wrap Dress', collection: 'casual', category: 'Wrap Dresses', sub: 'Jersey knit · tie waist', price: 445, was: null, stock: 19, status: ProductStatus.active, badge: null, colors: ['Mauve', 'Blush'], sizes: ['XS', 'S', 'M', 'L'], img: 'linear-gradient(150deg,#a17787,#402a33)' },
  { id: 'oc-starlight', name: 'Starlight Evening Gown', collection: 'occasion', category: 'Evening Gowns', sub: 'Floor length · beaded', price: 1450, was: null, stock: 8, status: ProductStatus.active, badge: 'New', colors: ['Navy', 'Gold'], sizes: ['S', 'M', 'L'], img: 'linear-gradient(150deg,#232a3d,#0e0a0b)' },
  { id: 'oc-velvet', name: 'Velvet Noir Gown', collection: 'occasion', category: 'Evening Gowns', sub: 'Velvet · fitted', price: 1520, was: null, stock: 6, status: ProductStatus.active, badge: null, colors: ['Black', 'Mauve'], sizes: ['S', 'M', 'L'], img: 'linear-gradient(150deg,#5c3c48,#0e0a0b)' },
  { id: 'oc-champagne', name: 'Champagne Cocktail Dress', collection: 'occasion', category: 'Cocktail Dresses', sub: 'Satin · midi', price: 980, was: null, stock: 12, status: ProductStatus.active, badge: null, colors: ['Gold', 'Ivory'], sizes: ['XS', 'S', 'M', 'L'], img: 'linear-gradient(150deg,#c9a227,#402a33)' },
  { id: 'oc-sequin', name: 'Sequin Cocktail Dress', collection: 'occasion', category: 'Cocktail Dresses', sub: 'Fully sequinned', price: 1050, was: 1200, stock: 7, status: ProductStatus.active, badge: 'Sale', colors: ['Black', 'Gold'], sizes: ['XS', 'S', 'M', 'L'], img: 'linear-gradient(150deg,#291a20,#0e0a0b)' },
  { id: 'oc-garden', name: 'Garden Party Dress', collection: 'occasion', category: 'Wedding Guest', sub: 'Floral · midi', price: 890, was: null, stock: 14, status: ProductStatus.active, badge: null, colors: ['Blush', 'Sage'], sizes: ['XS', 'S', 'M', 'L', 'XL'], img: 'linear-gradient(150deg,#f04f9a,#9caf88)' },
  { id: 'oc-blossom', name: 'Blossom Wedding Guest Dress', collection: 'occasion', category: 'Wedding Guest', sub: 'Chiffon · flutter sleeve', price: 920, was: null, stock: 11, status: ProductStatus.active, badge: null, colors: ['Mauve', 'Ivory'], sizes: ['XS', 'S', 'M', 'L'], img: 'linear-gradient(150deg,#a17787,#f1e9ec)' },
  { id: 'ac-straw', name: 'Woven Straw Bag', collection: 'accessories', category: 'Bags', sub: 'Handwoven · lined', price: 320, was: null, stock: 20, status: ProductStatus.active, badge: null, colors: ['Ivory'], sizes: ['One'], colorSizeStock: { Ivory: { One: 20 } }, img: 'linear-gradient(135deg,#f3e6d8,#c2a1ae)' },
  { id: 'ac-cross', name: 'Mini Crossbody Bag', collection: 'accessories', category: 'Bags', sub: 'Vegan leather', price: 380, was: null, stock: 18, status: ProductStatus.active, badge: 'New', colors: ['Black', 'Terracotta'], sizes: ['One'], img: 'linear-gradient(135deg,#291a20,#c9704f)' },
  { id: 'ac-pearl', name: 'Pearl Drop Earrings', collection: 'accessories', category: 'Jewellery', sub: 'Freshwater pearl', price: 150, was: null, stock: 40, status: ProductStatus.active, badge: null, colors: ['Gold'], sizes: ['One'], img: 'linear-gradient(135deg,#c9a227,#402a33)' },
  { id: 'ac-chain', name: 'Layered Chain Necklace', collection: 'accessories', category: 'Jewellery', sub: '3-layer · adjustable', price: 190, was: null, stock: 32, status: ProductStatus.active, badge: null, colors: ['Gold'], sizes: ['One'], img: 'linear-gradient(135deg,#c9a227,#180f13)' },
  { id: 'ac-scarf', name: 'Silk Scarf', collection: 'accessories', category: 'Belts & Scarves', sub: '90cm square', price: 140, was: null, stock: 0, status: ProductStatus.soldout, badge: null, colors: ['Blush'], sizes: ['One'], img: 'linear-gradient(135deg,#fc8ec1,#600a32)' },
  { id: 'ac-belt', name: 'Woven Waist Belt', collection: 'accessories', category: 'Belts & Scarves', sub: 'Adjustable · buckle', price: 160, was: null, stock: 27, status: ProductStatus.active, badge: null, colors: ['Black', 'Terracotta'], sizes: ['One'], img: 'linear-gradient(135deg,#180f13,#c9704f)' },
];

const orders = [
  { id: 'K7B4X', customer: 'Amina Shareef', email: 'amina@email.mv', items: 'Amara Wrap Midi ×1, Silk Scarf ×1', total: 835, method: OrderMethod.Delivery, stage: 3, date: '12 Jun 2026', paid: true },
  { id: 'M3Q8Z', customer: 'Aishath Rasheed', email: 'aishath@email.mv', items: 'Horizon Maxi Dress ×1', total: 855, method: OrderMethod.Delivery, stage: 4, date: '11 Jun 2026', paid: true },
  { id: 'T5W2C', customer: 'Fathimath Nazly', email: 'fathimath@email.mv', items: 'Everyday Linen Dress ×2', total: 915, method: OrderMethod.Delivery, stage: 1, date: '10 Jun 2026', paid: false },
  { id: 'R9F6H', customer: 'Mariyam Zoona', email: 'mariyam@email.mv', items: 'Champagne Cocktail Dress ×1, Layered Chain Necklace ×1', total: 1245, method: OrderMethod.Delivery, stage: 0, date: '09 Jun 2026', paid: false },
];

async function main() {
  console.log('Seeding…');

  await prisma.setting.upsert({
    where: { id: 'singleton' },
    update: settings,
    create: { id: 'singleton', ...settings },
  });

  for (const c of SEED_SIZE_CHARTS) {
    const { id, ...data } = c;
    await prisma.sizeChart.upsert({ where: { id }, update: data, create: { id, ...data } });
  }

  // Default locations — Online Store (web-visible) + Warehouse (internal)
  await prisma.location.upsert({ where: { id: 'loc-online' }, update: {}, create: { id: 'loc-online', name: 'Online Store', showOnWeb: true, isWebDefault: true, sortOrder: 0 } });
  await prisma.location.upsert({ where: { id: 'loc-warehouse' }, update: {}, create: { id: 'loc-warehouse', name: 'Warehouse', showOnWeb: false, isWebDefault: false, sortOrder: 1 } });

  for (const c of collections) {
    await prisma.collection.upsert({ where: { id: c.id }, update: c, create: c });
  }
  for (const c of categories) {
    await prisma.category.upsert({ where: { id: c.id }, update: c, create: c });
  }
  for (const p of products) {
    const { sizeStock: ss, colorSizeStock: css, ...rest } = p;
    const flatSizeStock = css
      ? Object.values(css).reduce<Record<string, number>>((acc, bySize) => {
          for (const [size, qty] of Object.entries(bySize)) { if (size !== '') acc[size] = (acc[size] ?? 0) + qty; }
          return acc;
        }, {})
      : (ss ?? {});
    const flatStock = css
      ? Object.values(css).reduce((a, bySize) => a + Object.values(bySize).reduce((x, y) => x + y, 0), 0)
      : ss ? Object.values(ss).reduce((a, b) => a + b, 0) : p.stock;
    const data = { ...rest, was: p.was ?? null, badge: p.badge ?? null,
      sizeStock: flatSizeStock, stock: flatStock };
    await prisma.product.upsert({ where: { id: p.id }, update: data, create: data });
    // Seed Inventory rows for the Online Store location
    if (css && Object.keys(css).length > 0) {
      for (const [color, bySize] of Object.entries(css)) {
        for (const [size, qty] of Object.entries(bySize)) {
          await prisma.inventory.upsert({
            where: { locationId_productId_size_color: { locationId: 'loc-online', productId: p.id, size, color } },
            update: { qty },
            create: { locationId: 'loc-online', productId: p.id, size, color, qty },
          });
        }
      }
    } else if (ss && Object.keys(ss).length > 0) {
      for (const [size, qty] of Object.entries(ss)) {
        await prisma.inventory.upsert({
          where: { locationId_productId_size_color: { locationId: 'loc-online', productId: p.id, size, color: '' } },
          update: { qty },
          create: { locationId: 'loc-online', productId: p.id, size, color: '', qty },
        });
      }
    } else if (p.stock > 0) {
      await prisma.inventory.upsert({
        where: { locationId_productId_size_color: { locationId: 'loc-online', productId: p.id, size: '', color: '' } },
        update: { qty: p.stock },
        create: { locationId: 'loc-online', productId: p.id, size: '', color: '', qty: p.stock },
      });
    }
  }

  for (const o of orders) await prisma.order.upsert({ where: { id: o.id }, update: o, create: o });

  // Admin user (Phase 6 auth). Password from env, hashed here.
  const email = process.env.ADMIN_EMAIL || 'admin@dresscollectionmv.com';
  const password = process.env.ADMIN_PASSWORD || 'admin1234';
  const passwordHash = await bcrypt.hash(password, 10);
  await prisma.adminUser.upsert({
    where: { email },
    update: { passwordHash },
    create: { email, passwordHash },
  });

  console.log(`Seeded: ${products.length} products, ${collections.length} collections, ${categories.length} categories, ${orders.length} orders, admin=${email}`);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
