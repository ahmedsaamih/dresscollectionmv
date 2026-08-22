'use client';
import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { MMStore } from '@/lib/store';
import type { StoreData } from '@/lib/types';

interface StoreContextValue {
  data: StoreData;
  refresh: () => void;
  save: (d: StoreData) => void;
  loading: boolean;
}

const StoreContext = createContext<StoreContextValue>({
  data: MMStore.seed(),
  refresh: () => {},
  save: () => {},
  loading: false,
});

export function StoreProvider({ children }: { children: React.ReactNode }) {
  // Always initialize from the static SEED so SSR output matches the client's
  // first render exactly (localStorage is unavailable on the server).
  // After mount, useEffect loads any cached localStorage snapshot, then
  // refresh() pulls the live DB catalog.
  const [data, setData] = useState<StoreData>(MMStore.seed());
  const [loading, setLoading] = useState(true);

  // Pull the live catalog (settings, collections, categories, products,
  // builderOptions) from the DB. Orders/quotes are NOT returned by /api/store —
  // they stay on the local snapshot until Phase 6 gives admin an authed source.
  const refresh = useCallback(async () => {
    try {
      const res = await fetch('/api/store', { cache: 'no-store' });
      if (!res.ok) return;
      const live = (await res.json()) as Partial<StoreData>;
      setData((prev) => {
        const next = { ...prev, ...live };
        MMStore.save(next);
        return next;
      });
    } catch {
      /* keep last-known snapshot on network failure */
    } finally {
      setLoading(false);
    }
  }, []);

  // Local writes (admin edits until Phase 6) persist to the snapshot and update
  // the shared context immediately.
  const save = useCallback((d: StoreData) => {
    MMStore.save(d);
    setData(d);
  }, []);

  useEffect(() => {
    // Apply any localStorage cache immediately for a fast first paint,
    // then let refresh() overwrite with the authoritative DB data.
    const cached = MMStore.get();
    if (cached.products && cached.products.length > 0) {
      setData(cached);
    }
    refresh();
  }, [refresh]);

  return (
    <StoreContext.Provider value={{ data, refresh, save, loading }}>
      {children}
    </StoreContext.Provider>
  );
}

export const useStore = () => useContext(StoreContext);
