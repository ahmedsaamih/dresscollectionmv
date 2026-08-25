import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { ok, fail, handleError } from '@/lib/http';
import { rateLimitResponse } from '@/lib/rate-limit';
import { storageUrl, slipOcrSchema } from '@/lib/validation';
import { RECEIPT_TTL_MS, ATTACH_WINDOW_MS } from '@/lib/receipts';
import { contactMatches } from '@/lib/order-contact';

export const dynamic = 'force-dynamic';

const body = z.object({
  url: storageUrl(),
  kind: z.enum(['payment_slip', 'balance_slip']).optional().default('payment_slip'),
  // Required for balance_slip only — this endpoint is unauthenticated by design, so unlike
  // the deposit slip (gated by a short post-checkout time window instead) a balance slip,
  // which can legitimately arrive weeks later, is gated by proving you know the order's
  // contact details, the same check GET /api/status uses.
  contact: z.string().trim().max(254).optional(),
  ocr: slipOcrSchema,
});

/** POST /api/orders/[id]/receipts — attach a payment-slip URL to an order (public). */
export async function POST(request: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    const ipLimit = await rateLimitResponse(request, { scope: 'order-receipt:ip', limit: 20, windowMs: 60 * 60 * 1000 });
    if (ipLimit) return ipLimit;

    const { url, kind, contact, ocr } = body.parse(await request.json());
    const order = await prisma.order.findUnique({ where: { id: params.id }, include: { receipts: true } });
    if (!order) return fail('Order not found', 404);

    if (kind === 'payment_slip') {
      if (Date.now() - order.createdAt.getTime() > ATTACH_WINDOW_MS) {
        return fail('This order can no longer accept a receipt upload.', 403);
      }
      if (order.receipts.some((r) => r.kind === 'payment_slip')) {
        return fail('A receipt has already been attached to this order.', 409);
      }
    } else {
      if (!contact || !contactMatches(contact, order.email, order.mobile)) {
        return fail('Order not found', 404); // same shape as a bad ref — no enumeration hint
      }
      if (!(order.balanceDue > 0 && order.paid && !order.balancePaid)) {
        return fail('This order has no balance payment to upload.', 403);
      }
      if (order.receipts.some((r) => r.kind === 'balance_slip')) {
        return fail('A balance receipt has already been attached to this order.', 409);
      }
    }

    const expiresAt = new Date(Date.now() + RECEIPT_TTL_MS);
    const receipt = await prisma.receipt.create({ data: { orderId: order.id, url, kind, expiresAt } });
    if (ocr) {
      await prisma.receiptOcrData.create({
        data: {
          receiptId: receipt.id,
          bankName: ocr.bankName, status: ocr.status, referenceNumber: ocr.referenceNumber,
          transactionDate: ocr.transactionDate, fromName: ocr.fromName, toName: ocr.toName,
          toAccount: ocr.toAccount, amount: ocr.amount, currency: ocr.currency,
          rawText: ocr.rawText,
        },
      });
    }
    return ok({ receipt: { id: receipt.id, url: receipt.url } }, 201);
  } catch (err) {
    return handleError(err);
  }
}
