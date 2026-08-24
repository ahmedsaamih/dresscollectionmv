import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { orderUpdateSchema } from '@/lib/validation';
import { requirePermission, audit } from '@/lib/admin-guard';
import { notifier } from '@/lib/notify';
import { canSendSms } from '@/lib/notify/sms-guard';
import { requestReview } from '@/lib/reviews';
import { ok, fail, handleError } from '@/lib/http';
import { orderInclude, serializeOrder } from '@/lib/order-serializer';
import { PICKUP_STAGE_IDS, DELIVERY_STAGE_IDS } from '@/lib/utils';
import { ensurePaymentReceipt, ensureBalanceReceipt } from '@/lib/order-documents';
import { incrementStock } from '@/lib/inventory';

export const dynamic = 'force-dynamic';

/** Reverses whatever decrementStock() applied at order-creation time for this order's lines. */
async function restockOrderItems(
  tx: Prisma.TransactionClient,
  locationId: string | null,
  lineItems: { sku: string; size: string; color: string; qty: number; stockDecremented: boolean; sizeBreakdown: Prisma.JsonValue }[]
) {
  if (!locationId) {
    console.warn('Order restock skipped — no locationId recorded on this order');
    return;
  }
  for (const li of lineItems) {
    if (!li.stockDecremented) continue;
    if (li.sizeBreakdown && typeof li.sizeBreakdown === 'object') {
      for (const [size, qty] of Object.entries(li.sizeBreakdown as Record<string, number>)) {
        await incrementStock(tx, { locationId, productId: li.sku, size, color: li.color, qty });
      }
    } else {
      await incrementStock(tx, { locationId, productId: li.sku, size: li.size, color: li.color, qty: li.qty });
    }
  }
}

