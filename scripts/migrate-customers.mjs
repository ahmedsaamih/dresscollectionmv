/**
 * One-time data migration: backfill the Customer table from existing
 * Order and Quote rows, deduped by phone number.
 *
 * Tie-break when the same phone appears on multiple rows: earliest row's
 * createdAt becomes the Customer's "customer since" date; latest row's
 * name/email win (most-recent-wins).
 *
 * Run ONCE after the add_customer_table migration:
 *   node scripts/migrate-customers.mjs
 *
 * Idempotent — safe to re-run (upserts on phone).
 */
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

function genId() {
  return `cust-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;
}

async function main() {
  console.log('Loading orders and quotes…');

  const orders = await prisma.order.findMany({
    select: { customer: true, email: true, mobile: true, createdAt: true },
  });
  const quotes = await prisma.quote.findMany({
    select: { customer: true, email: true, mobile: true, createdAt: true },
  });

  const rows = [...orders, ...quotes]
    .map((r) => ({ name: r.customer, email: r.email, mobile: r.mobile, createdAt: r.createdAt }))
    .filter((r) => r.mobile && r.mobile.trim());

  console.log(`  ${orders.length} orders + ${quotes.length} quotes scanned, ${rows.length} with a phone number`);

  const groups = new Map();
  for (const r of rows) {
    const phone = r.mobile.trim();
    if (!groups.has(phone)) groups.set(phone, []);
    groups.get(phone).push(r);
  }

  console.log(`  ${groups.size} unique phone numbers found`);
  console.log('Upserting Customer rows…');

  let created = 0;
  let skipped = 0;

  for (const [phone, group] of groups) {
    group.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
    const earliest = group[0];
    const latest = group[group.length - 1];

    try {
      await prisma.customer.upsert({
        where: { phone },
        update: {},
        create: {
          id: genId(),
          name: latest.name.trim() || 'Unknown',
          phone,
          email: latest.email?.trim() || null,
          createdAt: earliest.createdAt,
        },
      });
      created++;
    } catch (e) {
      console.error(`  ⚠ failed for ${phone}:`, e.message);
      skipped++;
    }
  }

  console.log(`  ✓ Created/updated ${created} customers (${skipped} skipped)`);
  console.log('Done.');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
