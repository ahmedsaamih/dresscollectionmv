import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { requirePermission, audit } from '@/lib/admin-guard';
import { ok, fail, handleError } from '@/lib/http';

export const dynamic = 'force-dynamic';

/**
 * POST /api/admin/quote-requests/[id]/accept
 * Applies a pending change request's requested stage/price onto its quote.
 */
export async function POST(_request: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    const session = await requirePermission('quoteApprovals', 'edit');
    const reqRow = await prisma.quoteChangeRequest.findUnique({ where: { id: params.id } });
    if (!reqRow) return fail('Request not found', 404);
    if (reqRow.status !== 'pending') return fail('This request has already been resolved.', 409);

    const quote = await prisma.quote.findUnique({ where: { id: reqRow.quoteId } });
    if (!quote) return fail('Quote not found', 404);
    if (quote.stage !== reqRow.currentStage) {
      return fail('The quote has changed since this request was filed. Please review it again.', 409);
    }

    const update: Prisma.QuoteUpdateInput = {};
    if (reqRow.requestedStage !== null) update.stage = reqRow.requestedStage;
    if (reqRow.requestedPrice !== null) update.price = reqRow.requestedPrice;

    const [updatedQuote] = await prisma.$transaction([
      prisma.quote.update({ where: { id: quote.id }, data: update }),
      prisma.quoteChangeRequest.update({
        where: { id: reqRow.id },
        data: { status: 'accepted', resolvedBy: session.email, resolvedAt: new Date() },
      }),
    ]);

    await audit(session.email, 'quote.change_request.accept', reqRow.quoteId, {
      requestId: reqRow.id, requestedStage: reqRow.requestedStage, requestedPrice: reqRow.requestedPrice,
    });
    return ok({ quote: { id: updatedQuote.id, stage: updatedQuote.stage, price: updatedQuote.price ?? null } });
  } catch (err) {
    return handleError(err);
  }
}
