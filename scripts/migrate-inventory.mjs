/**
 * One-time data migration: seed default Locations and populate Inventory table
 * from existing Product.sizeStock / Product.stock values.
 *
 * Run ONCE after the add_inventory_locations_pos migration:
 *   node scripts/migrate-inventory.mjs
 */
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  console.log('Seeding default locations…');

  // Upsert so this is idempotent
  const onlineStore = await prisma.location.upsert({
    where: { id: 'loc-online' },
    update: {},
    create: { id: 'loc-online', name: 'Online Store', showOnWeb: true, isWebDefault: true, sortOrder: 0 },
  });
  const warehouse = await prisma.location.upsert({
    where: { id: 'loc-warehouse' },
    update: {},
    create: { id: 'loc-warehouse', name: 'Warehouse', showOnWeb: false, isWebDefault: false, sortOrder: 1 },
  });

  console.log(`  ✓ ${onlineStore.name}, ${warehouse.name}`);
  console.log('Migrating product stock to Inventory rows…');

  const products = await prisma.product.findMany({
    select: { id: true, name: true, stock: true, sizeStock: true, sizes: true },
  });

  let created = 0;
  let skipped = 0;

  for (const p of products) {
    const sizeStock = (p.sizeStock && typeof p.sizeStock === 'object' && !Array.isArray(p.sizeStock))
      ? p.sizeStock
      : {};

    const entries = Object.entries(sizeStock);

    if (entries.length > 0) {
      // Per-size inventory
      for (const [size, qty] of entries) {
        const q = parseInt(String(qty), 10) || 0;
        try {
          await prisma.inventory.upsert({
            where: { locationId_productId_size: { locationId: onlineStore.id, productId: p.id, size } },
            update: {},
            create: { locationId: onlineStore.id, productId: p.id, size, qty: q },
          });
          created++;
        } catch {
          skipped++;
        }
      }
    } else if (p.stock > 0) {
      // No sizeStock — use aggregate stock with empty size key
      try {
        await prisma.inventory.upsert({
          where: { locationId_productId_size: { locationId: onlineStore.id, productId: p.id, size: '' } },
          update: {},
          create: { locationId: onlineStore.id, productId: p.id, size: '', qty: p.stock },
        });
        created++;
      } catch {
        skipped++;
      }
    } else {
      console.log(`  ⚠ ${p.name}: no stock, skipping`);
    }
  }

  console.log(`  ✓ Created ${created} inventory rows (${skipped} skipped/existing)`);
  console.log('Done.');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
