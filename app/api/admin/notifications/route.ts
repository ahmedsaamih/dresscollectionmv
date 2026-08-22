import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { requirePermission } from '@/lib/admin-guard';
import { ok, handleError } from '@/lib/http';

export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/notifications — recent email/SMS delivery log, newest first
 * (read-only). Optional query params narrow the result: orderRef (partial,
 * case-insensitive), event, channel, status.
 */
export async function GET(request: Request) {
  try {
    await requirePermission('customers', 'read');
    const params = new URL(request.url).searchParams;
    const orderRef = params.get('orderRef');
    const event = params.get('event');
    const channel = params.get('channel');
    const status = params.get('status');
    const where: Prisma.NotificationLogWhereInput = {
      ...(orderRef ? { orderRef: { contains: orderRef, mode: 'insensitive' } } : {}),
      ...(event ? { event } : {}),
      ...(channel ? { channel } : {}),
      ...(status ? { status } : {}),
    };
    const logs = await prisma.notificationLog.findMany({ where, orderBy: { createdAt: 'desc' }, take: 200 });
    return ok({ logs, total: logs.length });
  } catch (err) {
    return handleError(err);
  }
}
