import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { ok, fail, handleError } from '@/lib/http';
import { rateLimitResponse } from '@/lib/rate-limit';
import { storageUrl } from '@/lib/validation';
import { RECEIPT_TTL_MS, ATTACH_WINDOW_MS } from '@/lib/receipts';

export const dynamic = 'force-dynamic';

const body = z.object({ url: storageUrl() });

/** POST /api/orders/[id]/receipts — attach a payment-slip URL to an order (public). */
export async function POST(request: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    const ipLimit = await rateLimitResponse(request, { scope: 'order-receipt:ip', limit: 20, windowMs: 60 * 60 * 1000 });
    if (ipLimit) return ipLimit;

    const { url } = body.parse(await request.json());
    const order = await prisma.order.findUnique({ where: { id: params.id }, include: { receipts: true } });
    if (!order) return fail('Order not found', 404);
    if (Date.now() - order.createdAt.getTime() > ATTACH_WINDOW_MS) {
      return fail('This order can no longer accept a receipt upload.', 403);
    }
    if (order.receipts.some((r) => r.kind === 'payment_slip')) {
      return fail('A receipt has already been attached to this order.', 409);
    }

    const expiresAt = new Date(Date.now() + RECEIPT_TTL_MS);
    const receipt = await prisma.receipt.create({ data: { orderId: order.id, url, kind: 'payment_slip', expiresAt } });
    return ok({ receipt: { id: receipt.id, url: receipt.url } }, 201);
  } catch (err) {
    return handleError(err);
  }
}
