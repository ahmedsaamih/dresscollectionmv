import { after } from 'next/server';
import { prisma } from '@/lib/prisma';
import { createOrderWithRef } from '@/lib/ref';
import { checkoutSchema } from '@/lib/validation';
import { ok, fail, handleError, displayDate } from '@/lib/http';
import { notifier } from '@/lib/notify';
import { canSendSms } from '@/lib/notify/sms-guard';
import { storage } from '@/lib/storage';
import { orderConfirmationPdf } from '@/lib/pdf';
import { evaluatePromo, computeCommission, type PromoProductInfo } from '@/lib/promo';
import { upsertCustomerFromContact } from '@/lib/customers';
import { rateLimitResponse } from '@/lib/rate-limit';
import { decrementStock, InsufficientStockError } from '@/lib/inventory';
import { RECEIPT_TTL_MS } from '@/lib/receipts';
import { ocrSlipImage } from '@/lib/slip-ocr';
import { computeEffectivePrice } from '@/lib/utils';

export const maxDuration = 60;

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
      identifiers: [data.mobile],
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
    // inside the transaction below, which re-checks atomically at write time. Pre-order
    // items have no real stock yet, so they skip this check entirely — trusted from the
    // server-fetched product row, never from client-submitted data.
    if (webLoc) {
      for (const item of data.items) {
        const p = byId.get(item.sku);
        if (!p || p.preOrder) continue;
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
    let preOrderSubtotal = 0; // portion of subtotal from pre-order lines — only 50% of this is due now
    const lineItems: { sku: string; name: string; meta: string; price: number; costPrice: number; discount: number; img: string; size: string; color: string; qty: number; stockDecremented: boolean }[] = [];
    for (const item of data.items) {
      const p = byId.get(item.sku);
      if (!p) return fail(`Product not found: ${item.sku}`, 400);
      if (p.status !== 'active') return fail(`${p.name} is not available`, 409);
      const unitPrice = computeEffectivePrice(p.price, p.discountType, p.discountValue);
      const lineTotal = unitPrice * item.qty;
      subtotal += lineTotal;
      if (p.preOrder) preOrderSubtotal += lineTotal;
      lineItems.push({
        sku: p.id,
        name: p.name,
        meta: item.meta || p.sub,
        price: unitPrice, // server price (after any product discount) wins
        costPrice: p.costPrice,
        discount: p.price - unitPrice, // per-unit product discount actually applied
        img: p.img,
        size: item.size,
        color: item.color,
        qty: item.qty,
        stockDecremented: !p.preOrder,
      });
    }
    const productDiscount = lineItems.reduce((sum, i) => sum + i.discount * i.qty, 0);

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
      // Promo math must run against each product's *effective* (already product-discounted)
      // price — otherwise a promo code would discount on top of an already-reduced line.
      const promoProductsById = new Map<string, PromoProductInfo>(products.map((p) => [p.id, {
        price: computeEffectivePrice(p.price, p.discountType, p.discountValue),
        collection: p.collection, category: p.category,
      }]));
      const result = evaluatePromo(promo, data.items.map((i) => ({ sku: i.sku, qty: i.qty })), promoProductsById);
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

    // Amount required at checkout: full price for regular items, 50% for pre-order items
    // (rounded per the blended sum, not per line), plus delivery, minus discount — clamped
    // so a heavily-discounted order never asks for less than MVR 0 up front. balanceDue is
    // a pure subtraction from `total`, so depositRequired + balanceDue === total always,
    // regardless of rounding. For a cart with no pre-order items this equals `total` exactly,
    // i.e. today's all-or-nothing behavior falls out of the same formula with no branching.
    const regularSubtotal = subtotal - preOrderSubtotal;
    const depositRequired = Math.max(0, Math.round(regularSubtotal + preOrderSubtotal * 0.5) + deliveryFee - discount);
    const balanceDue = total - depositRequired;

    // Atomic: ref + order + line items + stock decrement + promo redemption.
    let paymentSlipReceiptId = '';
    const order = await createOrderWithRef(async (tx, ref) => {
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
          productDiscount,
          total,
          method: data.method === 'delivery' ? 'Delivery' : 'Pickup',
          stage: 0,
          paid: false,
          depositRequired,
          balanceDue,
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
      const receipt = await tx.receipt.create({
        data: { orderId: ref, url: data.paymentSlipUrl, kind: 'payment_slip', expiresAt: new Date(Date.now() + RECEIPT_TTL_MS) },
      });
      paymentSlipReceiptId = receipt.id;
      return created;
    });

    // Best-effort server-side OCR of the slip — runs after the response is sent so it never
    // delays checkout; see lib/slip-ocr.ts. Never trusted as proof of payment.
    after(async () => {
      try {
        const res = await fetch(data.paymentSlipUrl);
        if (!res.ok) return;
        const contentType = res.headers.get('content-type') || '';
        const buffer = Buffer.from(await res.arrayBuffer());
        const ocr = await ocrSlipImage(buffer, contentType);
        if (!ocr) return;
        await prisma.receiptOcrData.create({ data: { receiptId: paymentSlipReceiptId, ...ocr } });
      } catch (e) {
        console.error('slip OCR failed', e);
      }
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
      await prisma.order.update({ where: { id: order.id }, data: { pdfUrl, pdfExpiresAt: new Date(Date.now() + RECEIPT_TTL_MS) } });
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
      depositRequired,
      balanceDue,
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
