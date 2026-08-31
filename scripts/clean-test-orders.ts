// One-time cleanup: wipe all pre-launch test orders and everything derived
// from them (customers, line items, receipts/OCR data, redemptions,
// order-linked notification/audit history), while leaving the catalog
// (Product prices/costPrice/stock), PromoCode definitions, and all other
// admin/config data untouched.
//
// Deliberately NOT a prisma/migrations entry — never runs via
// `prisma migrate deploy`, only when invoked by hand.
//
// Usage:
//   DATABASE_URL="<target-db-url>" npx tsx scripts/clean-test-orders.ts --dry-run
//   DATABASE_URL="<target-db-url>" npx tsx scripts/clean-test-orders.ts
//
// Scope (confirmed with the user):
//   - Deletes every current Order (and cascades: OrderItem, Receipt,
//     ReceiptOcrData, Redemption) and every current Customer.
//   - Deletes NotificationLog rows whose orderRef points at a deleted order.
//   - Deletes AuditLog rows for actions 'order.update' / 'order.receipt.generate'
//     whose target is a deleted order id — all other AuditLog history
//     (settings, product, promo, location, deliveryArea, etc.) is kept.
//   - Recomputes PromoCode.timesUsed from remaining Redemption rows (so a
//     code whose only redemptions were test orders drops back to 0) —
//     PromoCode rows themselves are never deleted.
//   - Does NOT touch Product, Inventory, Collection, Category, SizeChart,
//     Location, DeliveryArea, Setting, AdminUser, RateLimitBucket, or any
//     other table.

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const DRY_RUN = process.argv.includes('--dry-run');
const ORDER_AUDIT_ACTIONS = ['order.update', 'order.receipt.generate'];

async function main() {
  console.log(`Connected to: ${process.env.DATABASE_URL?.replace(/:[^:@]+@/, ':****@')}`);
  console.log(DRY_RUN ? 'Mode: DRY RUN (no writes)\n' : 'Mode: LIVE (will write)\n');

  const orders = await prisma.order.findMany({ select: { id: true }, orderBy: { createdAt: 'asc' } });
  const orderIds = orders.map(o => o.id);
  const customers = await prisma.customer.findMany({ select: { id: true, phone: true } });

  const [orderItemCount, receiptCount, ocrCount, redemptionCount, reviewCount] = await Promise.all([
    prisma.orderItem.count({ where: { orderId: { in: orderIds } } }),
    prisma.receipt.count({ where: { orderId: { in: orderIds } } }),
    prisma.receiptOcrData.count({ where: { receipt: { orderId: { in: orderIds } } } }),
    prisma.redemption.count({ where: { orderId: { in: orderIds } } }),
    prisma.review.count({ where: { orderId: { in: orderIds } } }),
  ]);
  const notificationLogCount = await prisma.notificationLog.count({ where: { orderRef: { in: orderIds } } });
  const auditLogCount = await prisma.auditLog.count({
    where: { action: { in: ORDER_AUDIT_ACTIONS }, target: { in: orderIds } },
  });

  console.log(`Orders to delete: ${orderIds.length} (${orderIds.join(', ') || 'none'})`);
  console.log(`  -> cascades: ${orderItemCount} OrderItem, ${receiptCount} Receipt, ${ocrCount} ReceiptOcrData, ${redemptionCount} Redemption, ${reviewCount} Review`);
  console.log(`Customers to delete: ${customers.length} (${customers.map(c => c.phone).join(', ') || 'none'})`);
  console.log(`NotificationLog rows to delete (orderRef matches a deleted order): ${notificationLogCount}`);
  console.log(`AuditLog rows to delete (order.update/order.receipt.generate targeting a deleted order): ${auditLogCount}`);

  if (orderIds.length === 0 && customers.length === 0) {
    console.log('\nNothing to clean.');
    return;
  }

  if (DRY_RUN) {
    console.log('\nDry run complete — no changes written. Re-run without --dry-run to apply.');
    return;
  }

  await prisma.$transaction(async (tx) => {
    // Review has ON DELETE RESTRICT against Order, so it must go first.
    await tx.review.deleteMany({ where: { orderId: { in: orderIds } } });
    await tx.notificationLog.deleteMany({ where: { orderRef: { in: orderIds } } });
    await tx.auditLog.deleteMany({ where: { action: { in: ORDER_AUDIT_ACTIONS }, target: { in: orderIds } } });
    // Order cascades to OrderItem, Receipt -> ReceiptOcrData, Redemption.
    await tx.order.deleteMany({ where: { id: { in: orderIds } } });
    await tx.customer.deleteMany({ where: { id: { in: customers.map(c => c.id) } } });

    const codes = await tx.promoCode.findMany({ select: { id: true } });
    for (const c of codes) {
      const used = await tx.redemption.count({ where: { codeId: c.id } });
      await tx.promoCode.update({ where: { id: c.id }, data: { timesUsed: used } });
    }
  });

  console.log('\nDone.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
