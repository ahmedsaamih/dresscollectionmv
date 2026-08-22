import { prisma } from '@/lib/prisma';
import { requirePermission, audit } from '@/lib/admin-guard';
import { ok, fail, handleError, displayDate } from '@/lib/http';
import { nextRef } from '@/lib/ref';
import { orderInclude, serializeOrder } from '@/lib/order-serializer';
import { upsertCustomerFromContact } from '@/lib/customers';
import { orderConfirmationPdf } from '@/lib/pdf';
import { storage } from '@/lib/storage';
import { ensurePaymentReceipt } from '@/lib/order-documents';
import { decrementStock, InsufficientStockError } from '@/lib/inventory';
import { optionalMobile } from '@/lib/validation';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

/** GET /api/admin/orders — all orders, newest first, with receipts and line items. */
export async function GET() {
  try {
    await requirePermission('orders', 'read');
    const rows = await prisma.order.findMany({
      orderBy: { createdAt: 'desc' },
      include: orderInclude,
    });
    const orders = rows.map(serializeOrder);
    return ok({ orders, total: orders.length });
  } catch (err) {
    return handleError(err);
  }
}

const manualOrderSchema = z.object({
  customer: z.string().trim().min(1),
  email: z.string().trim().default(''),
  mobile: optionalMobile.default(''),
  address: z.string().trim().optional(),
  deliveryAreaId: z.string().trim().nullish(),
  notes: z.string().trim().optional(),
  locationId: z.string().trim().min(1, 'Location is required'),
  items: z.array(z.object({
    sku: z.string().trim().min(1),
    size: z.string().trim().optional().default(''),
    color: z.string().trim().optional().default(''),
    sleeve: z.string().trim().optional().default(''),
    neck: z.string().trim().optional().default(''),
    qty: z.coerce.number().int().positive(),
  })).min(1, 'Add at least one product'),
  discount: z.coerce.number().int().nonnegative().default(0),
  discountNote: z.string().trim().nullish(),
  method: z.enum(['Pickup', 'Delivery']).default('Pickup'),
  paidCash: z.coerce.number().int().nonnegative().default(0),
  paidCard: z.coerce.number().int().nonnegative().default(0),
  paidTransfer: z.coerce.number().int().nonnegative().default(0),
}).refine((d) => d.method !== 'Delivery' || !!d.deliveryAreaId?.trim(), {
  message: 'Delivery area is required',
  path: ['deliveryAreaId'],
});

