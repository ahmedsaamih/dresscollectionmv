import type { Prisma } from '@prisma/client';
import { prisma } from './prisma';

type Db = Prisma.TransactionClient | typeof prisma;

/**
 * Recompute and persist Quote.computedPrice — the sum of all line items'
 * (unitPrice × units + customizationCost). Always server-derived, never
 * manually edited; the admin-facing Quote.price defaults from this but can
 * still be overridden for negotiation.
 */
export async function recomputeQuoteComputedPrice(db: Db, quoteId: string): Promise<number> {
  const items = await db.quoteItem.findMany({
    where: { quoteId },
    select: { unitPrice: true, units: true, customizationCost: true },
  });
  const computedPrice = items.reduce((s, i) => s + i.unitPrice * i.units + i.customizationCost, 0);
  await db.quote.update({ where: { id: quoteId }, data: { computedPrice } });
  return computedPrice;
}
