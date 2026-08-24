import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { nextRef } from '@/lib/ref';
import { posOrderSchema } from '@/lib/validation';
import { ok, fail, handleError, displayDate } from '@/lib/http';
import { requirePermission, audit } from '@/lib/admin-guard';
import { orderConfirmationPdf } from '@/lib/pdf';
import { storage } from '@/lib/storage';
import { evaluatePromo, computeCommission, type PromoProductInfo } from '@/lib/promo';
import { upsertCustomerFromContact } from '@/lib/customers';
import { ensurePaymentReceipt } from '@/lib/order-documents';
import { notifier } from '@/lib/notify';
import { canSendSms } from '@/lib/notify/sms-guard';
import { decrementStock, InsufficientStockError } from '@/lib/inventory';
import { requestReview } from '@/lib/reviews';
import { computeEffectivePrice } from '@/lib/utils';

export const dynamic = 'force-dynamic';

/**
 * POST /api/pos/order
 *
 * Creates a POS order. Key differences from web checkout:
 * - Requires edit access to the Sales Terminal module
 * - Accepts `locationId` — stock decremented from that location
 * - Accepts split payment: paidCash + paidCard + paidTransfer
 * - Accepts an optional `promoCode` (mutually exclusive with the manual `discount`),
 *   re-validated and redeemed the same way as web checkout
 * - `source` is always "pos"
 * - Customer email is optional
 */
