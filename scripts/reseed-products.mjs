/**
 * reseed-products.mjs
 * Run: node scripts/reseed-products.mjs
 *
 * 1. Deletes all products
 * 2. Removes the gym-wear collection (cascades to its categories)
 * 3. Restores casual-wear category names
 * 4. Inserts fresh products with all fields correctly populated
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// ─── helpers ──────────────────────────────────────────────────────────────────

/** Build sizes[] and stock from a sizeStock map. */
function derived(sizeStock) {
  const sizes = Object.entries(sizeStock).filter(([, q]) => q > 0).map(([s]) => s);
  const stock = Object.values(sizeStock).reduce((a, b) => a + b, 0);
  return { sizes, stock };
}

// ─── product definitions ───────────────────────────────────────────────────────

const PRODUCTS = [
  // ── Ready-Made Jerseys (not customizable, tracked stock) ──────────────────
  {
    id: 'rm-reef', name: 'Reef Pro Jersey', collection: 'ready', category: 'Football',
    sub: 'Player · Short sleeve', price: 540, was: null, status: 'active', badge: 'New',
    colors: ['Teal', 'Black'],
    sizeStock: { S: 5, M: 8, L: 6, XL: 4 },
    sleeves: [], necks: [], customizable: false,
    img: 'linear-gradient(150deg,#1d8a77,#02362c)',
  },
  {
    id: 'rm-keeper', name: 'Keeper Elite', collection: 'ready', category: 'Football',
    sub: 'Goalkeeper · Long sleeve', price: 610, was: 720, status: 'active', badge: 'Sale',
    colors: ['Green', 'Black'],
    sizeStock: { M: 4, L: 5, XL: 3 },
    sleeves: [], necks: [], customizable: false,
    img: 'linear-gradient(150deg,#0a604f,#0c201d)',
  },
  {
    id: 'rm-atoll', name: 'Atoll Home Kit', collection: 'ready', category: 'Football',
    sub: 'Official · Round neck', price: 580, was: null, status: 'active', badge: null,
    colors: ['Navy', 'White'],
    sizeStock: { S: 3, M: 6, L: 7, XL: 5, '2XL': 2 },
    sleeves: [], necks: [], customizable: false,
    img: 'linear-gradient(150deg,#16302a,#080808)',
  },
  {
    id: 'rm-lagoon', name: 'Lagoon Away Kit', collection: 'ready', category: 'Football',
    sub: 'Official · V-neck', price: 580, was: null, status: 'active', badge: null,
    colors: ['Teal', 'White'],
    sizeStock: { M: 4, L: 5, XL: 3 },
    sleeves: [], necks: [], customizable: false,
    img: 'linear-gradient(150deg,#02362c,#080808)',
  },
  {
    id: 'rm-tide', name: 'Tide Training Top', collection: 'ready', category: 'Football',
    sub: 'Player · Long sleeve', price: 450, was: null, status: 'active', badge: null,
    colors: ['Teal', 'Navy'],
    sizeStock: { M: 3, L: 5, XL: 4, '2XL': 2 },
    sleeves: [], necks: [], customizable: false,
    img: 'linear-gradient(150deg,#16302a,#0a604f)',
  },
  {
    id: 'rm-storm', name: 'Storm Keeper', collection: 'ready', category: 'Football',
    sub: 'Goalkeeper · Long sleeve', price: 640, was: null, status: 'active', badge: 'New',
    colors: ['Coral', 'Black'],
    sizeStock: { L: 2, XL: 3 },
    sleeves: [], necks: [], customizable: false,
    img: 'linear-gradient(150deg,#1a1a1a,#0c201d)',
  },
  {
    id: 'rm-court', name: 'Court Tank', collection: 'ready', category: 'Basketball',
    sub: 'Player · Sleeveless', price: 460, was: null, status: 'active', badge: 'New',
    colors: ['Teal', 'Green'],
    sizeStock: { S: 5, M: 6, L: 4 },
    sleeves: [], necks: [], customizable: false,
    img: 'linear-gradient(150deg,#39c1aa,#0a604f)',
  },
  {
    id: 'rm-dunk', name: 'Dunk Jersey', collection: 'ready', category: 'Basketball',
    sub: 'Player · Sleeveless', price: 490, was: 560, status: 'active', badge: 'Sale',
    colors: ['Black', 'Coral'],
    sizeStock: { S: 3, M: 5, L: 4, XL: 2 },
    sleeves: [], necks: [], customizable: false,
    img: 'linear-gradient(150deg,#0c201d,#1a1a1a)',
  },
  {
    id: 'rm-fast', name: 'Fastbreak Tank', collection: 'ready', category: 'Basketball',
    sub: 'Player · Sleeveless', price: 470, was: null, status: 'active', badge: null,
    colors: ['Green', 'Black'],
    sizeStock: { S: 4, M: 5, L: 3, XL: 2 },
    sleeves: [], necks: [], customizable: false,
    img: 'linear-gradient(150deg,#0a604f,#080808)',
  },
  {
    id: 'rm-spike', name: 'Spike Pro Tee', collection: 'ready', category: 'Volleyball',
    sub: 'Player · Short sleeve', price: 420, was: null, status: 'active', badge: null,
    colors: ['White', 'Teal'],
    sizeStock: { XS: 2, S: 4, M: 5, L: 3 },
    sleeves: [], necks: [], customizable: false,
    img: 'linear-gradient(150deg,#1d8a77,#16302a)',
  },
  {
    id: 'rm-rally', name: 'Rally Jersey', collection: 'ready', category: 'Volleyball',
    sub: 'Player · Sleeveless', price: 430, was: null, status: 'active', badge: null,
    colors: ['Teal', 'Green'],
    sizeStock: { XS: 2, S: 4, M: 5, L: 4, XL: 3 },
    sleeves: [], necks: [], customizable: false,
    img: 'linear-gradient(150deg,#39c1aa,#02362c)',
  },
  {
    id: 'rm-ace', name: 'Ace Set', collection: 'ready', category: 'Volleyball',
    sub: 'Player · Short sleeve', price: 510, was: null, status: 'active', badge: null,
    colors: ['Green', 'White'],
    sizeStock: { S: 3, M: 5, L: 4 },
    sleeves: [], necks: [], customizable: false,
    img: 'linear-gradient(150deg,#0a604f,#02362c)',
  },

  // ── Casual Wear (customizable: true — quote flow) ─────────────────────────
  {
    id: 'cw-tee', name: 'Atoll Cotton Tee', collection: 'casual', category: 'T-Shirts',
    sub: 'Unisex · 180 GSM', price: 220, was: null, status: 'active', badge: null,
    colors: ['Teal', 'Black', 'White'],
    sizeStock: { XS: 10, S: 15, M: 20, L: 18, XL: 12, '2XL': 6 },
    sleeves: ['Short'],  // whitelist: only short sleeve makes sense for a tee
    necks: ['Round'],    // whitelist: only round neck
    customizable: true,
    img: 'linear-gradient(150deg,#1d8a77,#02362c)',
  },
  {
    id: 'cw-tank', name: 'Training Tank', collection: 'casual', category: 'T-Shirts',
    sub: 'Unisex · breathable', price: 190, was: null, status: 'active', badge: null,
    colors: ['Coral', 'Black', 'Teal'],
    sizeStock: { XS: 8, S: 12, M: 15, L: 12, XL: 8 },
    sleeves: [],  // no sleeves — it's a tank
    necks: ['Round'],
    customizable: true,
    img: 'linear-gradient(150deg,#0a604f,#0c201d)',
  },
  {
    id: 'cw-ltee', name: 'Long-Sleeve Tee', collection: 'casual', category: 'T-Shirts',
    sub: 'Unisex · 200 GSM', price: 260, was: null, status: 'active', badge: null,
    colors: ['White', 'Teal', 'Green'],
    sizeStock: { XS: 6, S: 10, M: 14, L: 12, XL: 8 },
    sleeves: ['Long'],  // only long sleeve
    necks: ['Round'],
    customizable: true,
    img: 'linear-gradient(150deg,#1d8a77,#16302a)',
  },
  {
    id: 'cw-hoodie', name: 'Reef Pullover Hoodie', collection: 'casual', category: 'Hoodies',
    sub: 'Heavyweight · fleece', price: 480, was: null, status: 'active', badge: null,
    colors: ['Black', 'Navy', 'Green'],
    sizeStock: { S: 6, M: 8, L: 7, XL: 4 },
    sleeves: ['Long'],
    necks: ['Round'],
    customizable: true,
    img: 'linear-gradient(150deg,#16302a,#080808)',
  },
  {
    id: 'cw-zip', name: 'Lagoon Zip Hoodie', collection: 'casual', category: 'Hoodies',
    sub: 'Full zip · fleece', price: 540, was: null, status: 'active', badge: null,
    colors: ['Navy', 'Black'],
    sizeStock: { S: 5, M: 7, L: 6, XL: 3 },
    sleeves: ['Long'],
    necks: ['Round'],
    customizable: true,
    img: 'linear-gradient(150deg,#02362c,#080808)',
  },
  {
    id: 'cw-polo', name: 'Club Polo', collection: 'casual', category: 'Polos',
    sub: 'Pique knit · collar', price: 320, was: null, status: 'active', badge: null,
    colors: ['Teal', 'White', 'Navy'],
    sizeStock: { S: 7, M: 10, L: 8, XL: 5 },
    sleeves: ['Short'],
    necks: ['V-neck'],
    customizable: true,
    img: 'linear-gradient(150deg,#39c1aa,#0a604f)',
  },

  // ── Office Wear (customizable: true — semi + full quote flows) ───────────
  {
    id: 'ow-polo', name: 'Executive Polo', collection: 'office', category: 'Polos',
    sub: 'Pique knit · short sleeve', price: 380, was: null, status: 'active', badge: null,
    colors: ['Navy', 'White', 'Black'],
    sizeStock: { XS: 20, S: 25, M: 30, L: 25, XL: 20, '2XL': 10 },
    sleeves: ['Short'], necks: ['V-neck'], materials: ['Pique Knit', 'Moisture-Wicking'], customizable: true,
    img: 'linear-gradient(150deg,#16302a,#0c201d)',
  },
  {
    id: 'ow-shirt', name: 'Staff Formal Shirt', collection: 'office', category: 'Shirts',
    sub: 'Woven · short or long sleeve', price: 420, was: null, status: 'active', badge: null,
    colors: ['White', 'Navy', 'Teal'],
    sizeStock: { XS: 15, S: 20, M: 25, L: 20, XL: 15, '2XL': 8 },
    sleeves: ['Short', 'Long'], necks: ['V-neck'], materials: ['100% Cotton', 'Cotton-Poly Blend', 'Wrinkle-Free'], customizable: true,
    img: 'linear-gradient(150deg,#1d8a77,#02362c)',
  },
  {
    id: 'ow-tee', name: 'Company T-Shirt', collection: 'office', category: 'T-Shirts',
    sub: 'Cotton blend · crew neck', price: 250, was: null, status: 'active', badge: null,
    colors: ['Black', 'White', 'Teal', 'Navy'],
    sizeStock: { XS: 20, S: 25, M: 30, L: 25, XL: 20, '2XL': 10 },
    sleeves: ['Short'], necks: ['Round'], materials: ['100% Cotton', 'Cotton-Poly Blend'], customizable: true,
    img: 'linear-gradient(150deg,#0a604f,#0c201d)',
  },
  {
    id: 'ow-lshirt', name: 'Long Sleeve Shirt', collection: 'office', category: 'Shirts',
    sub: 'Woven · long sleeve', price: 460, was: null, status: 'active', badge: null,
    colors: ['White', 'Navy'],
    sizeStock: { XS: 10, S: 15, M: 20, L: 15, XL: 12, '2XL': 6 },
    sleeves: ['Long'], necks: ['V-neck'], materials: ['100% Cotton', 'Wrinkle-Free', 'Oxford Weave'], customizable: true,
    img: 'linear-gradient(150deg,#02362c,#080808)',
  },

  // ── Accessories (not customizable, fixed stock) ───────────────────────────
  {
    id: 'ac-grip', name: 'Grip Socks', collection: 'accessories', category: 'Socks',
    sub: 'Anti-slip · pair', price: 90, was: null, status: 'active', badge: null,
    colors: ['Teal'],
    sizeStock: { One: 80 },
    sleeves: [], necks: [], customizable: false,
    img: 'linear-gradient(135deg,#1d8a77,#02362c)',
  },
  {
    id: 'ac-team', name: 'Team Socks', collection: 'accessories', category: 'Socks',
    sub: 'Knee-high · pair', price: 80, was: null, status: 'active', badge: null,
    colors: ['Teal'],
    sizeStock: { One: 65 },
    sleeves: [], necks: [], customizable: false,
    img: 'linear-gradient(135deg,#39c1aa,#0a604f)',
  },
  {
    id: 'ac-bib', name: 'Training Bib', collection: 'accessories', category: 'Protection',
    sub: 'Mesh · one size', price: 70, was: null, status: 'active', badge: null,
    colors: ['Teal'],
    sizeStock: { One: 50 },
    sleeves: [], necks: [], customizable: false,
    img: 'linear-gradient(135deg,#03fed4,#0a604f)',
  },
  {
    id: 'ac-shin', name: 'Shin Guards', collection: 'accessories', category: 'Protection',
    sub: 'Lightweight · pair', price: 140, was: null, status: 'active', badge: null,
    colors: ['Black'],
    sizeStock: { S: 10, M: 15, L: 12 },
    sleeves: [], necks: [], customizable: false,
    img: 'linear-gradient(135deg,#16302a,#080808)',
  },
  {
    id: 'ac-arm', name: 'Captain Armband', collection: 'accessories', category: 'Protection',
    sub: 'Adjustable', price: 55, was: null, status: 'active', badge: null,
    colors: ['Coral'],
    sizeStock: { One: 55 },
    sleeves: [], necks: [], customizable: false,
    img: 'linear-gradient(135deg,#ff6a3d,#0c201d)',
  },
  {
    id: 'ac-bag', name: 'Kit Bag', collection: 'accessories', category: 'Bags & Gear',
    sub: 'Holdall · 40L', price: 220, was: null, status: 'active', badge: null,
    colors: ['Black'],
    sizeStock: { One: 22 },
    sleeves: [], necks: [], customizable: false,
    img: 'linear-gradient(135deg,#0a604f,#0c201d)',
  },
  {
    id: 'ac-backpack', name: 'Squad Backpack', collection: 'accessories', category: 'Bags & Gear',
    sub: 'Boot compartment', price: 320, was: null, status: 'active', badge: null,
    colors: ['Black'],
    sizeStock: { One: 16 },
    sleeves: [], necks: [], customizable: false,
    img: 'linear-gradient(135deg,#02362c,#080808)',
  },
  {
    id: 'ac-bottle', name: 'Water Bottle', collection: 'accessories', category: 'Bags & Gear',
    sub: '750ml · squeeze', price: 60, was: null, status: 'active', badge: null,
    colors: ['Teal'],
    sizeStock: { One: 40 },
    sleeves: [], necks: [], customizable: false,
    img: 'linear-gradient(135deg,#1d8a77,#080808)',
  },
];

