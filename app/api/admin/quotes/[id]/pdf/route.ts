import { prisma } from '@/lib/prisma';
import { requirePermission } from '@/lib/admin-guard';
import { ok, fail, handleError } from '@/lib/http';
import { quotationPdf, quoteReceivedPdf } from '@/lib/pdf';
import { storage } from '@/lib/storage';

export const dynamic = 'force-dynamic';

/** POST /api/admin/quotes/[id]/pdf — generate (or regenerate) the quotation PDF on demand. */
export async function POST(_req: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    await requirePermission('quotes', 'edit');

    const quote = await prisma.quote.findUnique({
      where: { id: params.id },
      include: { lineItems: true },
    });
    if (!quote) return fail('Quote not found', 404);

    const settings = await prisma.setting.findUnique({ where: { id: 'singleton' } });
    if (!settings) return fail('Store settings not configured', 500);

    const bankAccounts = (settings.bankAccounts as { name: string; accountNumber: string }[] | null) ?? [];

    // Compose a rich specs string for the PDF from all available item fields
    const items = quote.lineItems.map((i: any) => {
      const customizationAnswers = i.customizationAnswers && typeof i.customizationAnswers === 'object'
        ? Object.entries(i.customizationAnswers as Record<string, unknown>).map(([label, value]) => {
            if (value && typeof value === 'object' && 'url' in value) {
              const named = value as { name?: unknown; url?: unknown };
              return `${label}: ${String(named.name || named.url || '')}`;
            }
            if (Array.isArray(value)) return `${label}: ${value.join(', ')}`;
            if (typeof value === 'boolean') return `${label}: ${value ? 'Yes' : 'No'}`;
            return `${label}: ${String(value ?? '')}`;
          })
        : [];
      const parts = [
        i.customizationProfileName && `Profile: ${i.customizationProfileName}`,
        i.type && `Type: ${i.type}`,
        i.fabric && `Fabric: ${i.fabric}`,
        i.sleeve && `Sleeve: ${i.sleeve}`,
        i.neck && `Neck: ${i.neck}`,
        i.accent && `Accent: ${i.accent}`,
        i.placement && `Placement: ${i.placement}`,
        i.logoName && `Logo: ${i.logoName}`,
        i.artName && `Artwork: ${i.artName}`,
        i.notes && `Notes: ${i.notes}`,
        ...customizationAnswers,
      ].filter(Boolean);
      // Use admin-entered specs as-is if available, otherwise compose from parts
      const specs = i.specs?.trim() ? i.specs : parts.join(' · ');
      return {
        name: i.name, specs, units: i.units, sizesLabel: i.sizesLabel,
        unitPrice: i.unitPrice, customizationLines: (i.customizationLines as { label: string; cost: number }[] | null) ?? [], customizationCost: i.customizationCost,
      };
    });

    let pdfBuf: Buffer;
    if (quote.price != null) {
      pdfBuf = await quotationPdf({
        ref: quote.id,
        customer: quote.customer,
        email: quote.email,
        mobile: quote.mobile ?? null,
        date: quote.date,
        message: quote.message ?? null,
        items,
        price: quote.price,
        storeName: settings.storeName,
        storeAddress: settings.address,
        storePhone: settings.phone,
        storeEmail: settings.email,
        taxId: settings.taxId,
        bankAccounts,
        taxRate: settings.taxRate,
        taxLabel: settings.taxLabel,
        termsConditions: settings.termsConditions,
      });
    } else {
      pdfBuf = await quoteReceivedPdf({
        ref: quote.id,
        customer: quote.customer,
        email: quote.email,
        mobile: quote.mobile ?? null,
        date: quote.date,
        message: quote.message ?? null,
        items,
        storeName: settings.storeName,
        storeAddress: settings.address,
        storePhone: settings.phone,
        storeEmail: settings.email,
        taxId: settings.taxId,
      });
    }

    const stored = await storage.put({
      bucket: 'pdf',
      filename: `${quote.id}-quote.pdf`,
      data: pdfBuf,
      contentType: 'application/pdf',
    });
    await prisma.quote.update({ where: { id: params.id }, data: { pdfUrl: stored.url } });

    return ok({ url: stored.url });
  } catch (err) {
    console.error('[quote/pdf] error:', err);
    if (err instanceof Error) {
      return fail(`PDF generation failed: ${err.message}`, 500);
    }
    return handleError(err);
  }
}
