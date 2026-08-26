'use client';
import type { Cart, CartCounts, FixedLineItem } from './types';

const KEY = 'mm_cart_v1';

function uid(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

function read(): Cart {
  if (typeof window === 'undefined') return { fixed: [] };
  try {
    const v = JSON.parse(localStorage.getItem(KEY) || 'null');
    if (v && Array.isArray(v.fixed)) return v as Cart;
  } catch {}
  return { fixed: [] };
}

function write(c: Cart): Cart {
  if (typeof window === 'undefined') return c;
  localStorage.setItem(KEY, JSON.stringify(c));
  window.dispatchEvent(new CustomEvent('mm-cart-change'));
  return c;
}

export interface FixedLineGroup {
  key: string;
  sku: string;
  color: string;
  sizes: Record<string, number>;
  items: FixedLineItem[];
}

/** Groups fixed-price cart lines by sku+color, merging each group's per-size quantities. */
export function groupFixedLines(items: FixedLineItem[]): FixedLineGroup[] {
  const groups = new Map<string, FixedLineGroup>();
  for (const item of items) {
    const key = [item.sku, item.color].join(' ');
    let group = groups.get(key);
    if (!group) {
      group = { key, sku: item.sku, color: item.color, sizes: {}, items: [] };
      groups.set(key, group);
    }
    group.sizes[item.size] = (group.sizes[item.size] ?? 0) + item.qty;
    group.items.push(item);
  }
  return [...groups.values()];
}

export const MMCart = {
  get: read,

  counts(): CartCounts {
    const c = read();
    const fixed = c.fixed.reduce((a, i) => a + (i.qty || 1), 0);
    return { fixed, total: fixed };
  },

  addFixed(item: Omit<FixedLineItem, 'id'>): Cart {
    const c = read();
    const existing = c.fixed.find(
      (i) => i.sku === item.sku && i.size === item.size && i.color === item.color
    );
    if (existing) {
      existing.qty += item.qty || 1;
    } else {
      c.fixed.push({ id: uid(), ...item });
    }
    return write(c);
  },

  setQty(id: string, qty: number): Cart {
    const c = read();
    const it = c.fixed.find((i) => i.id === id);
    if (it) it.qty = Math.max(1, qty);
    return write(c);
  },

  remove(id: string): Cart {
    const c = read();
    c.fixed = c.fixed.filter((i) => i.id !== id);
    return write(c);
  },

};
