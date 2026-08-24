import { prisma } from '@/lib/prisma';
import { requirePermission, audit } from '@/lib/admin-guard';
import { ok, fail, handleError } from '@/lib/http';
import { ensurePaymentReceipt } from '@/lib/order-documents';

export const dynamic = 'force-dynamic';

/** POST /api/admin/orders/[id]/receipt — generate or return the payment receipt PDF for a paid order. */
export async function POST(_request: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    const session = await requirePermission('orders', 'edit');
    const order = await prisma.order.findUnique({ where: { id: params.id } });
    if (!order) return fail('Order not found', 404);
    if (!order.paid) return fail('Order is not paid yet', 400);

    let url: string | null;
    try {
      url = await ensurePaymentReceipt(order.id);
    } catch (e) {
      console.error('receipt image generation failed', e);
      return fail('Could not generate receipt', 500);
    }
    if (!url) return fail('Could not generate receipt', 500);
    await audit(session.email, 'order.receipt.generate', order.id);
    return ok({ url });
  } catch (err) {
    return handleError(err);
  }
}
