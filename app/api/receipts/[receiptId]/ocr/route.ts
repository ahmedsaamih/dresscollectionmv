import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { ok, fail, handleError } from '@/lib/http';
import { rateLimitResponse } from '@/lib/rate-limit';
import { slipOcrSchema } from '@/lib/validation';

export const dynamic = 'force-dynamic';

const body = z.object({ ocr: slipOcrSchema });

/**
 * POST /api/receipts/[receiptId]/ocr — attach best-effort, client-computed OCR fields to an
 * already-uploaded slip receipt. Public/unauthenticated by design (same as the receipts-attach
 * route) — the receipt id is an unguessable cuid, and this only ever adds informational data,
 * never anything payment-relevant. Called asynchronously, well after the slip itself is
 * uploaded and saved, so OCR (multi-second, multi-megabyte client-side work) never blocks or
 * delays the upload itself — see components/SlipUpload.tsx.
 */
export async function POST(request: Request, props: { params: Promise<{ receiptId: string }> }) {
  const params = await props.params;
  try {
    const ipLimit = await rateLimitResponse(request, { scope: 'receipt-ocr:ip', limit: 30, windowMs: 60 * 60 * 1000 });
    if (ipLimit) return ipLimit;

    const { ocr } = body.parse(await request.json());
    if (!ocr) return ok({ attached: false });

    const receipt = await prisma.receipt.findUnique({ where: { id: params.receiptId }, include: { ocr: true } });
    if (!receipt || !['payment_slip', 'balance_slip'].includes(receipt.kind)) return fail('Receipt not found', 404);
    if (receipt.ocr) return ok({ attached: false }); // already has OCR data — idempotent no-op

    await prisma.receiptOcrData.create({
      data: {
        receiptId: receipt.id,
        bankName: ocr.bankName, status: ocr.status, referenceNumber: ocr.referenceNumber,
        transactionDate: ocr.transactionDate, fromName: ocr.fromName, toName: ocr.toName,
        toAccount: ocr.toAccount, amount: ocr.amount, currency: ocr.currency,
        rawText: ocr.rawText,
      },
    });
    return ok({ attached: true });
  } catch (err) {
    return handleError(err);
  }
}
