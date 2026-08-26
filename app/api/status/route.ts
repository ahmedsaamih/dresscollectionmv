import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { ok, fail, handleError } from '@/lib/http';
import { formatMVR, stageIdsFor, isPreOrder, CUSTOMER_STAGE_COPY } from '@/lib/utils';
import { rateLimitResponse } from '@/lib/rate-limit';
import { ATTACH_WINDOW_MS } from '@/lib/receipts';
import { contactMatches } from '@/lib/order-contact';

export const dynamic = 'force-dynamic';

/**
 * GET /api/status?ref=K7B4X&contact=customer@email.mv
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
    // Accepts both the new short codes (e.g. "K7B4X") and pre-existing
    // DC-YY-NNNNN references from before the format changed.
    if (!/^[A-Z0-9-]{3,40}$/.test(ref)) return fail('Enter a valid reference.', 400);
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
  const cancelled = o.stage === 7;
  const preOrder = isPreOrder(o);
  // Same stageIdsFor() the admin dropdown and the PATCH validator use — this
  // is what keeps the step list here in sync with admin's status control.
  // Cancelled (7) substitutes into the terminal slot rather than adding a step.
  const stageIds = stageIdsFor(o.method as 'Pickup' | 'Delivery', preOrder).filter((id) => id !== 7);
  const steps = stageIds.map((id) => {
    const copy = CUSTOMER_STAGE_COPY[id];
    let date: string | null = null;
    if (id === 0) date = o.date;
    if (id === 4) date = o.readyForDeliveryAt?.toISOString() ?? null;
    let desc = copy.desc;
    if (id === 6) desc = delivery ? 'Delivery completed.' : 'Order collected.';
    return { title: copy.title, desc, date };
  });
  if (cancelled) {
    const last = steps[steps.length - 1];
    last.title = 'Cancelled';
    last.desc = 'This order was cancelled.';
  }
  const idx = stageIds.indexOf(o.stage);
  const stage = cancelled ? steps.length - 1 : idx === -1 ? 0 : idx;
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

