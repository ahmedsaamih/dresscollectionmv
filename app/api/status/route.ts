import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { ok, fail, handleError } from '@/lib/http';
import { formatMVR } from '@/lib/utils';
import { rateLimitResponse } from '@/lib/rate-limit';
import { ATTACH_WINDOW_MS } from '@/lib/receipts';
import { contactMatches } from '@/lib/order-contact';

export const dynamic = 'force-dynamic';

/**
 * GET /api/status?ref=DC-26-48213&contact=customer@email.mv
 *
 * Public order lookup. No login — verified by reference + the contact
 * (email or mobile) on file. A wrong/missing contact returns the same
 * "not found" as a bad reference, so references can't be enumerated.
 */
export async function GET(request: Request) {
  try {
    const ipLimit = await rateLimitResponse(request, { scope: 'status:ip', limit: 30, windowMs: 60 * 1000 });
    if (ipLimit) return ipLimit;

    const { searchParams } = new URL(request.url);
    const ref = (searchParams.get('ref') || '').trim().toUpperCase();
    const contact = (searchParams.get('contact') || '').trim();

    if (!ref) return fail('Enter a reference number.', 400);
    if (ref.length > 40) return fail('Reference is too long.', 400);
    if (!/^DC-/.test(ref)) return fail('References start with DC-.', 400);
    if (!contact) return fail('Enter the email or mobile on your confirmation.', 400);
    if (contact.length > 254) return fail('Contact is too long.', 400);

    const notFound = () => fail('No match for that reference and contact.', 404);

    const order = await prisma.order.findUnique({ where: { id: ref }, include: { receipts: true } });
    if (!order || !contactMatches(contact, order.email, order.mobile)) return notFound();
    return ok(orderStatus(order));
  } catch (err) {
    return handleError(err);
  }
}

type OrderRow = Prisma.OrderGetPayload<{ include: { receipts: true } }>;

function orderStatus(o: OrderRow) {
  const delivery = o.method === 'Delivery';
  const cancelled = o.stage === 6;
  const steps = delivery
    ? [
        { title: 'Order placed', desc: 'We received your order.', date: o.date },
        { title: 'Payment confirmed', desc: "We've confirmed your payment.", date: null },
        { title: 'Ready for delivery', desc: 'Your order is packed and queued for delivery.', date: o.readyForDeliveryAt?.toISOString() ?? null },
        { title: 'Out for delivery', desc: 'On its way to your address.', date: null },
        { title: cancelled ? 'Cancelled' : 'Completed', desc: cancelled ? 'This order was cancelled.' : 'Delivery completed.', date: null },
      ]
    : [
        { title: 'Order placed', desc: 'We received your order.', date: o.date },
        { title: 'Payment confirmed', desc: "We've confirmed your payment.", date: null },
        { title: 'Ready for pickup', desc: 'Collect at our Malé store.', date: null },
        { title: cancelled ? 'Cancelled' : 'Completed', desc: cancelled ? 'This order was cancelled.' : 'Order collected.', date: null },
      ];
  const stage = cancelled ? steps.length - 1 : delivery ? deliveryStep(o.stage) : pickupStep(o.stage);
  return {
    type: 'order' as const,
    ref: o.id,
    summary: o.items,
    metaLabel: 'Total',
    metaValue: formatMVR(o.total),
    method: o.method,
    paid: o.paid,
    deliveryFee: o.deliveryFee,
    canUploadSlip: !o.paid && !o.receipts.some((r) => r.kind === 'payment_slip') && (Date.now() - o.createdAt.getTime() <= ATTACH_WINDOW_MS),
    depositRequired: o.depositRequired,
    balanceDue: o.balanceDue,
    balancePaid: o.balancePaid,
    canUploadBalanceSlip: o.balanceDue > 0 && o.paid && !o.balancePaid && !o.receipts.some((r) => r.kind === 'balance_slip'),
    stage,
    steps,
    note: delivery
      ? o.paid
        ? o.balanceDue > 0 && !o.balancePaid
          ? `We'll SMS you tracking details once it ships. A balance of ${formatMVR(o.balanceDue)} is due before dispatch.`
          : "We'll SMS you tracking details once it ships."
        : "We'll prepare your order while payment is confirmed."
      : o.paid
        ? o.balanceDue > 0 && !o.balancePaid
          ? `We'll SMS you the moment it's ready to collect. A balance of ${formatMVR(o.balanceDue)} is due before pickup.`
          : "We'll SMS you the moment it's ready to collect."
        : "We'll SMS you after payment is confirmed.",
  };
}

function pickupStep(stage: number): number {
  if (stage >= 5) return 3;
  if (stage >= 2) return 2;
  return Math.min(stage, 1);
}

function deliveryStep(stage: number): number {
  if (stage >= 5) return 4;
  if (stage >= 4) return 3;
  if (stage >= 3) return 2;
  return Math.min(stage, 1);
}

