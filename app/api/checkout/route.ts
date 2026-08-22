import { prisma } from '@/lib/prisma';
import { nextRef } from '@/lib/ref';
import { checkoutSchema } from '@/lib/validation';
import { ok, fail, handleError, displayDate } from '@/lib/http';
import { notifier } from '@/lib/notify';
import { canSendSms } from '@/lib/notify/sms-guard';
import { storage } from '@/lib/storage';
import { orderConfirmationPdf } from '@/lib/pdf';
import { evaluatePromo, computeCommission } from '@/lib/promo';
import { upsertCustomerFromContact } from '@/lib/customers';
import { rateLimitResponse } from '@/lib/rate-limit';
import { decrementStock, InsufficientStockError } from '@/lib/inventory';

/**
 * POST /api/checkout
 *
 * Creates a fixed-price order from the cart's `fixed` items. No payment is
 * taken — records the order and returns a reference + bank instructions.
 * Prices and stock are re-validated server-side; the client is never trusted.
 */
export async function POST(request: Request) {
  try {
    const ipLimit = await rateLimitResponse(request, { scope: 'checkout:ip', limit: 10, windowMs: 60 * 60 * 1000 });
    if (ipLimit) return ipLimit;

    const body = await request.json();
    const data = checkoutSchema.parse(body);
    const contactLimit = await rateLimitResponse(request, {
      scope: 'checkout:contact',
      limit: 10,
      windowMs: 60 * 60 * 1000,
      identifiers: [data.email.toLowerCase(), data.mobile],
    });
    if (contactLimit) return contactLimit;

    const settings = await prisma.setting.findUnique({ where: { id: 'singleton' } });
    if (!settings) return fail('Store is not configured', 500);

    let deliveryArea: { id: string; name: string; rate: number; active: boolean } | null = null;
    if (data.method === 'delivery') {
      deliveryArea = await prisma.deliveryArea.findUnique({ where: { id: data.deliveryAreaId! } });
      if (!deliveryArea || !deliveryArea.active) return fail('Delivery area not found', 404);
    }

    // Re-price + stock-check against the DB.
    const skus = [...new Set(data.items.map((i) => i.sku))];
    const products = await prisma.product.findMany({ where: { id: { in: skus } } });
    const byId = new Map(products.map((p) => [p.id, p]));

    // Find the web-default location for stock decrement
    const webLoc = await prisma.location.findFirst({ where: { isWebDefault: true } });

    // Fast-fail UX only — NOT the source of truth. The real guard is decrementStock()
    // inside the transaction below, which re-checks atomically at write time.
    if (webLoc) {
      for (const item of data.items) {
        const p = byId.get(item.sku);
        if (!p || (p.customizable && p.collection !== 'casual')) continue;
        const inv = await prisma.inventory.findUnique({
          where: { locationId_productId_size_color: { locationId: webLoc.id, productId: p.id, size: item.size, color: item.color } },
        });
        if (!inv || inv.qty < item.qty) {
          const variant = [item.size, item.color].filter(Boolean).join(' / ');
          return fail(`${variant ? variant + ' of ' : ''}${p.name} is sold out`, 409);
        }
      }
    }

    let subtotal = 0;
    const lineItems: { sku: string; name: string; meta: string; price: number; img: string; size: string; color: string; sleeve: string; neck: string; qty: number; stockDecremented: boolean }[] = [];
    for (const item of data.items) {
      const p = byId.get(item.sku);
      if (!p) return fail(`Product not found: ${item.sku}`, 400);
      if (p.status !== 'active') return fail(`${p.name} is not available`, 409);
      const sleeveAdj = ((p.sleeveAdjustments as Record<string, number>) ?? {})[item.sleeve ?? ''] ?? 0;
      const sizeAdj   = ((p.sizeAdjustments   as Record<string, number>) ?? {})[item.size   ?? ''] ?? 0;
      const unitPrice = p.price + sleeveAdj + sizeAdj;
      subtotal += unitPrice * item.qty;
      // Customizable products are made-to-order (no stock item) except in the
      // 'casual' collection (blank stock garments printed on demand).
      const stockDecremented = !p.customizable || p.collection === 'casual';
      lineItems.push({
        sku: p.id,
        name: p.name,
        meta: item.meta || p.sub,
        price: unitPrice, // server price wins (base + adjustments)
        img: p.img,
        size: item.size,
        color: item.color,
        sleeve: item.sleeve ?? '',
        neck: item.neck ?? '',
        qty: item.qty,
        stockDecremented,
      });
    }

    const deliveryFee = data.method === 'delivery' ? deliveryArea!.rate : 0;

    // Promo / referral code — re-validated and priced server-side. If the
    // customer applied a code (and saw a discounted total), a code that has
    // since become invalid fails the checkout rather than silently dropping.
    let discount = 0;
    let appliedCode: string | null = null;
    let eligible = 0;
    let commission = 0;
    let promoId: string | null = null;
    let promoReferrer: string | null = null;
    if (data.promoCode && data.promoCode.trim()) {
      const promo = await prisma.promoCode.findUnique({ where: { code: data.promoCode.trim().toUpperCase() } });
      if (!promo) return fail('That promo code was not found.', 400);
      const result = evaluatePromo(promo, data.items.map((i) => ({ sku: i.sku, qty: i.qty })), byId);
      if (!result.ok) return fail(result.reason || 'This promo code is not valid.', 400);
      discount = result.discount;
      eligible = result.eligible;
      commission = computeCommission(promo, result.subtotal, discount);
      appliedCode = promo.code;
      promoId = promo.id;
      promoReferrer = promo.referrer;
    }

    const total = subtotal + deliveryFee - discount;
    const summary = lineItems.map((i) => `${i.name} ×${i.qty}`).join(', ');

    // Atomic: ref + order + line items + stock decrement + promo redemption.
    const order = await prisma.$transaction(async (tx) => {
      const ref = await nextRef('DC', tx);
      const created = await tx.order.create({
        data: {
          id: ref,
          customer: data.name,
          email: data.email,
          mobile: data.mobile,
          items: summary,
          subtotal,
          deliveryFee,
          deliveryAreaId: deliveryArea?.id ?? null,
          discountCode: appliedCode,
          discount,
          total,
          method: data.method === 'delivery' ? 'Delivery' : 'Pickup',
          stage: 0,
          paid: false,
          source: 'web',
          origin: 'web_checkout',
          locationId: webLoc?.id ?? null,
          address: data.address ?? null,
          notes: data.notes ?? null,
          date: displayDate(),
          lineItems: { create: lineItems },
        },
      });
      if (webLoc) {
        for (const i of lineItems) {
          if (i.stockDecremented) {
            await decrementStock(tx, { locationId: webLoc.id, productId: i.sku, size: i.size, color: i.color, qty: i.qty });
          }
        }
      }
      if (promoId) {
        await tx.redemption.create({
          data: { codeId: promoId, code: appliedCode!, orderId: ref, subtotal, eligible, discount, referrer: promoReferrer, commission },
        });
        await tx.promoCode.update({ where: { id: promoId }, data: { timesUsed: { increment: 1 } } });
      }
      return created;
    });

    await upsertCustomerFromContact({ name: data.name, phone: data.mobile, email: data.email });

    // Confirmation PDF (best-effort — never blocks the order).
    let pdfUrl: string | null = null;
    try {
      const bankAccounts = (settings.bankAccounts as { name: string; accountNumber: string }[] | null) ?? [];
      const pdf = await orderConfirmationPdf({
        ref: order.id, customer: order.customer, email: order.email, mobile: order.mobile ?? null,
        date: order.date, method: order.method, address: order.address ?? null, notes: order.notes ?? null,
        subtotal, discount, total,
        deliveryFee,
        items: lineItems,
        storeName: settings.storeName, storeAddress: settings.address,
        storePhone: settings.phone, storeEmail: settings.email,
        taxId: settings.taxId, bankAccounts,
        taxRate: settings.taxRate, taxLabel: settings.taxLabel,
        termsConditions: settings.termsConditions,
      });
      const stored = await storage.put({ bucket: 'pdf', filename: `${order.id}.pdf`, data: pdf, contentType: 'application/pdf' });
      pdfUrl = stored.url;
      await prisma.order.update({ where: { id: order.id }, data: { pdfUrl } });
    } catch (e) {
      console.error('order PDF generation failed', e);
    }

    const placedSmsAllowed = await canSendSms(request, order.mobile);
    await notifier.orderPlaced({
      ref: order.id, email: order.email, name: order.customer, total,
      mobile: order.mobile ?? null, smsAllowed: placedSmsAllowed,
    });
    await notifier.adminOrderAlert({ ref: order.id, customer: order.customer, total, itemCount: data.items.length });

    return ok({
      ref: order.id,
      subtotal,
      deliveryFee,
      discount,
      discountCode: appliedCode,
      total,
      method: order.method,
      bank: settings.bank,
      pdfUrl,
    });
  } catch (err) {
    if (err instanceof InsufficientStockError) {
      // Race lost between the pre-check and the transaction (someone else bought the last unit).
      const variant = [err.size, err.color].filter(Boolean).join(' / ');
      return fail(`${variant ? variant + ' of ' : ''}${err.productId} is sold out`, 409);
    }
    return handleError(err);
  }
}
