/**
 * Verifies a customer-supplied contact (email or mobile) against an order's
 * contact details on file — the only identity check on the public, unauthenticated
 * order-lookup and receipt-attach endpoints. Shared so both use exactly the same
 * matching rule.
 */
export function contactMatches(input: string, email: string, mobile: string | null): boolean {
  if (email.toLowerCase() === input.toLowerCase()) return true;
  const digits = (s: string) => s.replace(/\D/g, '');
  return !!mobile && digits(mobile) !== '' && digits(mobile) === digits(input);
}
