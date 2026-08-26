import { prisma } from '@/lib/prisma';
import { audit } from '@/lib/admin-guard';
import { notifier } from '@/lib/notify';
import { canSendSms } from '@/lib/notify/sms-guard';
import { ensurePaymentReceipt, ensureBalanceReceipt } from '@/lib/order-documents';

const FAILURE_STATUS_WORDS = new Set(['FAILED', 'DECLINED']);
const STALE_SLIP_BUFFER_MS = 24 * 60 * 60 * 1000; // absorbs Maldives (UTC+5) parsing slop

/**
 * Best-effort, conservative auto-verification of a payment slip's OCR data
 * against the order it was attached to. Never throws — any missing/ambiguous
 * signal simply leaves the order exactly as today's manual-review flow
 * behaves (unpaid, awaiting an admin). This is informational-only data read
 * off a customer-submitted image; it never re-confirms an already-settled
 * order, and it stops at the first check that doesn't clearly pass.
 *
 * On success, sets `paid`/`balancePaid` with the `*Auto` flag — a fully
 * separate concept from an admin's own "Payment Verified" confirmation
 * (see app/api/admin/orders/[id]/route.ts), which this never sets.
 */
export async function autoVerifyReceiptPayment(receiptId: string, request: Request): Promise<void> {
  try {
    const receipt = await prisma.receipt.findUnique({ where: { id: receiptId }, include: { ocr: true, order: true } });
    if (!receipt || !receipt.ocr || !receipt.order) return;
    if (receipt.kind !== 'payment_slip' && receipt.kind !== 'balance_slip') return;

    const order = receipt.order;
    const ocr = receipt.ocr;
    const isBalance = receipt.kind === 'balance_slip';

    if (order.stage === 7) return; // cancelled — never auto-mark a cancelled order paid

    if (isBalance) {
      if (!order.paid || order.balanceDue <= 0 || order.balancePaid) return;
    } else {
      if (order.paid) return;
    }

    const amountDue = isBalance ? order.balanceDue : (order.depositRequired || order.total);

    if (ocr.amount == null || Math.round(ocr.amount) !== amountDue) return;
    if (ocr.currency && ocr.currency.toUpperCase() !== 'MVR') return;
    if (ocr.status && FAILURE_STATUS_WORDS.has(ocr.status.toUpperCase())) return;

    if (ocr.referenceNumber) {
      const duplicate = await prisma.receiptOcrData.findFirst({
        where: {
          referenceNumber: { equals: ocr.referenceNumber.trim(), mode: 'insensitive' },
          receipt: { orderId: { not: order.id } },
        },
      });
      if (duplicate) return;
    }

    if (ocr.transactionDateParsed && ocr.transactionDateParsed.getTime() < order.createdAt.getTime() - STALE_SLIP_BUFFER_MS) return;

    // All signals agree — auto-mark paid.
    const updated = isBalance
      ? await prisma.order.update({
          where: { id: order.id },
          data: { balancePaid: true, balancePaidAuto: true, paidTransfer: { increment: amountDue } },
        })
      : await prisma.order.update({
          where: { id: order.id },
          data: { paid: true, paidAuto: true, paidTransfer: { increment: amountDue } },
        });

    await audit('system:ocr-auto-verify', isBalance ? 'order.auto_verify_balance' : 'order.auto_verify_payment', order.id, {
      receiptId, amount: ocr.amount, referenceNumber: ocr.referenceNumber, bankName: ocr.bankName,
    });

    if (isBalance) {
      try { await ensureBalanceReceipt(order.id); } catch (e) { console.error('auto-verify balance receipt generation failed', e); }
      const smsAllowed = await canSendSms(request, updated.mobile);
      await notifier.orderBalanceConfirmed({ ref: updated.id, email: updated.email, name: updated.customer, mobile: updated.mobile, smsAllowed });
      await notifier.adminOrderPaymentAlert({ ref: updated.id, customer: updated.customer, total: updated.balanceDue, auto: true });
    } else {
      try { await ensurePaymentReceipt(order.id); } catch (e) { console.error('auto-verify payment receipt generation failed', e); }
      // Mirrors the manual PATCH route's smsEligible rule: web-checkout orders
      // are always eligible; POS orders only when delivered (paid-in-full POS
      // sales already send this at creation). This flow realistically only
      // ever sees web_checkout receipts, but the rule is kept identical.
      const smsEligible = updated.origin === 'web_checkout' || (updated.origin === 'pos_sale' && updated.method === 'Delivery');
      if (smsEligible) {
        const smsAllowed = await canSendSms(request, updated.mobile);
        await notifier.orderPaymentConfirmed({ ref: updated.id, email: updated.email, name: updated.customer, mobile: updated.mobile, smsAllowed, balanceDue: updated.balanceDue });
      }
      await notifier.adminOrderPaymentAlert({ ref: updated.id, customer: updated.customer, total: updated.total, auto: true });
    }
  } catch (e) {
    console.error('auto-verify payment failed', e);
  }
}
