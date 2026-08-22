import { getCatalog } from '@/lib/catalog';
import { ok, handleError } from '@/lib/http';

export const dynamic = 'force-dynamic';

/**
 * GET /api/store
 *
 * Public storefront catalog in one round-trip: settings, collections,
 * categories, products and builder options. Shaped to lib/types.ts so the
 * client StoreContext can drop it straight into `data`. Orders and quotes are
 * intentionally excluded — those are admin-only (Phase 6).
 */
export async function GET() {
  try {
    const catalog = await getCatalog();
    return ok(catalog);
  } catch (err) {
    return handleError(err);
  }
}