/** PATCH /api/admin/orders/[id] — update fulfilment stage and/or paid flag. */
export async function PATCH(request: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    const session = await requirePermission('orders', 'edit');
    const data = orderUpdateSchema.parse(await request.json());

    const before = await prisma.order.findUnique({ where: { id: params.id }, include: { lineItems: true } });
    if (!before) return fail('Order not found', 404);
    if (data.stage !== undefined && before.origin === 'pos_sale') {
      return fail('POS sale fulfilment status is locked', 403);
    }
    if (data.stage !== undefined && before.stage === 6 && data.stage !== 6) {
      return fail('Cancelled orders cannot be un-cancelled', 400);
    }
    if (data.stage !== undefined) {
      const validStages = before.method === 'Delivery' ? DELIVERY_STAGE_IDS : PICKUP_STAGE_IDS;
      if (!validStages.includes(data.stage)) {
        return fail(`Invalid stage for a ${before.method} order`, 400);
      }
    }

    const touchesPaidAmounts = data.paidCash !== undefined || data.paidCard !== undefined || data.paidTransfer !== undefined;
    if (touchesPaidAmounts) {
      const paidCash = data.paidCash ?? before.paidCash;
      const paidCard = data.paidCard ?? before.paidCard;
      const paidTransfer = data.paidTransfer ?? before.paidTransfer;
      if (paidCash + paidCard + paidTransfer > before.total) {
        return fail(`Payment received cannot exceed MVR ${before.total.toLocaleString()}.`, 400);
      }
    }

    const update: Prisma.OrderUpdateInput = {};
    if (data.stage !== undefined) update.stage = data.stage;
    if (data.stage !== undefined) {
      if (data.stage === 3 && !before.readyForDeliveryAt) update.readyForDeliveryAt = new Date();
      if (data.stage < 3) update.readyForDeliveryAt = null;
    }
    if (data.paid !== undefined) update.paid = data.paid;
    if (data.paidCash !== undefined) update.paidCash = data.paidCash;
    if (data.paidCard !== undefined) update.paidCard = data.paidCard;
    if (data.paidTransfer !== undefined) update.paidTransfer = data.paidTransfer;
    if (data.balancePaid !== undefined) {
      if (data.balancePaid && before.balanceDue <= 0) {
        return fail('This order has no balance due.', 400);
      }
      update.balancePaid = data.balancePaid;
    }

    const updated = await prisma.$transaction(async (tx) => {
      // Cancelling (stage -> 6) restocks whatever this order actually decremented, atomically with the stage change.
      if (data.stage === 6 && before.stage !== 6) {
        await restockOrderItems(tx, before.locationId, before.lineItems);
      }
      return tx.order.update({
        where: { id: params.id },
        data: update,
        include: orderInclude,
      });
    });
    await audit(session.email, 'order.update', params.id, data);

    // Email the customer when the fulfilment stage actually changes.
    if (data.stage !== undefined && data.stage !== before.stage) {
      const stageSmsAllowed = await canSendSms(request, updated.mobile);
      await notifier.orderStatusUpdated({ ref: updated.id, email: updated.email, name: updated.customer, stage: updated.stage, mobile: updated.mobile, smsAllowed: stageSmsAllowed });
      await notifier.adminOrderStageAlert({ ref: updated.id, customer: updated.customer, fromStage: before.stage, toStage: updated.stage });

      // Ask for a review once the order is Completed. POS sales never reach
      // this branch (stage changes are blocked for them above) — they get
      // their review request at sale creation instead, since a POS sale is
      // "completed" the moment it's paid in full.
      if (updated.stage === 5 && (updated.origin === 'web_checkout' || updated.origin === 'quote_conversion' || updated.origin === 'manual_order')) {
        await requestReview({ id: updated.id, email: updated.email, customer: updated.customer, mobile: updated.mobile }, { smsAllowed: stageSmsAllowed });
      }
    }

    // Generate payment receipt PDF when an order transitions to paid (best-effort).
    const justPaid = data.paid === true && !before.paid;
    if (justPaid) {
      try {
        await ensurePaymentReceipt(updated.id);
      } catch (e) {
        console.error('payment receipt PDF generation failed', e);
      }

      // Payment-confirmed SMS: web checkout orders are always eligible (they're
      // never paid at creation); POS orders only when delivered (paid-in-full
      // POS sales already sent this at creation, so `!before.paid` stops a
      // duplicate). Manual/admin-created orders and quote conversions are
      // out of scope.
      const smsEligible = updated.origin === 'web_checkout' || (updated.origin === 'pos_sale' && updated.method === 'Delivery');
      if (smsEligible) {
        const smsAllowed = await canSendSms(request, updated.mobile);
        await notifier.orderPaymentConfirmed({ ref: updated.id, email: updated.email, name: updated.customer, mobile: updated.mobile, smsAllowed, balanceDue: updated.balanceDue });
      }
      await notifier.adminOrderPaymentAlert({ ref: updated.id, customer: updated.customer, total: updated.total });

      // POS sales are "completed" as soon as they're paid in full (their
      // stage is locked and never reaches 5 — see above). Normal POS sales
      // are already paid at creation and get their review request there; this
      // covers the rare case a payment correction flips `paid` true after the
      // fact. requestReview() is idempotent, so this is a safe no-op otherwise.
      if (updated.origin === 'pos_sale') {
        const reviewSmsAllowed = await canSendSms(request, updated.mobile);
        await requestReview({ id: updated.id, email: updated.email, customer: updated.customer, mobile: updated.mobile }, { smsAllowed: reviewSmsAllowed });
      }
    }

    // Generate balance receipt PDF + notify when a pre-order's remaining balance is confirmed (best-effort).
    const justBalancePaid = data.balancePaid === true && !before.balancePaid;
    if (justBalancePaid) {
      try {
        await ensureBalanceReceipt(updated.id);
      } catch (e) {
        console.error('balance receipt PDF generation failed', e);
      }
      const balanceSmsAllowed = await canSendSms(request, updated.mobile);
      await notifier.orderBalanceConfirmed({ ref: updated.id, email: updated.email, name: updated.customer, mobile: updated.mobile, smsAllowed: balanceSmsAllowed });
      await notifier.adminOrderPaymentAlert({ ref: updated.id, customer: updated.customer, total: updated.balanceDue });
    }

    const refreshed = await prisma.order.findUnique({ where: { id: updated.id }, include: orderInclude });
    return ok({
      order: refreshed ? serializeOrder(refreshed) : serializeOrder(updated),
    });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2025') {
      return fail('Order not found', 404);
    }
    return handleError(err);
  }
}

/** DELETE /api/admin/orders/[id] — requires edit access to Orders. */
export async function DELETE(_request: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    const session = await requirePermission('orders', 'edit');
    const order = await prisma.$transaction(async (tx) => {
      const o = await tx.order.findUnique({ where: { id: params.id }, include: { lineItems: true } });
      if (!o) return null;
      await restockOrderItems(tx, o.locationId, o.lineItems);
      await tx.order.delete({ where: { id: params.id } }); // cascades OrderItem
      return o;
    });
    if (!order) return fail('Order not found', 404);
    await audit(session.email, 'order.delete', params.id);
    return ok({ deleted: true });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2025') {
      return fail('Order not found', 404);
    }
    return handleError(err);
  }
}
