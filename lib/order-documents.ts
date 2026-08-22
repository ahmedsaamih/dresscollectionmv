import { prisma } from '@/lib/prisma';
import { displayDate } from '@/lib/http';
import { paymentReceiptPdf } from '@/lib/pdf';
import { storage } from '@/lib/storage';

function paymentMode(paidCash: number, paidCard: number, paidTransfer: number): string {
  if (paidCash === 0 && paidCard === 0 && paidTransfer === 0) return 'Not recorded';
  if (paidCash > 0 && paidCard === 0 && paidTransfer === 0) return 'Cash';
  if (paidCard > 0 && paidCash === 0 && paidTransfer === 0) return 'Card';
  if (paidTransfer > 0 && paidCash === 0 && paidCard === 0) return 'Bank Transfer';
  return 'Split Payment';
}

export async function ensurePaymentReceipt(orderId: string): Promise<string | null> {
  const existing = await prisma.receipt.findFirst({
    where: { orderId, kind: 'payment_receipt' },
    orderBy: { createdAt: 'desc' },
  });
  if (existing) return existing.url;

  const [order, settings] = await Promise.all([
    prisma.order.findUnique({ where: { id: orderId } }),
    prisma.setting.findUnique({ where: { id: 'singleton' } }),
  ]);
  if (!order || !settings || !order.paid) return null;

  const pdf = await paymentReceiptPdf({
    orderRef: order.id,
    customer: order.customer,
    paymentDate: displayDate(),
    paymentMode: paymentMode(order.paidCash, order.paidCard, order.paidTransfer),
    referenceNumber: order.id,
    subtotal: order.subtotal,
    deliveryFee: order.deliveryFee,
    discount: order.discount,
    amount: order.total,
    invoiceDate: order.date,
    storeName: settings.storeName,
    storeAddress: settings.address,
    storePhone: settings.phone,
    storeEmail: settings.email,
    taxId: settings.taxId,
  });
  const stored = await storage.put({
    bucket: 'pdf',
    filename: `${order.id}-receipt.pdf`,
    data: pdf,
    contentType: 'application/pdf',
  });
  await prisma.receipt.create({ data: { orderId: order.id, url: stored.url, kind: 'payment_receipt' } });
  return stored.url;
}
