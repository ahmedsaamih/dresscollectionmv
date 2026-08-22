const SESSION_COOKIE = 'mm_admin';
const MUTATING_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

function sameOrigin(req: Request, url: URL): boolean {
  const origin = req.headers.get('origin');
  // Browsers always send Origin on same-site POST/PUT/PATCH/DELETE fetches,
  // even to the same origin — so a mutating request with no Origin header at
  // all is treated as cross-site rather than trusted by default.
  if (!origin) return false;
  try {
    return new URL(origin).host === url.host;
  } catch {
    return false;
  }
}

function hasCookie(req: Request, name: string): boolean {
  return (req.headers.get('cookie') || '')
    .split(';')
    .some((part) => part.trim().startsWith(`${name}=`));
}

function json(body: unknown, status: number) {
  return Response.json(body, { status });
}

/**
 * Guards the admin surface. Unauthenticated requests to /admin pages are
 * redirected to the login page; requests to /api/admin/* get a 401 JSON.
 * The login/logout endpoints and the login page itself are always reachable.
 */
export function proxy(req: Request) {
  const url = new URL(req.url);
  const { pathname } = url;

  const isLoginPage = pathname === '/admin/login';
  const isAuthApi = pathname === '/api/admin/login' || pathname === '/api/admin/logout';
  if (isLoginPage || isAuthApi) return;

  if (MUTATING_METHODS.has(req.method) && pathname.startsWith('/api/') && !sameOrigin(req, url)) {
    return json({ error: 'Invalid request origin' }, 403);
  }

  if (hasCookie(req, SESSION_COOKIE)) return;

  if (pathname.startsWith('/api/')) {
    return json({ error: 'Unauthorized' }, 401);
  }

  url.pathname = '/admin/login';
  url.search = `?next=${encodeURIComponent(pathname)}`;
  return Response.redirect(url);
}

export const config = {
  matcher: ['/admin', '/admin/:path*', '/api/admin/:path*', '/api/pos/order'],
};
