import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatMVR(n: number): string {
  return 'MVR ' + Number(n).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

/**
 * The price a customer actually pays after a product's own automatic discount
 * (distinct from PromoCode/Order.discount, the cart-level code system). Clamps
 * defensively rather than rejecting stale/edited data — money math should never
 * produce a negative price even if discountValue is larger than price.
 */
export function computeEffectivePrice(price: number, discountType: string | null | undefined, discountValue: number): number {
  if (!discountType) return price;
  if (discountType === 'fixed') return Math.max(0, price - discountValue);
  if (discountType === 'percent') {
    const pct = Math.max(0, Math.min(100, discountValue));
    return Math.max(0, Math.round(price * (1 - pct / 100)));
  }
  return price;
}


/** Strips the " — Colour" suffix used to disambiguate a colour split off a base product. */
export function baseProductName(name: string): string {
  return name.split(' — ')[0].trim();
}

export const LOW_STOCK_THRESHOLD = 5; // customer-facing "running low" cutoff
export const STOCK_BAR_MAX = 20; // visual reference: bar reads "full" at this many units — not a business rule

/** Standard size scale offered in the admin "stock per colour & size" grid (formerly BuilderSize). */
export const PRODUCT_SIZES = ['XS', 'S', 'M', 'L', 'XL', '2XL', '3XL'];

export const COLOR_MAP: Record<string, string> = {
  Blush: '#fc8ec1', Mauve: '#a17787', Ivory: '#f3e6d8', Sage: '#9caf88',
  Terracotta: '#c9704f', Navy: '#232a3d', Gold: '#c9a227', Black: '#1a1a1a',
};

const HEX_RE = /^#[0-9a-f]{6}$/i;

/**
 * Resolve a colour name to a display hex value: the product's own admin-set
 * colorHex first, then the COLOR_MAP default for known names, then a neutral
 * grey — never something a consumer (e.g. a native colour input) would reject.
 */
export function productColorHex(colorHex: Record<string, string> | undefined | null, name: string): string {
  const v = colorHex?.[name];
  if (v && HEX_RE.test(v)) return v;
  const fallback = COLOR_MAP[name];
  if (fallback && HEX_RE.test(fallback)) return fallback;
  return '#cccccc';
}

export const ORDER_STAGES = [
  'Placed',              // 0
  'Payment Confirmed',   // 1
  'Arrived at Facility', // 2 — pre-order only
  'Ready for Pickup',    // 3
  'Ready for Delivery',  // 4
  'Out for Delivery',    // 5
  'Completed',           // 6
  'Cancelled',           // 7
];

export const STAGE_META = [
  { fg: '#ff6370', bg: 'rgba(255,61,77,.12)'  },  // 0 Placed
  { fg: '#f5c842', bg: 'rgba(245,200,66,.12)' },  // 1 Payment Confirmed
  { fg: '#c9a227', bg: 'rgba(201,162,39,.14)' },  // 2 Arrived at Facility
  { fg: '#c13978', bg: 'rgba(193,57,120,.14)' },  // 3 Ready for Pickup
  { fg: '#e63387', bg: 'rgba(51,230,198,.13)' },  // 4 Ready for Delivery
  { fg: '#600a32', bg: 'rgba(219,87,149,.12)' },  // 5 Out for Delivery
  { fg: '#705260', bg: 'rgba(0,0,0,.06)'      },  // 6 Completed
  { fg: '#ff3d4d', bg: 'rgba(255,61,77,.1)'   },  // 7 Cancelled
];

/** True once a deposit was required and a balance still remains — stable for
 * an order's whole life (depositRequired/balanceDue are creation-time
 * snapshots). Single source of truth for "is this a pre-order order". */
export function isPreOrder(o: { depositRequired: number; balanceDue: number }): boolean {
  return o.depositRequired > 0 && o.balanceDue > 0;
}

/**
 * Which ORDER_STAGES ids are reachable for a given fulfilment method and
 * pre-order-ness — used to build the admin UI's stage dropdown, to
 * server-side validate a stage change (app/api/admin/orders/[id]/route.ts),
 * and to build the customer-facing tracking page's step list
 * (app/api/status/route.ts) — this single shared function is what keeps
 * admin and the customer tracking page in sync.
 */
export function stageIdsFor(method: 'Pickup' | 'Delivery', preOrder: boolean): number[] {
  if (method === 'Pickup') return preOrder ? [0, 1, 2, 3, 6, 7] : [0, 1, 3, 6, 7];
  return preOrder ? [0, 1, 2, 4, 5, 6, 7] : [0, 1, 4, 5, 6, 7];
}

/** Customer-facing copy per stage id — friendlier/longer than ORDER_STAGES'
 * short admin labels, but keyed by the same id so the STRUCTURE (which ids
 * exist, in what order) stays driven by stageIdsFor() alone; see
 * app/api/status/route.ts. */
export const CUSTOMER_STAGE_COPY: Record<number, { title: string; desc: string }> = {
  0: { title: 'Order placed', desc: 'We received your order.' },
  1: { title: 'Payment confirmed', desc: "We've confirmed your payment." },
  2: { title: 'Item arrived', desc: 'Your pre-ordered piece has arrived at our facility and is being prepared.' },
  3: { title: 'Ready for pickup', desc: 'Collect at our Malé store.' },
  4: { title: 'Ready for delivery', desc: 'Your order is packed and queued for delivery.' },
  5: { title: 'Out for delivery', desc: 'On its way to your address.' },
  6: { title: 'Completed', desc: '' },
  7: { title: 'Cancelled', desc: 'This order was cancelled.' },
};
