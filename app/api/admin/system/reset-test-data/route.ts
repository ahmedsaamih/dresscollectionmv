import { prisma } from '@/lib/prisma';
import { requireSuperAdmin, audit } from '@/lib/admin-guard';
import { ok, fail, handleError } from '@/lib/http';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

const CONFIRM_PHRASE = 'DELETE ALL TEST DATA';

const resetSchema = z.object({
  confirm: z.literal(CONFIRM_PHRASE),
});

/**
 * POST /api/admin/system/reset-test-data — super-admin-only, irreversible.
 * Wipes transactional/demo data (products, orders, customers, reviews,
 * inventory) while preserving structural configuration (collections,
 * categories, locations, delivery areas, size charts, settings, admin
 * accounts, promo codes). Intended for a one-time cleanup before real
 * production data is entered. No UI entry point — API-only.
 */
export async function POST(request: Request) {
  try {
    const session = await requireSuperAdmin();
    const parsed = resetSchema.safeParse(await request.json());
    if (!parsed.success) {
      return fail(`Confirmation required: send { "confirm": "${CONFIRM_PHRASE}" }`, 400);
    }

    const [review, stockTransfer, stockAdjustment, inventoryPlacement, inventory, order, product, customer] =
      await prisma.$transaction([
        prisma.review.deleteMany({}),
        prisma.stockTransfer.deleteMany({}),
        prisma.stockAdjustment.deleteMany({}),
        prisma.inventoryPlacement.deleteMany({}),
        prisma.inventory.deleteMany({}),
        prisma.order.deleteMany({}),
        prisma.product.deleteMany({}),
        prisma.customer.deleteMany({}),
      ]);

    const countsDeleted = {
      review: review.count,
      stockTransfer: stockTransfer.count,
      stockAdjustment: stockAdjustment.count,
      inventoryPlacement: inventoryPlacement.count,
      inventory: inventory.count,
      order: order.count,
      product: product.count,
      customer: customer.count,
    };

    await audit(session.email, 'system.reset_test_data', 'all', countsDeleted);
    return ok({ countsDeleted });
  } catch (err) {
    return handleError(err);
  }
}
