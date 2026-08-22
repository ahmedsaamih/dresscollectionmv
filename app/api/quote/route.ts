import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { nextRef } from '@/lib/ref';
import { quoteSchema } from '@/lib/validation';
import { ok, handleError, displayDate } from '@/lib/http';
import { notifier } from '@/lib/notify';
import { canSendSms } from '@/lib/notify/sms-guard';
import { storage } from '@/lib/storage';
import { quoteReceivedPdf } from '@/lib/pdf';
import { upsertCustomerFromContact } from '@/lib/customers';
import { rateLimitResponse } from '@/lib/rate-limit';


/**
 * POST /api/quote
 *
 * Creates a custom-jersey quote request from the cart's `quote` items.
 * No payment, no price — admin sets a price later and notifies the customer.
 * Artwork URLs come from /api/upload (Phase 4); we just associate them here.
 */
export async function POST(request: Request) {
  try {
    const ipLimit = await rateLimitResponse(request, { scope: 'quote:ip', limit: 10, windowMs: 60 * 60 * 1000 });
    if (ipLimit) return ipLimit;

    const body = await request.json();
    const data = quoteSchema.parse(body);
    const contactLimit = await rateLimitResponse(request, {
      scope: 'quote:contact',
      limit: 10,
      windowMs: 60 * 60 * 1000,
      identifiers: [data.email.toLowerCase(), data.mobile],
    });
    if (contactLimit) return contactLimit;

    const settings = await prisma.setting.findUnique({ where: { id: 'singleton' } });

    const units = data.items.reduce((a, i) => a + (i.units || 0), 0);
    const summary = data.items.map((i) => `${i.name} ×${i.units}`).join(', ').slice(0, 200);
    const artworks = data.artworkUrls.map((file) => {
      if (typeof file === 'string') return { url: file, provider: 'local', name: null, fileId: null, mimeType: null, size: null };
      return {
        url: file.url,
        provider: file.provider || 'local',
        name: file.name ?? null,
        fileId: file.fileId ?? null,
        mimeType: file.mimeType ?? null,
        size: file.size ?? null,
      };
    });

    const quote = await prisma.$transaction(async (tx) => {
      const ref = await nextRef('QT', tx);
      return tx.quote.create({
        data: {
          id: ref,
          customer: data.name,
          email: data.email,
          mobile: data.mobile,
          configs: data.items.length,
          units,
          summary,
          stage: 0,
          price: null, // never priced at request time
          message: data.message ?? null,
          date: displayDate(),
          lineItems: {
            create: data.items.map((i) => ({
              kind: i.kind,
              name: i.name,
              specs: i.specs,
              units: i.units,
              sizesLabel: i.sizesLabel,
              sizes: i.sizes,
              swatch: i.swatch,
              type: i.type ?? null,
              fabric: i.fabric ?? null,
              sleeve: i.sleeve ?? null,
              neck: i.neck ?? null,
              collar: i.collar ?? null,
              accent: i.accent ?? null,
              logoName: i.logoName ?? null,
              notes: i.notes ?? null,
              placement: i.placement ?? null,
              artName: i.artName ?? null,
              customizationProfileId: i.customizationProfileId ?? null,
              customizationProfileName: i.customizationProfileName ?? null,
              customizationAnswers: (i.customizationAnswers ?? {}) as Prisma.InputJsonValue,
            })),
          },
          artworks: {
            create: artworks,
          },
        },
      });
    });

    await upsertCustomerFromContact({ name: data.name, phone: data.mobile, email: data.email });

    // Confirmation PDF (best-effort — never blocks the request).
    let pdfUrl: string | null = null;
    try {
      if (settings) {
        const pdf = await quoteReceivedPdf({
          ref: quote.id, customer: quote.customer, email: quote.email, mobile: quote.mobile ?? null,
          date: quote.date, message: data.message ?? null,
          items: data.items.map((i) => ({ name: i.name, specs: i.specs ?? '', units: i.units, sizesLabel: i.sizesLabel })),
          storeName: settings.storeName, storeAddress: settings.address,
          storePhone: settings.phone, storeEmail: settings.email,
          taxId: settings.taxId,
        });
        const stored = await storage.put({ bucket: 'pdf', filename: `${quote.id}.pdf`, data: pdf, contentType: 'application/pdf' });
        pdfUrl = stored.url;
        await prisma.quote.update({ where: { id: quote.id }, data: { pdfUrl } });
      }
    } catch (e) {
      console.error('quote PDF generation failed', e);
    }

    const quoteRequestedSmsAllowed = await canSendSms(request, quote.mobile);
    await notifier.quoteRequested({ ref: quote.id, email: quote.email, name: quote.customer, mobile: quote.mobile ?? null, smsAllowed: quoteRequestedSmsAllowed });
    await notifier.adminQuoteAlert({ ref: quote.id, customer: quote.customer, units });

    return ok({
      ref: quote.id,
      message: "Quote requested. We'll review and send your price within 48 hours.",
      pdfUrl,
    });
  } catch (err) {
    return handleError(err);
  }
}
