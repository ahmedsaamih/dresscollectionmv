import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { requirePermission, audit } from '@/lib/admin-guard';
import { ok, fail, handleError } from '@/lib/http';
import { computeUnitPrice } from '@/lib/pricing';
import { recomputeQuoteComputedPrice } from '@/lib/quotes';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

const updateItemSchema = z.object({
  kind: z.enum(['jersey', 'casual', 'office', 'office-full', 'profile']).optional(),
  name: z.string().trim().min(1).optional(),
  specs: z.string().trim().optional(),
  units: z.coerce.number().int().positive().optional(),
  sizesLabel: z.string().trim().optional(),
  sizes: z.record(z.string(), z.number()).optional(),
  colorName: z.string().trim().nullish(),
  type: z.string().trim().nullish(),
  fabric: z.string().trim().nullish(),
  sleeve: z.string().trim().nullish(),
  neck: z.string().trim().nullish(),
  collar: z.boolean().nullish(),
  accent: z.string().trim().nullish(),
  logoName: z.string().trim().nullish(),
  notes: z.string().trim().nullish(),
  placement: z.string().trim().nullish(),
  artName: z.string().trim().nullish(),
  customizationProfileId: z.string().trim().nullish(),
  customizationProfileName: z.string().trim().nullish(),
  customizationAnswers: z.record(z.string(), z.unknown()).optional(),
  productId: z.string().trim().nullish(),
  manualUnitPrice: z.coerce.number().int().nonnegative().optional(),
  customizationLines: z.array(z.object({ label: z.string().trim().min(1), cost: z.coerce.number().int().nonnegative() })).optional(),
});