/** POST /api/admin/orders — create a product-backed manual order with inventory decrement. */
export async function POST(request: Request) {
  try {
    const session = await requirePermission('orders', 'edit');
    const data = manualOrderSchema.parse(await request.json());

    const settings = await prisma.setting.findUnique({ where: { id: 'singleton' } });
    if (!settings) return fail('Store is not configured', 500);

    const location = await prisma.location.findUnique({ where: { id: data.locationId } });
    if (!location) return fail('Location not found', 404);

    let deliveryArea: { id: string; name: string; rate: number; active: boolean } | null = null;
    if (data.method === 'Delivery') {
      deliveryArea = await prisma.deliveryArea.findUnique({ where: { id: data.deliveryAreaId! } });
      if (!deliveryArea || !deliveryArea.active) return fail('Delivery area not found', 404);
    }

    const skus = [...new Set(data.items.map((i) => i.sku))];
    const products = await prisma.product.findMany({ where: { id: { in: skus } } });
    const byId = new Map(products.map((p) => [p.id, p]));

    // Fast-fail UX only — NOT the source of truth. The real guard is decrementStock()
    // inside the transaction below, which re-checks atomically at write time.
    // Customizable products are made-to-order (no stock item) except in the 'casual'
    // collection (blank stock garments printed on demand) — same rule as web/POS.
    for (const item of data.items) {
      const p = byId.get(item.sku);
      if (!p) return fail(`Product not found: ${item.sku}`, 400);
      if (p.status !== 'active') return fail(`${p.name} is not available`, 409);
      if (p.customizable && p.collection !== 'casual') continue;
      const inv = await prisma.inventory.findUnique({
        where: { locationId_productId_size_color: { locationId: data.locationId, productId: p.id, size: item.size, color: item.color } },
      });
      if (!inv || inv.qty < item.qty) {
        const variant = [item.size, item.color].filter(Boolean).join(' / ');
        return fail(`${variant ? variant + ' of ' : ''}${p.name} is out of stock at ${location.name}`, 409);
      }
    }

    let subtotal = 0;
    const lineItems = data.items.map((item) => {
      const p = byId.get(item.sku)!;
      const sleeveAdj = ((p.sleeveAdjustments as Record<string, number>) ?? {})[item.sleeve ?? ''] ?? 0;
      const sizeAdj = ((p.sizeAdjustments as Record<string, number>) ?? {})[item.size ?? ''] ?? 0;
      const unitPrice = p.price + sleeveAdj + sizeAdj;
      subtotal += unitPrice * item.qty;
      return {
        sku: p.id,
        name: p.name,
        meta: p.sub,
        price: unitPrice,
        img: p.img,
        size: item.size,
        color: item.color,
        sleeve: item.sleeve ?? '',
        neck: item.neck ?? '',
        qty: item.qty,
        stockDecremented: !p.customizable || p.collection === 'casual',
      };
    });

    const deliveryFee = data.method === 'Delivery' ? deliveryArea!.rate : 0;
    const discount = Math.min(data.discount, subtotal + deliveryFee);
    const total = subtotal + deliveryFee - discount;
    const paidTotal = data.paidCash + data.paidCard + data.paidTransfer;
    if (paidTotal > total) return fail(`Payment total (${paidTotal}) cannot exceed order total (${total})`, 400);
    const paid = paidTotal >= total;
    const summary = lineItems.map((i) => `${i.name} ×${i.qty}`).join(', ');

    const order = await prisma.$transaction(async (tx) => {
      const ref = await nextRef('DC', tx);
      const created = await tx.order.create({
        data: {
          id: ref,
          customer: data.customer,
          email: data.email,
          mobile: data.mobile || null,
          address: data.method === 'Delivery' ? data.address || null : null,
          notes: data.notes || null,
          items: summary,
          subtotal,
          deliveryFee,
          deliveryAreaId: deliveryArea?.id ?? null,
          discount,
          discountNote: data.discountNote || null,
          total,
          method: data.method,
          stage: 0,
          paid,
          paidCash: data.paidCash,
          paidCard: data.paidCard,
          paidTransfer: data.paidTransfer,
          source: 'web',
          origin: 'manual_order',
          locationId: data.locationId,
          date: displayDate(),
          lineItems: { create: lineItems },
        },
      });
      for (const i of lineItems) {
        if (i.stockDecremented) {
          await decrementStock(tx, { locationId: data.locationId, productId: i.sku, size: i.size, color: i.color, qty: i.qty });
        }
      }
      return created;
    });

    await upsertCustomerFromContact({ name: data.customer, phone: data.mobile, email: data.email });

    try {
      const bankAccounts = (settings.bankAccounts as { name: string; accountNumber: string }[] | null) ?? [];
      const pdf = await orderConfirmationPdf({
        ref: order.id, customer: order.customer, email: order.email, mobile: order.mobile ?? null,
        date: order.date, method: order.method, address: order.address ?? null, notes: order.notes ?? null,
        subtotal, deliveryFee, discount, total,
        items: lineItems,
        storeName: settings.storeName, storeAddress: settings.address,
        storePhone: settings.phone, storeEmail: settings.email,
        taxId: settings.taxId, bankAccounts,
        taxRate: settings.taxRate, taxLabel: settings.taxLabel,
        termsConditions: settings.termsConditions,
      });
      const stored = await storage.put({ bucket: 'pdf', filename: `${order.id}.pdf`, data: pdf, contentType: 'application/pdf' });
      await prisma.order.update({ where: { id: order.id }, data: { pdfUrl: stored.url } });
    } catch (e) {
      console.error('manual order PDF generation failed', e);
    }
    if (paid) {
      try { await ensurePaymentReceipt(order.id); } catch (e) { console.error('manual order receipt generation failed', e); }
    }

    await audit(session.email, 'order.manual.create', order.id, { customer: data.customer, total, locationId: data.locationId });

    const fullOrder = await prisma.order.findUnique({ where: { id: order.id }, include: orderInclude });
    return ok({ order: fullOrder ? serializeOrder(fullOrder) : { id: order.id, customer: order.customer, total: order.total, date: order.date, paid } }, 201);
  } catch (err) {
    if (err instanceof InsufficientStockError) {
      // Race lost between the pre-check and the transaction (stock sold via another channel meanwhile).
      const variant = [err.size, err.color].filter(Boolean).join(' / ');
      return fail(`${variant ? variant + ' of ' : ''}${err.productId} is out of stock`, 409);
    }
    return handleError(err);
  }
}
