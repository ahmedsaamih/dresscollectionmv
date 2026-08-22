/** Customer-uploaded payment slips are auto-deleted from R2 after this window via a bucket lifecycle rule. */
export const RECEIPT_TTL_MS = 90 * 24 * 60 * 60 * 1000; // 90 days

/**
 * The orders receipts route is unauthenticated by design (the customer has no
 * login yet at checkout), so instead of an auth check it narrows the window
 * an order ref can be enumerated in: only accept a receipt shortly after the
 * order was placed, and only once. Legitimate use is the checkout
 * confirmation page uploading a payment slip immediately after the order
 * response comes back.
 */
export const ATTACH_WINDOW_MS = 60 * 60 * 1000;

/** Mirrors the review-token soft-expiry pattern: a plain time check, no query filtering or background sweep. */
export function isReceiptExpired(receipt: { expiresAt: Date | string | null }): boolean {
  if (!receipt.expiresAt) return false;
  return new Date(receipt.expiresAt).getTime() < Date.now();
}
