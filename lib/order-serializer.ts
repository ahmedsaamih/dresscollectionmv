import type { Prisma } from '@prisma/client';
import type { Order } from '@/lib/types';
import { isReceiptExpired } from '@/lib/receipts';

export const orderInclude = {
  receipts: { orderBy: { createdAt: 'desc' } },
  lineItems: true,
  location: { select: { id: true, name: true } },
  deliveryArea: { select: { id: true, name: true } },
} satisfies Prisma.OrderInclude;

type OrderWithDetails = Prisma.OrderGetPayload<{ include: typeof orderInclude }>;

export function serializeOrder(o: OrderWithDetails): Order {
  const origin = (o.origin || (o.quoteRef ? 'quote_conversion' : o.source === 'pos' ? 'pos_sale' : 'web_checkout')) as Order['origin'];
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
    paidCash: o.paidCash,
    paidCard: o.paidCard,
    paidTransfer: o.paidTransfer,
    source: (o.source as Order['source']) ?? 'web',
    origin,
    locationId: o.locationId ?? null,
    locationName: o.location?.name ?? null,
    quoteRef: o.quoteRef ?? null,
    pdfUrl: o.pdfUrl ?? null,
    lineItems: (o.lineItems ?? []).map((li) => ({
      id: li.id,
      sku: li.sku,
      name: li.name,
      meta: li.meta,
      price: li.price,
      img: li.img,
      size: li.size,
      color: li.color,
      qty: li.qty,
    })),
    receipts: o.receipts.map((r) => ({
      id: r.id,
      url: r.url,
      kind: (r as { kind?: string }).kind === 'payment_receipt' ? 'payment_receipt' : 'payment_slip',
      createdAt: r.createdAt.toISOString(),
      expiresAt: r.expiresAt?.toISOString() ?? null,
      expired: isReceiptExpired(r),
    })),
  };
}
