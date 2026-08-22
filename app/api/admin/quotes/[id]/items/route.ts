import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { requirePermission, audit } from '@/lib/admin-guard';
import { ok, fail, handleError } from '@/lib/http';
import { computeUnitPrice } from '@/lib/pricing';
import { recomputeQuoteComputedPrice } from '@/lib/quotes';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

const addItemSchema = z.object({
  kind: z.enum(['jersey', 'casual', 'office', 'office-full', 'profile']).default('jersey'),
  name: z.string().trim().min(1),
  specs: z.string().trim().default(''),
  units: z.coerce.number().int().positive().default(1),
  sizesLabel: z.string().trim().default(''),
  sizes: z.record(z.string(), z.number()).default({}),
  swatch: z.string().trim().default('#888888'),
  colorName: z.string().trim().nullish(), // must be one of product.colors — the real Inventory color key (swatch is display-only hex)
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
  customizationAnswers: z.record(z.string(), z.unknown()).optional().default({}),
  productId: z.string().trim().nullish(),
  manualUnitPrice: z.coerce.number().int().nonnegative().optional(),
  customizationLines: z.array(z.object({ label: z.string().trim().min(1), cost: z.coerce.number().int().nonnegative() })).optional().default([]),
});

/** POST /api/admin/quotes/[id]/items — add a line item to an existing quote. */
export async function POST(request: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    const session = await requirePermission('quotes', 'edit');
    const quote = await prisma.quote.findUnique({ where: { id: params.id } });
    if (!quote) return fail('Quote not found', 404);

    const data = addItemSchema.parse(await request.json());

    let unitPrice = data.manualUnitPrice ?? 0;
    // Only persist colorName if it actually names one of the product's colors —
    // it's the Inventory lookup key at conversion time, so a stale/invalid value
    // must not silently pass through (better to leave it null and skip decrement later).
    let colorName: string | null = null;
    if (data.productId) {
      const product = await prisma.product.findUnique({ where: { id: data.productId } });
      if (!product) return fail(`Product not found: ${data.productId}`, 400);
      unitPrice = computeUnitPrice(product, { sleeve: data.sleeve });
      if (data.colorName && product.colors.includes(data.colorName)) colorName = data.colorName;
    }
    const customizationCost = data.customizationLines.reduce((s, l) => s + l.cost, 0);

    let computedPrice = 0;
    let units = 0;
    let configs = 0;
    const item = await prisma.$transaction(async (tx) => {
      const created = await tx.quoteItem.create({
        data: {
          quoteId: params.id,
          kind: data.kind,
          name: data.name,
          specs: data.specs,
          units: data.units,
          sizesLabel: data.sizesLabel,
          sizes: data.sizes as any,
          swatch: data.swatch,
          colorName,
          type: data.type ?? undefined,
          fabric: data.fabric ?? undefined,
          sleeve: data.sleeve ?? undefined,
          neck: data.neck ?? undefined,
          collar: data.collar ?? undefined,
          accent: data.accent ?? undefined,
          logoName: data.logoName ?? undefined,
          notes: data.notes ?? undefined,
          placement: data.placement ?? undefined,
          artName: data.artName ?? undefined,
          customizationProfileId: data.customizationProfileId ?? undefined,
          customizationProfileName: data.customizationProfileName ?? undefined,
          customizationAnswers: data.customizationAnswers as Prisma.InputJsonValue,
          productId: data.productId ?? undefined,
          unitPrice,
          customizationLines: data.customizationLines as unknown as Prisma.InputJsonValue,
          customizationCost,
        },
      });
      // Update quote totals
      const allItems = await tx.quoteItem.findMany({ where: { quoteId: params.id } });
      const totalUnits = allItems.reduce((s, i) => s + i.units, 0);
      units = totalUnits;
      configs = allItems.length;
      await tx.quote.update({
        where: { id: params.id },
        data: { configs: allItems.length, units: totalUnits },
      });
      computedPrice = await recomputeQuoteComputedPrice(tx, params.id);
      return created;
    });

    await audit(session.email, 'quote.item.add', params.id, { name: data.name });

    return ok({
      item: {
        id: item.id, kind: item.kind, name: item.name, specs: item.specs,
        units: item.units, sizesLabel: item.sizesLabel, sizes: item.sizes,
        swatch: item.swatch, colorName: item.colorName ?? null, type: item.type ?? null, fabric: item.fabric ?? null,
        sleeve: item.sleeve ?? null, neck: item.neck ?? null, collar: item.collar ?? null,
        accent: item.accent ?? null, logoName: item.logoName ?? null, notes: item.notes ?? null,
        placement: item.placement ?? null, artName: item.artName ?? null, builder: null,
        customizationProfileId: item.customizationProfileId ?? null,
        customizationProfileName: item.customizationProfileName ?? null,
        customizationAnswers: (item.customizationAnswers as Record<string, unknown>) ?? {},
        productId: item.productId ?? null,
        unitPrice: item.unitPrice,
        customizationLines: (item.customizationLines as { label: string; cost: number }[] | null) ?? [],
        customizationCost: item.customizationCost,
      },
      quote: { units, configs, computedPrice },
    }, 201);
  } catch (err) {
    return handleError(err);
  }
}
