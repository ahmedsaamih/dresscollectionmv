import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { evaluatePromo, type PromoProductInfo } from '@/lib/promo';
import { ok, handleError } from '@/lib/http';
import { rateLimitResponse } from '@/lib/rate-limit';
import { computeEffectivePrice } from '@/lib/utils';

export const dynamic = 'force-dynamic';

const schema = z.object({
  code: z.string().trim().min(1).max(40),
  items: z.array(z.object({ sku: z.string().trim().min(1).max(120), qty: z.number().int().positive().max(100) })).min(1).max(50),
});

/**
 * POST /api/promo/validate
 * Checkout-time preview of a promo/referral code. Computes the discount exactly
 * as the checkout write path will (shared lib/promo). Never records anything.
 */
export async function POST(request: Request) {
  try {
    const ipLimit = await rateLimitResponse(request, { scope: 'promo-validate:ip', limit: 10, windowMs: 60 * 60 * 1000 });
    if (ipLimit) return ipLimit;

    const { code, items } = schema.parse(await request.json());

    const promo = await prisma.promoCode.findUnique({ where: { code: code.toUpperCase() } });
    if (!promo) return ok({ valid: false, error: 'That code was not found.' });

    const skus = [...new Set(items.map((i) => i.sku))];
    const products = await prisma.product.findMany({ where: { id: { in: skus } }, select: { id: true, price: true, discountType: true, discountValue: true, collection: true, category: true } });
    // Preview must match checkout's math exactly — promo discount runs against each
    // product's effective (already product-discounted) price, not the raw price.
    const byId = new Map<string, PromoProductInfo>(products.map((p) => [p.id, {
      price: computeEffectivePrice(p.price, p.discountType, p.discountValue),
      collection: p.collection, category: p.category,
    }]));

    const result = evaluatePromo(promo, items, byId);
    if (!result.ok) return ok({ valid: false, error: result.reason });

    return ok({
      valid: true,
      code: promo.code,
      description: promo.description,
      discountType: promo.discountType,
      discountValue: promo.discountValue,
      discount: result.discount,
      eligible: result.eligible,
      subtotal: result.subtotal,
    });
  } catch (err) {
    return handleError(err);
  }
}
