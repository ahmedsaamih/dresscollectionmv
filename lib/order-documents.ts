import { prisma } from '@/lib/prisma';
import { displayDate } from '@/lib/http';
import { paymentReceiptImage } from '@/lib/receipt-image';
import { storage } from '@/lib/storage';

function paymentMode(paidCash: number, paidCard: number, paidTransfer: number): string {
  if (paidCash === 0 && paidCard === 0 && paidTransfer === 0) return 'Not recorded';
  if (paidCash > 0 && paidCard === 0 && paidTransfer === 0) return 'Cash';
  if (paidCard > 0 && paidCash === 0 && paidTransfer === 0) return 'Card';
  if (paidTransfer > 0 && paidCash === 0 && paidCard === 0) return 'Bank Transfer';
  return 'Split Payment';
}

/** Deposit/full-payment receipt — generated once, on the paid:false→true transition. */
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

  // depositRequired is 0 on orders created before this field existed — falling back to
  // `total` preserves the exact receipt amount those orders always showed.
  const amount = order.depositRequired || order.total;
  const stored = await generateReceiptImage(order, settings, amount, 'receipt');
  await prisma.receipt.create({ data: { orderId: order.id, url: stored.url, kind: 'payment_receipt' } });
  return stored.url;
}

/** Balance-payment receipt — generated once, on the balancePaid:false→true transition. */
export async function ensureBalanceReceipt(orderId: string): Promise<string | null> {
  const existing = await prisma.receipt.findFirst({
    where: { orderId, kind: 'balance_receipt' },
    orderBy: { createdAt: 'desc' },
  });
  if (existing) return existing.url;

  const [order, settings] = await Promise.all([
    prisma.order.findUnique({ where: { id: orderId } }),
    prisma.setting.findUnique({ where: { id: 'singleton' } }),
  ]);
  if (!order || !settings || !order.balancePaid || order.balanceDue <= 0) return null;

  const stored = await generateReceiptImage(order, settings, order.balanceDue, 'balance-receipt');
  await prisma.receipt.create({ data: { orderId: order.id, url: stored.url, kind: 'balance_receipt' } });
  return stored.url;
}

type OrderRow = NonNullable<Awaited<ReturnType<typeof prisma.order.findUnique>>>;
type SettingRow = NonNullable<Awaited<ReturnType<typeof prisma.setting.findUnique>>>;

async function generateReceiptImage(order: OrderRow, settings: SettingRow, amount: number, filenameSuffix: string) {
  const png = await paymentReceiptImage({
    orderRef: order.id,
    customer: order.customer,
    paymentDate: displayDate(),
    paymentMode: paymentMode(order.paidCash, order.paidCard, order.paidTransfer),
    referenceNumber: order.id,
    subtotal: order.subtotal,
    deliveryFee: order.deliveryFee,
    discount: order.discount,
    productDiscount: order.productDiscount,
    amount,
    invoiceDate: order.date,
    storeName: settings.storeName,
    storeAddress: settings.address,
    storePhone: settings.phone,
    storeEmail: settings.email,
    taxId: settings.taxId,
  });
  return storage.put({
    bucket: 'pdf',
    filename: `${order.id}-${filenameSuffix}.png`,
    data: png,
    contentType: 'image/png',
  });
}
