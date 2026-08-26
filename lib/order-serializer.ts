import type { Prisma } from '@prisma/client';
import type { Order, OrderReceipt } from '@/lib/types';

const RECEIPT_KINDS: readonly OrderReceipt['kind'][] = ['payment_slip', 'payment_receipt', 'balance_slip', 'balance_receipt'];
function normalizeReceiptKind(kind: string | undefined): OrderReceipt['kind'] {
  return RECEIPT_KINDS.includes(kind as OrderReceipt['kind']) ? (kind as OrderReceipt['kind']) : 'payment_slip';
}
import { isReceiptExpired, isExpired } from '@/lib/receipts';

export const orderInclude = {
  receipts: { orderBy: { createdAt: 'desc' }, include: { ocr: true } },
  lineItems: true,
  location: { select: { id: true, name: true } },
  deliveryArea: { select: { id: true, name: true } },
} satisfies Prisma.OrderInclude;

type OrderWithDetails = Prisma.OrderGetPayload<{ include: typeof orderInclude }>;

export function serializeOrder(o: OrderWithDetails): Order {
  const origin = (o.origin || (o.source === 'pos' ? 'pos_sale' : 'web_checkout')) as Order['origin'];
  return {
    id: o.id,
    customer: o.customer,
    email: o.email,
    mobile: o.mobile ?? null,
    address: o.address ?? null,
    notes: o.notes ?? null,
    items: o.items,
    subtotal: o.subtotal,
    discount: o.discount,
    productDiscount: o.productDiscount,
    deliveryFee: o.deliveryFee,
    deliveryAreaId: o.deliveryAreaId ?? null,
    deliveryAreaName: o.deliveryArea?.name ?? null,
    discountNote: o.discountNote ?? null,
    total: o.total,
    method: o.method as Order['method'],
    stage: o.stage as Order['stage'],
    readyForDeliveryAt: o.readyForDeliveryAt?.toISOString() ?? null,
    date: o.date,
    paid: o.paid,
    paidAuto: o.paidAuto,
    paidVerified: o.paidVerified,
    paidVerifiedAt: o.paidVerifiedAt?.toISOString() ?? null,
    paidVerifiedBy: o.paidVerifiedBy ?? null,
    paidCash: o.paidCash,
    paidTransfer: o.paidTransfer,
    depositRequired: o.depositRequired,
    balanceDue: o.balanceDue,
    balancePaid: o.balancePaid,
    balancePaidAuto: o.balancePaidAuto,
    balancePaidVerified: o.balancePaidVerified,
    balancePaidVerifiedAt: o.balancePaidVerifiedAt?.toISOString() ?? null,
    balancePaidVerifiedBy: o.balancePaidVerifiedBy ?? null,
    source: (o.source as Order['source']) ?? 'web',
    origin,
    locationId: o.locationId ?? null,
    locationName: o.location?.name ?? null,
    pdfUrl: o.pdfUrl ?? null,
    pdfExpiresAt: o.pdfExpiresAt?.toISOString() ?? null,
    pdfExpired: isExpired(o.pdfExpiresAt),
    lineItems: (o.lineItems ?? []).map((li) => ({
      id: li.id,
      sku: li.sku,
      name: li.name,
      meta: li.meta,
      price: li.price,
      costPrice: li.costPrice,
      discount: li.discount,
      img: li.img,
      size: li.size,
      color: li.color,
      qty: li.qty,
    })),
    receipts: o.receipts.map((r) => ({
      id: r.id,
      url: r.url,
      kind: normalizeReceiptKind((r as { kind?: string }).kind),
      createdAt: r.createdAt.toISOString(),
      expiresAt: r.expiresAt?.toISOString() ?? null,
      expired: isReceiptExpired(r),
      ocr: r.ocr ? {
        bankName: r.ocr.bankName, status: r.ocr.status, referenceNumber: r.ocr.referenceNumber,
        transactionDate: r.ocr.transactionDate, transactionDateParsed: r.ocr.transactionDateParsed?.toISOString() ?? null,
        fromName: r.ocr.fromName, toName: r.ocr.toName,
        toAccount: r.ocr.toAccount, amount: r.ocr.amount, currency: r.ocr.currency,
      } : null,
    })),
  };
}
