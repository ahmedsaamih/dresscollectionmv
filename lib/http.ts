import { NextResponse } from 'next/server';
import { ZodError } from 'zod';

export function ok<T>(data: T, status = 200) {
  return NextResponse.json(data, { status });
}

export function fail(message: string, status = 400, extra?: Record<string, unknown>) {
  return NextResponse.json({ error: message, ...extra }, { status });
}

/** Turn a thrown error (Zod, auth, or otherwise) into a JSON response. */
export function handleError(err: unknown) {
  if (err instanceof ZodError) {
    return NextResponse.json(
      { error: 'Validation failed', issues: err.issues.map((i) => ({ path: i.path.join('.'), message: i.message })) },
      { status: 422 }
    );
  }
  if (err instanceof Error && err.name === 'UnauthorizedError') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (err instanceof Error && err.name === 'ForbiddenError') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  // Fallback only — routes that decrement stock should catch InsufficientStockError
  // explicitly first to produce a product-specific message.
  if (err instanceof Error && err.name === 'InsufficientStockError') {
    return NextResponse.json({ error: err.message }, { status: 409 });
  }
  console.error(err);
  return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
}

/** Display date matching the seed format, e.g. "23 Jun 2026". */
export function displayDate(d = new Date()): string {
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}
