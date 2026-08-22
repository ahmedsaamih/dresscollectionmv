/**
 * Server-side unit price derivation for a real catalog product plus its
 * selected sleeve variant. Shared by checkout/POS/admin-order pricing and by
 * quote-item pricing (lib/pdf.ts quotationPdf, app/api/admin/quotes/*) so a
 * quote's per-item "actual price" is computed the same way a real sale is.
 */
export function computeUnitPrice(
  product: { price: number; sleeveAdjustments: unknown },
  opts: { sleeve?: string | null } = {},
): number {
  const sleeveAdjustments = (product.sleeveAdjustments as Record<string, number> | null) ?? {};
  const sleeveAdj = sleeveAdjustments[opts.sleeve ?? ''] ?? 0;
  return product.price + sleeveAdj;
}
