import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { ok, fail, handleError } from '@/lib/http';
import { formatMVR } from '@/lib/utils';
import { rateLimitResponse } from '@/lib/rate-limit';
import { ATTACH_WINDOW_MS } from '@/lib/receipts';

export const dynamic = 'force-dynamic';

/**
 * GET /api/status?ref=DC-26-48213&contact=customer@email.mv
 *
 * Public order/quote lookup. No login — verified by reference + the contact
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
    if (!/^(DC|QT)-/.test(ref)) return fail('References start with DC- (orders) or QT- (quotes).', 400);
    if (!contact) return fail('Enter the email or mobile on your confirmation.', 400);
    if (contact.length > 254) return fail('Contact is too long.', 400);

    const notFound = () => fail('No match for that reference and contact.', 404);

    if (ref.startsWith('DC')) {
      const order = await prisma.order.findUnique({ where: { id: ref }, include: { receipts: true } });
      if (!order || !contactMatches(contact, order.email, order.mobile)) return notFound();
      return ok(orderStatus(order));
    }

    const quote = await prisma.quote.findUnique({ where: { id: ref } });
    if (!quote || !contactMatches(contact, quote.email, quote.mobile)) return notFound();

    // Once a quote converts to an order, tracking has to hand off to the order —
    // quoteStatus() tops out at "Approved & in production" and has no concept of
    // the fulfilment stages (production/pickup/delivery/completed) that continue
    // afterward. The converted order carries the same customer contact, so the
    // match already proven above covers it.
    const convertedOrder = await prisma.order.findFirst({ where: { quoteRef: quote.id }, include: { receipts: true } });
    if (convertedOrder) return ok({ ...orderStatus(convertedOrder), convertedFromQuoteRef: quote.id });

    return ok(quoteStatus(quote));
  } catch (err) {
    return handleError(err);
  }
}

function contactMatches(input: string, email: string, mobile: string | null): boolean {
  if (email.toLowerCase() === input.toLowerCase()) return true;
  const digits = (s: string) => s.replace(/\D/g, '');
  return !!mobile && digits(mobile) !== '' && digits(mobile) === digits(input);
}

type OrderRow = Prisma.OrderGetPayload<{ include: { receipts: true } }>;
type QuoteRow = NonNullable<Awaited<ReturnType<typeof prisma.quote.findUnique>>>;

function orderStatus(o: OrderRow) {
  const delivery = o.method === 'Delivery';
  const cancelled = o.stage === 6;
  const steps = delivery
    ? [
        { title: 'Order placed', desc: 'We received your order.', date: o.date },
        { title: 'In production', desc: 'Printing & finishing your items.', date: null },
        { title: 'Ready for delivery', desc: 'Your order is packed and queued for delivery.', date: o.readyForDeliveryAt?.toISOString() ?? null },
        { title: 'Out for delivery', desc: 'On its way to your address.', date: null },
        { title: cancelled ? 'Cancelled' : 'Completed', desc: cancelled ? 'This order was cancelled.' : 'Delivery completed.', date: null },
      ]
    : [
        { title: 'Order placed', desc: 'We received your order.', date: o.date },
        { title: 'In production', desc: 'Printing & finishing your items.', date: null },
        { title: 'Ready for pickup', desc: 'Collect at our Malé workshop.', date: null },
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
    stage,
    steps,
    note: delivery
      ? o.paid
        ? "We'll SMS you tracking details once it ships."
        : "We'll prepare your order while payment is confirmed."
      : o.paid
        ? "We'll SMS you the moment it's ready to collect."
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

function quoteStatus(q: QuoteRow) {
  const priced = q.price !== null; // price only surfaces once admin has set + sent it
  const linkExpired = q.customerDecision === 'pending' && !!q.confirmationTokenExpiresAt && q.confirmationTokenExpiresAt.getTime() < Date.now();
  const confirmed = q.customerDecision === 'confirmed';
  const slipUploaded = !!q.paymentSlipUrl;
  const quoteSentDesc = q.customerDecision === 'rejected'
    ? "You declined this quote. Contact us if you'd like to revisit pricing."
    : linkExpired
      ? 'Your confirmation link has expired — contact us to confirm.'
      : priced ? 'Your custom price is ready.' : "We'll email your custom price.";
  const approvedDesc = confirmed
    ? slipUploaded
      ? "Payment slip received — we'll confirm shortly."
      : 'Confirmed — please proceed to payment.'
    : 'Once you confirm the quote.';
  const steps = [
    { title: 'Quote requested', desc: 'Your configurations were submitted.', date: q.date },
    { title: 'Under review', desc: 'Our team is pricing your mix.', date: null },
    { title: 'Quote sent', desc: quoteSentDesc, date: null },
    { title: 'Approved & in production', desc: approvedDesc, date: null },
  ];
  const note = q.customerDecision === 'rejected'
    ? "You declined this quote. Get in touch if you'd like to revisit pricing."
    : linkExpired
      ? 'Your confirmation link has expired. Contact us and we can resend it.'
      : confirmed
        ? slipUploaded
          ? "Payment slip received — we'll confirm shortly."
          : "You've confirmed this quote — please proceed to payment."
        : 'Custom kits are quote-based — no payment until you approve the price we send.';
  return {
    type: 'quote' as const,
    ref: q.id,
    summary: `${q.configs} custom configuration${q.configs === 1 ? '' : 's'} · ${q.units} units`,
    metaLabel: 'Status',
    metaValue: priced ? formatMVR(q.price as number) : ['Requested', 'Pricing', 'Quote sent', 'Approved'][q.stage],
    stage: q.stage,
    steps,
    note,
    canUploadSlip: confirmed && !slipUploaded,
    paymentSlipUploaded: slipUploaded,
  };
}