// ─── run ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log('Deleting all products…');
  const { count: deleted } = await prisma.product.deleteMany({});
  console.log(`  → ${deleted} products deleted`);

  console.log('Removing gym-wear collection (cascades categories)…');
  try {
    await prisma.collection.delete({ where: { id: 'cl-mqsc60clm3t' } });
    console.log('  → gym-wear collection deleted');
  } catch {
    console.log('  → gym-wear collection not found, skipping');
  }

  console.log('Upserting office-wear collection…');
  await prisma.collection.upsert({
    where: { id: 'cl-office' },
    update: { label: 'Office Wear', key: 'office', bespoke: true },
    create: { id: 'cl-office', key: 'office', label: 'Office Wear', bespoke: true },
  });
  for (const cat of [
    { id: 'c-office-shirts',   name: 'Shirts',   collectionKey: 'office' },
    { id: 'c-office-polos',    name: 'Polos',    collectionKey: 'office' },
    { id: 'c-office-tshirts',  name: 'T-Shirts', collectionKey: 'office' },
  ]) {
    await prisma.category.upsert({
      where: { id: cat.id },
      update: { name: cat.name, collectionKey: cat.collectionKey },
      create: cat,
    });
  }
  console.log('  → office collection + 3 categories ready');

  console.log('Restoring casual-wear category names…');
  await prisma.category.updateMany({ where: { id: 'c-tees'   }, data: { name: 'T-Shirts' } });
  await prisma.category.updateMany({ where: { id: 'c-hoodies' }, data: { name: 'Hoodies'  } });
  await prisma.category.updateMany({ where: { id: 'c-polos'   }, data: { name: 'Polos'    } });
  console.log('  → T-Shirts, Hoodies, Polos restored');

  console.log('Inserting fresh products…');
  let inserted = 0;
  for (const p of PRODUCTS) {
    const { sizes, stock } = derived(p.sizeStock);
    await prisma.product.create({
      data: {
        id:           p.id,
        name:         p.name,
        collection:   p.collection,
        category:     p.category,
        sub:          p.sub,
        price:        p.price,
        was:          p.was,
        stock,
        status:       p.status,
        badge:        p.badge,
        colors:       p.colors,
        sizes,
        sizeStock:    p.sizeStock,
        sleeves:      p.sleeves,
        necks:        p.necks,
        materials:    p.materials ?? [],
        customizable: p.customizable,
        img:          p.img,
      },
    });
    console.log(`  ✓ ${p.name} (stock:${stock}, sizes:[${sizes.join(',')}], customizable:${p.customizable})`);
    inserted++;
  }

  console.log(`\nDone — ${inserted} products inserted.`);
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
