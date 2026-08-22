import { prisma } from '@/lib/prisma';
import { requirePermission, audit } from '@/lib/admin-guard';
import { ok, fail, handleError } from '@/lib/http';
import { rejectNoteSchema } from '@/lib/validation';

export const dynamic = 'force-dynamic';

/**
 * POST /api/admin/quote-requests/[id]/reject
 * Rejects a pending change request — the underlying quote is left untouched.
 */
export async function POST(request: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    const session = await requirePermission('quoteApprovals', 'edit');
    const body = await request.json().catch(() => ({}));
    const { note } = rejectNoteSchema.parse(body);

    const reqRow = await prisma.quoteChangeRequest.findUnique({ where: { id: params.id } });
    if (!reqRow) return fail('Request not found', 404);
    if (reqRow.status !== 'pending') return fail('This request has already been resolved.', 409);

    const updated = await prisma.quoteChangeRequest.update({
      where: { id: reqRow.id },
      data: { status: 'rejected', resolvedBy: session.email, resolvedAt: new Date(), rejectionNote: note ?? null },
    });
    await audit(session.email, 'quote.change_request.reject', reqRow.quoteId, { requestId: reqRow.id, note: note ?? null });
    return ok({ request: { id: updated.id, status: updated.status } });
  } catch (err) {
    return handleError(err);
  }
}
