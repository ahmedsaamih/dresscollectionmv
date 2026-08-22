import { prisma } from '@/lib/prisma';
import { requirePermission } from '@/lib/admin-guard';
import { ok, handleError } from '@/lib/http';
import type { QuoteChangeRequest } from '@/lib/types';

export const dynamic = 'force-dynamic';

/** GET /api/admin/quote-requests — pending + recent quote change requests (approver/admin only). */
export async function GET() {
  try {
    await requirePermission('quoteApprovals', 'read');
    const rows = await prisma.quoteChangeRequest.findMany({
      orderBy: { createdAt: 'desc' },
      take: 100,
      include: { quote: { select: { id: true, customer: true, email: true, summary: true } } },
    });
    const requests: QuoteChangeRequest[] = rows.map((r) => ({
      id: r.id,
      quoteId: r.quoteId,
      quoteCustomer: r.quote.customer,
      quoteEmail: r.quote.email,
      quoteSummary: r.quote.summary,
      requestedBy: r.requestedBy,
      currentStage: r.currentStage,
      currentPrice: r.currentPrice ?? null,
      requestedStage: r.requestedStage ?? null,
      requestedPrice: r.requestedPrice ?? null,
      status: r.status,
      resolvedBy: r.resolvedBy ?? null,
      resolvedAt: r.resolvedAt ? r.resolvedAt.toISOString() : null,
      rejectionNote: r.rejectionNote ?? null,
      createdAt: r.createdAt.toISOString(),
    }));
    return ok({ requests });
  } catch (err) {
    return handleError(err);
  }
}
