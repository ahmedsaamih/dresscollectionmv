import { prisma } from '@/lib/prisma';
import { requirePermission } from '@/lib/admin-guard';
import { ok, handleError } from '@/lib/http';
import type { Redemption } from '@/lib/types';

export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/redemptions
 * The promo redemption ledger — every applied code with the discount given and
 * the referrer compensation owed (snapshotted at checkout). Also returns a
 * per-referrer summary used to calculate what each referrer is owed.
 */
export async function GET() {
  try {
    await requirePermission('promos', 'read');
    const rows = await prisma.redemption.findMany({ orderBy: { createdAt: 'desc' } });

    const redemptions: Redemption[] = rows.map((r) => ({
      id: r.id,
      code: r.code,
      orderId: r.orderId,
      subtotal: r.subtotal,
      eligible: r.eligible,
      discount: r.discount,
      referrer: r.referrer,
      commission: r.commission,
      date: r.createdAt.toISOString(),
    }));

    // Per-referrer compensation summary.
    const byReferrer = new Map<string, { referrer: string; redemptions: number; sales: number; discount: number; commission: number }>();
    for (const r of rows) {
      if (!r.referrer) continue;
      const cur = byReferrer.get(r.referrer) ?? { referrer: r.referrer, redemptions: 0, sales: 0, discount: 0, commission: 0 };
      cur.redemptions += 1;
      cur.sales += r.subtotal;
      cur.discount += r.discount;
      cur.commission += r.commission;
      byReferrer.set(r.referrer, cur);
    }
    const referrers = [...byReferrer.values()].sort((a, b) => b.commission - a.commission);

    return ok({ redemptions, referrers, total: redemptions.length });
  } catch (err) {
    return handleError(err);
  }
}
