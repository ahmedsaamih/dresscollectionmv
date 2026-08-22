/**
 * One-time data migration: backfill AdminUser.permissions from the legacy
 * role (manager/pos_user/quotation_approver) and flip role to 'staff'.
 * Must run BEFORE the AdminRole enum is shrunk to admin|staff, since it
 * still needs to read the legacy role values.
 *
 * Run ONCE after the add_admin_user_permissions migration:
 *   node scripts/migrate-admin-permissions.mjs
 */
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

// Mirrors lib/permissions.ts LEGACY_ROLE_PERMISSIONS — kept in sync manually
// since this script runs once and is plain Node ESM (no TS import).
const LEGACY_ROLE_PERMISSIONS = {
  manager: {
    dashboard: 'edit', products: 'edit', categories: 'edit', builder: 'edit', customization: 'edit',
    orders: 'edit', quotes: 'edit', promos: 'edit', sizechart: 'edit', customers: 'edit',
    posSales: 'edit', posOrders: 'edit', posDeliveries: 'edit', posReturns: 'edit', posInventory: 'edit', posTransfers: 'edit',
  },
  pos_user: {
    dashboard: 'edit', quotes: 'edit', customers: 'edit',
    orders: 'read', posInventory: 'read',
    posSales: 'edit', posOrders: 'edit', posDeliveries: 'edit', posReturns: 'edit', posTransfers: 'edit',
  },
  quotation_approver: {
    dashboard: 'edit', products: 'edit', categories: 'edit', builder: 'edit', customization: 'edit',
    orders: 'edit', quotes: 'edit', promos: 'edit', sizechart: 'edit', customers: 'edit',
    posSales: 'edit', posOrders: 'edit', posDeliveries: 'edit', posReturns: 'edit', posInventory: 'edit', posTransfers: 'edit',
    quoteApprovals: 'edit', settingsGeneral: 'edit',
  },
};

async function main() {
  const users = await prisma.adminUser.findMany({ select: { id: true, email: true, role: true } });
  let converted = 0;
  let skipped = 0;

  for (const u of users) {
    const legacyPerms = LEGACY_ROLE_PERMISSIONS[u.role];
    if (!legacyPerms) { skipped++; continue; } // already 'admin' or 'staff'
    await prisma.adminUser.update({
      where: { id: u.id },
      data: { role: 'staff', permissions: legacyPerms },
    });
    console.log(`  ✓ ${u.email}: ${u.role} → staff`);
    converted++;
  }

  console.log(`Done. Converted ${converted} user(s), skipped ${skipped} (already admin/staff).`);
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
