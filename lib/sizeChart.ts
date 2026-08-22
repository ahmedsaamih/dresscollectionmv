import type { SizeChart } from './types';

/** Seed size charts — used by prisma/seed.ts and as the client-side first-paint fallback. */
export const SEED_SIZE_CHARTS: SizeChart[] = [
  {
    id: 'sc-adult',
    name: 'Women',
    note: 'Measurements in centimetres. If you are between sizes, size up for a relaxed fit.',
    columns: ['Size', 'Bust (cm)', 'Waist (cm)', 'Hips (cm)'],
    rows: [
      ['XS', '82', '64', '90'],
      ['S', '86', '68', '94'],
      ['M', '90', '72', '98'],
      ['L', '96', '78', '104'],
      ['XL', '102', '84', '110'],
      ['2XL', '108', '90', '116'],
    ],
    isDefault: true,
  },
  {
    id: 'sc-youth',
    name: 'Petite',
    note: 'For our petite fit — cut a little shorter through the body. Measurements in centimetres.',
    columns: ['Size', 'Bust (cm)', 'Waist (cm)', 'Hips (cm)'],
    rows: [
      ['XS', '80', '62', '88'],
      ['S', '84', '66', '92'],
      ['M', '88', '70', '96'],
      ['L', '94', '76', '102'],
      ['XL', '100', '82', '108'],
    ],
    isDefault: false,
  },
];

/** Resolve the effective chart for a collection: its own assignment, else the store default. */
export function resolveSizeChart(charts: SizeChart[], sizeChartId?: string | null): SizeChart | null {
  if (sizeChartId) {
    const match = charts.find(c => c.id === sizeChartId);
    if (match) return match;
  }
  return charts.find(c => c.isDefault) ?? null;
}
