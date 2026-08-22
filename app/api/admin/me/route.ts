import { getAdminSession } from '@/lib/admin-guard';
import { ok, fail } from '@/lib/http';

export const dynamic = 'force-dynamic';

/** GET /api/admin/me — returns the current admin, or 401. */
export async function GET() {
  const session = await getAdminSession();
  if (!session) return fail('Unauthorized', 401);
  return ok({ email: session.email, role: session.role, permissions: session.permissions });
}