export async function POST(request: Request) {
  try {
    const session = await requirePermission('posSales', 'edit');
    const body = await request.json();
    const data = posOrderSchema.parse(body);

    const settings = await prisma.setting.findUnique({ where: { id: 'singleton' } });
    if (!settings) return fail('Store is not configured', 500);

    const location = await prisma.location.findUnique({ where: { id: data.locationId } });
    if (!location) return fail('Location not found', 404);

    let deliveryArea: { id: string; name: string; rate: number; active: boolean } | null = null;
    if (data.method === 'Delivery') {
      deliveryArea = await prisma.deliveryArea.findUnique({ where: { id: data.deliveryAreaId! } });
      if (!deliveryArea || !deliveryArea.active) return fail('Delivery area not found', 404);
    }

    const skus = [...new Set(data.items.map((i) => i.sku))];
    const products = await prisma.product.findMany({ where: { id: { in: skus } } });
    const byId = new Map(products.map((p) => [p.id, p]));

    // Pre-order products aren't sellable at the counter — the admin UI already excludes
    // them from the POS product picker, this is defense-in-depth against a crafted request.
    for (const item of data.items) {
      const p = byId.get(item.sku);
      if (p?.preOrder) return fail(`${p.name} is a pre-order item and cannot be sold via POS`, 400);
    }

    // Fast-fail UX only — NOT the source of truth. The real guard is decrementStock()
    // inside the transaction below, which re-checks atomically at write time.
    for (const item of data.items) {
      const p = byId.get(item.sku);
      if (!p) return fail(`Product not found: ${item.sku}`, 400);
      if (p.status !== 'active') return fail(`${p.name} is not available`, 409);

      const inv = await prisma.inventory.findUnique({
        where: { locationId_productId_size_color: { locationId: data.locationId, productId: p.id, size: item.size, color: item.color } },
      });
      if (!inv || inv.qty < item.qty) {
        const variant = [item.size, item.color].filter(Boolean).join(' / ');
        return fail(`${variant ? variant + ' of ' : ''}${p.name} is out of stock at ${location.name}`, 409);
      }
    }

    let subtotal = 0;
    const lineItems: { sku: string; name: string; meta: string; price: number; costPrice: number; discount: number; img: string; size: string; color: string; qty: number; stockDecremented: boolean }[] = [];

    for (const item of data.items) {
      const p = byId.get(item.sku)!;
      const unitPrice = computeEffectivePrice(p.price, p.discountType, p.discountValue);

      subtotal += unitPrice * item.qty;
      lineItems.push({
        sku: p.id,
        name: p.name,
        meta: item.meta || p.sub,
        price: unitPrice,
        costPrice: p.costPrice,
        discount: p.price - unitPrice,
        img: p.img,
        size: item.size,
        color: item.color,
        qty: item.qty,
        stockDecremented: true,
      });
    }
    const productDiscount = lineItems.reduce((sum, i) => sum + i.discount * i.qty, 0);

    const deliveryFee = data.method === 'Delivery' ? deliveryArea!.rate : 0;

    // Promo / referral code — re-validated and priced server-side, same as web checkout.
    // Mutually exclusive with the manual `discount` field (the POS UI only ever sends one).
    let discount: number;
    let discountCode: string | null = null;
    let promoEligible = 0;
    let promoCommission = 0;
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
      promoEligible = result.eligible;
      promoCommission = computeCommission(promo, result.subtotal, discount);
      discountCode = promo.code;
      promoId = promo.id;
      promoReferrer = promo.referrer;
    } else {
      discount = Math.min(data.discount, subtotal + deliveryFee);
    }
    const total = subtotal + deliveryFee - discount;
    const paidTotal = data.paidCash + data.paidCard + data.paidTransfer;
    if (paidTotal !== total) {
      return fail(`Payment total (${paidTotal}) must equal order total (${total})`, 400);
    }

    const paid = (data.paidCash + data.paidCard + data.paidTransfer) >= total;
    const summary = lineItems.map((i) => `${i.name} ×${i.qty}`).join(', ');

    const order = await prisma.$transaction(async (tx) => {
      const ref = await nextRef('DC', tx);
      const created = await tx.order.create({
        data: {
          id: ref,
          customer: data.customer || 'Walk-in Customer',
          email: data.email ?? '',
          mobile: data.mobile || null,
          items: summary,
          subtotal,
          deliveryFee,
          deliveryAreaId: deliveryArea?.id ?? null,
          discountCode,
          discount,
          productDiscount,
          discountNote: data.discountNote ?? null,
          total,
          method: data.method,
          stage: 0,
          paid,
          paidCash: data.paidCash,
          paidCard: data.paidCard,
          paidTransfer: data.paidTransfer,
          source: 'pos',
          origin: 'pos_sale',
          locationId: data.locationId,
          address: data.method === 'Delivery' ? data.address?.trim() ?? null : null,
          notes: data.notes ?? null,
          date: displayDate(),
          lineItems: { create: lineItems },
        },
      });

      for (const i of lineItems) {
        if (i.stockDecremented) {
          await decrementStock(tx, { locationId: data.locationId, productId: i.sku, size: i.size, color: i.color, qty: i.qty });
        }
      }

      if (promoId) {
        await tx.redemption.create({
          data: { codeId: promoId, code: discountCode!, orderId: ref, subtotal, eligible: promoEligible, discount, referrer: promoReferrer, commission: promoCommission },
        });
        await tx.promoCode.update({ where: { id: promoId }, data: { timesUsed: { increment: 1 } } });
      }

      return created;
    });

    await upsertCustomerFromContact({ name: data.customer, phone: data.mobile, email: data.email });

    // PDF generation — best-effort, never blocks the order response.
    let pdfUrl: string | null = null;
    try {
      const bankAccounts = (settings.bankAccounts as { name: string; accountNumber: string }[] | null) ?? [];
      const pdf = await orderConfirmationPdf({
        ref: order.id, customer: order.customer, email: order.email, mobile: order.mobile ?? null,
        date: order.date, method: data.method, notes: data.notes ?? null, address: data.method === 'Delivery' ? data.address?.trim() ?? null : null,
        subtotal, deliveryFee, discount, total,
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
      console.error('POS order PDF generation failed', e);
    }

    await audit(session.email, 'pos.order.create', order.id, { customer: data.customer, total, locationId: data.locationId });

    // Notify the customer only for delivery sales — pickup/walk-in customers
    // are already standing at the counter.
    if (order.method === 'Delivery') {
      const placedSmsAllowed = await canSendSms(request, order.mobile);
      await notifier.orderPlaced({
        ref: order.id, email: order.email, name: order.customer, total,
        mobile: order.mobile, smsAllowed: placedSmsAllowed,
      });
      // Payment-confirmed SMS only if already paid in full at the counter;
      // otherwise it waits for the hook in the admin order PATCH route.
      if (paid) {
        const smsAllowed = await canSendSms(request, order.mobile);
        await notifier.orderPaymentConfirmed({ ref: order.id, email: order.email, name: order.customer, mobile: order.mobile, smsAllowed });
      }
    }
    // Telegram ping for every POS sale (pickup and delivery) — staff want to
    // know about all of them, unlike the customer email/SMS above which only
    // fires for deliveries.
    await notifier.adminOrderAlert({ ref: order.id, customer: order.customer, total, itemCount: data.items.length });

    // POS sales have no fulfilment "Completed" stage to trigger off (stage is
    // locked at 0 forever for pos_sale orders) — a POS sale is complete the
    // moment it's paid in full, which (unlike web checkout) is always true at
    // creation since partial payment is rejected above. Ask for a review
    // regardless of pickup/delivery, since — unlike the placed/paid
    // notifications above — this is meant to reach the customer after they've
    // left, not while they're standing at the counter.
    if (paid) {
      const reviewSmsAllowed = await canSendSms(request, order.mobile);
      await requestReview({ id: order.id, email: order.email, customer: order.customer, mobile: order.mobile }, { smsAllowed: reviewSmsAllowed });
    }
    let receiptUrl: string | null = null;
    if (paid) {
      try { receiptUrl = await ensurePaymentReceipt(order.id); } catch (e) { console.error('POS receipt generation failed', e); }
    }

    return ok({
      ref: order.id,
      subtotal,
      deliveryFee,
      discount,
      total,
      paid,
      paidCash: data.paidCash,
      paidCard: data.paidCard,
      paidTransfer: data.paidTransfer,
      customer: data.customer,
      method: data.method,
      address: data.method === 'Delivery' ? data.address?.trim() ?? null : null,
      date: order.date,
      pdfUrl,
      receiptUrl,
      items: lineItems,
    }, 201);
  } catch (err) {
    if (err instanceof InsufficientStockError) {
      // Race lost between the pre-check and the transaction (stock sold via another channel meanwhile).
      const variant = [err.size, err.color].filter(Boolean).join(' / ');
      return fail(`${variant ? variant + ' of ' : ''}${err.productId} is out of stock`, 409);
    }
    if (err instanceof Prisma.PrismaClientKnownRequestError) {
      console.error('[pos/order] Prisma known error:', err.code, err.message, err.meta);
      return fail(`DB error ${err.code}: ${err.message}`, 500);
    }
    if (err instanceof Prisma.PrismaClientValidationError) {
      console.error('[pos/order] Prisma validation error:', err.message);
      return fail(`DB validation error: ${err.message}`, 500);
    }
    return handleError(err);
  }
}