/** PATCH /api/admin/quotes/[id]/items/[itemId] — update a quote line item. */
export async function PATCH(
  request: Request,
  props: { params: Promise<{ id: string; itemId: string }> }
) {
  const params = await props.params;
  try {
    const session = await requirePermission('quotes', 'edit');
    const existing = await prisma.quoteItem.findUnique({ where: { id: params.itemId } });
    if (!existing || existing.quoteId !== params.id) return fail('Item not found', 404);

    const data = updateItemSchema.parse(await request.json());

    // Recompute pricing whenever the product, sleeve, manual price, or
    // customization lines change — otherwise leave the existing snapshot as-is.
    const repriceProduct = 'productId' in data || 'sleeve' in data || 'manualUnitPrice' in data;
    let unitPrice: number | undefined;
    // Only persist colorName if it names one of the (possibly newly-selected) product's
    // colors — it's the Inventory lookup key at conversion time.
    let colorName: string | null | undefined;
    if (repriceProduct || 'colorName' in data) {
      const effectiveProductId = 'productId' in data ? data.productId : existing.productId;
      const effectiveSleeve = 'sleeve' in data ? data.sleeve : existing.sleeve;
      if (effectiveProductId) {
        const product = await prisma.product.findUnique({ where: { id: effectiveProductId } });
        if (!product) return fail(`Product not found: ${effectiveProductId}`, 400);
        if (repriceProduct) unitPrice = computeUnitPrice(product, { sleeve: effectiveSleeve });
        const effectiveColorName = 'colorName' in data ? data.colorName : existing.colorName;
        colorName = effectiveColorName && product.colors.includes(effectiveColorName) ? effectiveColorName : null;
      } else {
        if (repriceProduct) unitPrice = data.manualUnitPrice ?? existing.unitPrice;
        colorName = null;
      }
    }
    const customizationCost = data.customizationLines !== undefined
      ? data.customizationLines.reduce((s, l) => s + l.cost, 0)
      : undefined;

    const updated = await prisma.$transaction(async (tx) => {
      const item = await tx.quoteItem.update({
        where: { id: params.itemId },
        data: {
          ...(data.kind !== undefined && { kind: data.kind }),
          ...(data.name !== undefined && { name: data.name }),
          ...(data.specs !== undefined && { specs: data.specs }),
          ...(data.units !== undefined && { units: data.units }),
          ...(data.sizesLabel !== undefined && { sizesLabel: data.sizesLabel }),
          ...(data.sizes !== undefined && { sizes: data.sizes as any }),
          ...('type' in data && { type: data.type ?? null }),
          ...('fabric' in data && { fabric: data.fabric ?? null }),
          ...('sleeve' in data && { sleeve: data.sleeve ?? null }),
          ...('neck' in data && { neck: data.neck ?? null }),
          ...('collar' in data && { collar: data.collar ?? null }),
          ...('accent' in data && { accent: data.accent ?? null }),
          ...('logoName' in data && { logoName: data.logoName ?? null }),
          ...('notes' in data && { notes: data.notes ?? null }),
          ...('placement' in data && { placement: data.placement ?? null }),
          ...('artName' in data && { artName: data.artName ?? null }),
          ...('customizationProfileId' in data && { customizationProfileId: data.customizationProfileId ?? null }),
          ...('customizationProfileName' in data && { customizationProfileName: data.customizationProfileName ?? null }),
          ...(data.customizationAnswers !== undefined && { customizationAnswers: data.customizationAnswers as Prisma.InputJsonValue }),
          ...('productId' in data && { productId: data.productId ?? null }),
          ...(colorName !== undefined && { colorName }),
          ...(unitPrice !== undefined && { unitPrice }),
          ...(data.customizationLines !== undefined && { customizationLines: data.customizationLines as unknown as Prisma.InputJsonValue }),
          ...(customizationCost !== undefined && { customizationCost }),
        },
      });
      // Update quote units if units changed
      if (data.units !== undefined) {
        const allItems = await tx.quoteItem.findMany({ where: { quoteId: params.id } });
        const totalUnits = allItems.reduce((s, i) => s + i.units, 0);
        await tx.quote.update({ where: { id: params.id }, data: { units: totalUnits } });
      }
      if (data.units !== undefined || unitPrice !== undefined || customizationCost !== undefined) {
        await recomputeQuoteComputedPrice(tx, params.id);
      }
      return item;
    });

    await audit(session.email, 'quote.item.update', params.id, { itemId: params.itemId });
    const quoteRow = await prisma.quote.findUniqueOrThrow({ where: { id: params.id } });

    return ok({
      quote: { units: quoteRow.units, configs: quoteRow.configs, computedPrice: quoteRow.computedPrice },
      item: {
        id: updated.id, kind: updated.kind, name: updated.name, specs: updated.specs,
        units: updated.units, sizesLabel: updated.sizesLabel, sizes: updated.sizes,
        swatch: updated.swatch, colorName: updated.colorName ?? null, type: updated.type ?? null, fabric: updated.fabric ?? null,
        sleeve: updated.sleeve ?? null, neck: updated.neck ?? null, collar: updated.collar ?? null,
        accent: updated.accent ?? null, logoName: updated.logoName ?? null, notes: updated.notes ?? null,
        placement: updated.placement ?? null, artName: updated.artName ?? null, builder: null,
        customizationProfileId: updated.customizationProfileId ?? null,
        customizationProfileName: updated.customizationProfileName ?? null,
        customizationAnswers: (updated.customizationAnswers as Record<string, unknown>) ?? {},
        productId: updated.productId ?? null,
        unitPrice: updated.unitPrice,
        customizationLines: (updated.customizationLines as { label: string; cost: number }[] | null) ?? [],
        customizationCost: updated.customizationCost,
      },
    });
  } catch (err) {
    return handleError(err);
  }
}

/** DELETE /api/admin/quotes/[id]/items/[itemId] — remove a quote line item. */
export async function DELETE(_req: Request, props: { params: Promise<{ id: string; itemId: string }> }) {
  const params = await props.params;
  try {
    const session = await requirePermission('quotes', 'edit');
    const existing = await prisma.quoteItem.findUnique({ where: { id: params.itemId } });
    if (!existing || existing.quoteId !== params.id) return fail('Item not found', 404);

    await prisma.$transaction(async (tx) => {
      await tx.quoteItem.delete({ where: { id: params.itemId } });
      const remaining = await tx.quoteItem.findMany({ where: { quoteId: params.id } });
      const totalUnits = remaining.reduce((s, i) => s + i.units, 0);
      await tx.quote.update({
        where: { id: params.id },
        data: { configs: remaining.length, units: totalUnits || 1 },
      });
      await recomputeQuoteComputedPrice(tx, params.id);
    });

    await audit(session.email, 'quote.item.delete', params.id, { itemId: params.itemId });
    const quoteRow = await prisma.quote.findUniqueOrThrow({ where: { id: params.id } });
    return ok({ ok: true, quote: { units: quoteRow.units, configs: quoteRow.configs, computedPrice: quoteRow.computedPrice } });
  } catch (err) {
    return handleError(err);
  }
}
