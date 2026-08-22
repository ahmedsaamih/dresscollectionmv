import type { PromoCode } from '@prisma/client';
import type { PromoCode as PromoCodeDTO } from '@/lib/types';
import { formatMVR } from '@/lib/utils';

/** Map a Prisma promo row to the front-end DTO (dates → ISO strings). */
export function mapPromo(p: PromoCode): PromoCodeDTO {
  return {
    id: p.id,
    code: p.code,
    description: p.description,
    discountType: p.discountType,
    discountValue: p.discountValue,
    scope: p.scope,
    scopeValue: p.scopeValue,
    minSubtotal: p.minSubtotal,
    maxRedemptions: p.maxRedemptions,
    expiresAt: p.expiresAt ? p.expiresAt.toISOString() : null,
    active: p.active,
    referrer: p.referrer,
    commissionType: p.commissionType,
    commissionValue: p.commissionValue,
    timesUsed: p.timesUsed,
  };
}

/**
 * Promo / referral code evaluation — shared by the public preview endpoint and
 * the checkout write path so the discount is computed identically (and only
 * ever server-side; the client is never trusted with the amount).
 */

export interface PromoCartItem {
  sku: string;
  qty: number;
}

export interface PromoProductInfo {
  price: number;
  collection: string;
  category: string;
}

export interface PromoResult {
  ok: boolean;
  reason?: string;
  subtotal: number; // full product subtotal
  eligible: number; // subtotal the code applies to (by scope)
  discount: number; // MVR taken off the customer's total
}

/** Validate a code against a cart and compute the discount. Pure + deterministic. */
export function evaluatePromo(
  code: PromoCode,
  items: PromoCartItem[],
  productsById: ReadonlyMap<string, PromoProductInfo>,
  now: Date = new Date()
): PromoResult {
  let subtotal = 0;
  let eligible = 0;
  for (const i of items) {
    const p = productsById.get(i.sku);
    if (!p) continue;
    const line = p.price * i.qty;
    subtotal += line;
    const inScope =
      code.scope === 'all' ||
      (code.scope === 'collection' && p.collection === code.scopeValue) ||
      (code.scope === 'category' && p.category === code.scopeValue);
    if (inScope) eligible += line;
  }

  const fail = (reason: string): PromoResult => ({ ok: false, reason, subtotal, eligible, discount: 0 });

  if (!code.active) return fail('This code is not active.');
  if (code.expiresAt && code.expiresAt.getTime() < now.getTime()) return fail('This code has expired.');
  if (code.maxRedemptions != null && code.timesUsed >= code.maxRedemptions) return fail('This code has reached its usage limit.');
  if (subtotal < code.minSubtotal) return fail(`Spend at least ${formatMVR(code.minSubtotal)} to use this code.`);
  if (eligible <= 0) return fail('This code does not apply to the items in your cart.');

  let discount =
    code.discountType === 'percent'
      ? Math.round((eligible * code.discountValue) / 100)
      : Math.min(code.discountValue, eligible);
  discount = Math.min(discount, subtotal); // never exceed the product subtotal

  if (discount <= 0) return fail('This code gives no discount on your cart.');
  return { ok: true, subtotal, eligible, discount };
}

/** Referrer compensation for one redemption (snapshotted at checkout time). */
export function computeCommission(code: PromoCode, subtotal: number, discount: number): number {
  switch (code.commissionType) {
    case 'percent_of_order':
      return Math.round((subtotal * code.commissionValue) / 100);
    case 'percent_of_discount':
      return Math.round((discount * code.commissionValue) / 100);
    case 'fixed':
      return code.commissionValue;
    default:
      return 0;
  }
}
