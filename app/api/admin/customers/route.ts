import { prisma } from '@/lib/prisma';
import { requirePermission } from '@/lib/admin-guard';
import { ok, handleError } from '@/lib/http';

export const dynamic = 'force-dynamic';

/** GET /api/admin/customers — all customers, newest first (read-only). */
export async function GET() {
  try {
    await requirePermission('customers', 'read');
    const customers = await prisma.customer.findMany({ orderBy: { createdAt: 'desc' } });
    return ok({ customers, total: customers.length });
  } catch (err) {
    return handleError(err);
  }
}
