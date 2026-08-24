import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatMVR(n: number): string {
  return 'MVR ' + Number(n).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

export function genRef(prefix: 'DC'): string {
  const yy = new Date().getFullYear().toString().slice(2);
  const n = Math.floor(10000 + Math.random() * 89999);
  return `${prefix}-${yy}-${n}`;
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
  'Placed',            // 0
  'Payment Confirmed', // 1
  'Ready for Pickup',  // 2
  'Ready for Delivery',// 3
  'Out for Delivery',  // 4
  'Completed',         // 5
  'Cancelled',         // 6
];
// Which ORDER_STAGES indices are reachable for each fulfilment method — used
// both to build the admin UI's stage dropdown and to server-side validate a
// stage change against the order's method (see app/api/admin/orders/[id]/route.ts).
export const PICKUP_STAGE_IDS = [0, 1, 2, 5, 6];
export const DELIVERY_STAGE_IDS = [0, 1, 3, 4, 5, 6];

export const STAGE_META = [
  { fg: '#ff6370', bg: 'rgba(255,61,77,.12)'   },  // 0 Placed
  { fg: '#f5c842', bg: 'rgba(245,200,66,.12)'   },  // 1 Payment Confirmed
  { fg: '#c13978', bg: 'rgba(193,57,120,.14)'   },  // 2 Ready for Pickup
  { fg: '#e63387', bg: 'rgba(51,230,198,.13)'   },  // 3 Ready for Delivery
  { fg: '#600a32', bg: 'rgba(219,87,149,.12)'    },  // 4 Out for Delivery
  { fg: '#705260', bg: 'rgba(0,0,0,.06)'        },  // 5 Completed
  { fg: '#ff3d4d', bg: 'rgba(255,61,77,.1)'    },  // 6 Cancelled
];
