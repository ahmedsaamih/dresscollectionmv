import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatMVR(n: number): string {
  return 'MVR ' + Number(n).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

/** <input accept> value for artwork uploads — raster images plus common design-file formats. */
export const ARTWORK_FILE_ACCEPT = 'image/*,.pdf,.ai,.eps,.psd,application/pdf,application/postscript,image/vnd.adobe.photoshop,application/illustrator';

/** MIME types (or extensions, for browsers that report a generic/empty type) recognized as design files. */
const DESIGN_FILE_EXTENSIONS = /\.(pdf|ai|psd|eps)$/i;
const RASTER_IMAGE_TYPES = /^image\/(png|jpe?g|webp|gif|svg\+xml)$/i;

/** Whether a file's artwork preview can be shown as an <img> thumbnail. */
export function isPreviewableImage(mimeType: string, filename: string): boolean {
  if (RASTER_IMAGE_TYPES.test(mimeType)) return true;
  return !DESIGN_FILE_EXTENSIONS.test(filename) && mimeType.startsWith('image/');
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** Reads a file as-is (no compression/re-encoding) — used for artwork/design uploads. */
export function readArtworkFile(file: File): Promise<{ name: string; url: string; size: number; previewable: boolean }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (ev) => {
      resolve({
        name: file.name,
        url: ev.target!.result as string,
        size: file.size,
        previewable: isPreviewableImage(file.type, file.name),
      });
    };
    reader.onerror = () => reject(reader.error ?? new Error('Could not read file'));
    reader.readAsDataURL(file);
  });
}

export function genRef(prefix: 'DC' | 'QT'): string {
  const yy = new Date().getFullYear().toString().slice(2);
  const n = Math.floor(10000 + Math.random() * 89999);
  return `${prefix}-${yy}-${n}`;
}

export const LOW_STOCK_THRESHOLD = 5; // customer-facing "running low" cutoff
export const STOCK_BAR_MAX = 20; // visual reference: bar reads "full" at this many units — not a business rule

export const COLOR_MAP: Record<string, string> = {
  Blush: '#fc8ec1', Mauve: '#a17787', Ivory: '#f3e6d8', Sage: '#9caf88',
  Terracotta: '#c9704f', Navy: '#232a3d', Gold: '#c9a227', Black: '#1a1a1a',
};

export const ORDER_STAGES = [
  'Placed',            // 0
  'In Production',     // 1
  'Ready for Pickup',  // 2
  'Ready for Delivery',// 3
  'Out for Delivery',  // 4
  'Completed',         // 5
  'Cancelled',         // 6
];
export const QUOTE_STAGES = ['Requested', 'Under review', 'Quote sent', 'Approved'];

// Which ORDER_STAGES indices are reachable for each fulfilment method — used
// both to build the admin UI's stage dropdown and to server-side validate a
// stage change against the order's method (see app/api/admin/orders/[id]/route.ts).
export const PICKUP_STAGE_IDS = [0, 1, 2, 5, 6];
export const DELIVERY_STAGE_IDS = [0, 1, 3, 4, 5, 6];

export const STAGE_META = [
  { fg: '#ff6370', bg: 'rgba(255,61,77,.12)'   },  // 0 Placed
  { fg: '#f5c842', bg: 'rgba(245,200,66,.12)'   },  // 1 In Production
  { fg: '#c13978', bg: 'rgba(193,57,120,.14)'   },  // 2 Ready for Pickup
  { fg: '#e63387', bg: 'rgba(51,230,198,.13)'   },  // 3 Ready for Delivery
  { fg: '#600a32', bg: 'rgba(219,87,149,.12)'    },  // 4 Out for Delivery
  { fg: '#705260', bg: 'rgba(0,0,0,.06)'        },  // 5 Completed
  { fg: '#ff3d4d', bg: 'rgba(255,61,77,.1)'    },  // 6 Cancelled
];
