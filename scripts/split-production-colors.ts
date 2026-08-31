// One-time data migration: split every multi-color Product into one Product
// per color, same idea as the `splitByColor` step in prisma/seed.ts, but
// against real data instead of rewriting seed fixtures. Every resulting
// product shares the same display name (colour is conveyed by the swatch,
// not the name). A color's own Inventory rows (every location),
// StockTransfer/StockAdjustment history, and InventoryPlacement all move to
// (or get copied onto) the new product; Orders/OrderItems are untouched
// since they only snapshot color/sku as plain strings, never an FK to
// Product.
//
// This is a plain script, NOT a prisma/migrations entry — it never runs via
// `prisma migrate deploy`, so it only ever runs when someone invokes it by
// hand. Point DATABASE_URL at whichever database you mean to change.
//
// Usage:
//   DATABASE_URL="<target-db-url>" npx tsx scripts/split-production-colors.ts --dry-run
//   DATABASE_URL="<target-db-url>" npx tsx scripts/split-production-colors.ts
//
// Safe to re-run: a product already down to one color, or a new id that
// already exists, is skipped rather than overwritten.

import { PrismaClient, Prisma } from '@prisma/client';

const prisma = new PrismaClient();
const DRY_RUN = process.argv.includes('--dry-run');

function colorSlug(color: string): string {
  return color.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

function computeStock(rows: { size: string; qty: number }[]) {
  const sizeStock: Record<string, number> = {};
  for (const r of rows) {
    if (r.size !== '') sizeStock[r.size] = (sizeStock[r.size] ?? 0) + r.qty;
  }
  const stock = Object.values(sizeStock).reduce((a, b) => a + b, 0)
    || rows.filter(r => r.size === '').reduce((a, r) => a + r.qty, 0);
  return { sizeStock, stock };
}

async function main() {
  console.log(`Connected to: ${process.env.DATABASE_URL?.replace(/:[^:@]+@/, ':****@')}`);
  console.log(DRY_RUN ? 'Mode: DRY RUN (no writes)\n' : 'Mode: LIVE (will write)\n');

  const products = await prisma.product.findMany({
    include: { inventory: true, placements: true },
    orderBy: { id: 'asc' },
  });
  const multiColor = products.filter(p => p.colors.length > 1);

  console.log(`${products.length} products total, ${multiColor.length} with more than one color.\n`);
  if (multiColor.length === 0) {
    console.log('Nothing to split.');
    return;
  }

  let created = 0;
  let skipped = 0;

  for (const p of multiColor) {
    const [primary, ...extra] = p.colors;
    const colorImages = (p.colorImages as Record<string, string>) ?? {};
    const colorHex = (p.colorHex as Record<string, string>) ?? {};
    console.log(`${p.id} "${p.name}" — colors: [${p.colors.join(', ')}]`);

    for (const color of extra) {
      const newId = `${p.id}-${colorSlug(color)}`;
      const exists = await prisma.product.findUnique({ where: { id: newId }, select: { id: true } });
      if (exists) {
        console.warn(`  SKIP "${color}": ${newId} already exists`);
        skipped++;
        continue;
      }

      const colorRows = p.inventory.filter(i => i.color === color);
      const { sizeStock, stock } = computeStock(colorRows);
      const newImg = colorImages[color] || p.img;

      console.log(`  -> create ${newId} "${p.name}" (${color}) stock=${stock} (${colorRows.length} inventory rows moving)`);

      if (!DRY_RUN) {
        await prisma.$transaction(async (tx) => {
          await tx.product.create({
            data: {
              id: newId,
              name: p.name,
              collection: p.collection,
              category: p.category,
              sub: p.sub,
              price: p.price,
              was: p.was,
              discountType: p.discountType,
              discountValue: p.discountValue,
              costPrice: p.costPrice,
              status: p.status,
              badge: p.badge,
              colors: [color],
              sizeStock,
              stock,
              descriptionSections: p.descriptionSections as Prisma.InputJsonValue,
              showInWebStore: p.showInWebStore,
              img: newImg,
              colorImages: colorImages[color] ? { [color]: colorImages[color] } : {},
              colorHex: colorHex[color] ? { [color]: colorHex[color] } : {},
              preOrder: p.preOrder,
            },
          });

          await tx.inventory.updateMany({ where: { productId: p.id, color }, data: { productId: newId } });
          await tx.stockTransfer.updateMany({ where: { productId: p.id, color }, data: { productId: newId } });
          await tx.stockAdjustment.updateMany({ where: { productId: p.id, color }, data: { productId: newId } });

          for (const placement of p.placements) {
            await tx.inventoryPlacement.upsert({
              where: { locationId_productId: { locationId: placement.locationId, productId: newId } },
              update: {},
              create: {
                locationId: placement.locationId,
                productId: newId,
                physicalLocation: placement.physicalLocation,
              },
            });
          }
        });
      }
      created++;
    }

    // Narrow the original product down to just its primary color.
    const primaryRows = p.inventory.filter(i => i.color === primary);
    const { sizeStock, stock } = computeStock(primaryRows);
    console.log(`  (kept) ${p.id} narrowed to "${primary}", stock=${stock}\n`);

    if (!DRY_RUN) {
      await prisma.product.update({
        where: { id: p.id },
        data: {
          colors: [primary],
          sizeStock,
          stock,
          img: colorImages[primary] || p.img,
          colorImages: colorImages[primary] ? { [primary]: colorImages[primary] } : {},
          colorHex: colorHex[primary] ? { [primary]: colorHex[primary] } : {},
        },
      });
    }
  }

  console.log(`${DRY_RUN ? 'Would create' : 'Created'} ${created} new product(s), skipped ${skipped}.`);
  console.log(DRY_RUN ? '\nDry run complete — no changes written. Re-run without --dry-run to apply.' : '\nDone.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
