import React from 'react';
import { StoreProvider } from '@/contexts/StoreContext';

/**
 * Scopes the live-catalog client fetch (StoreProvider's /api/store call) to
 * the admin section only — its one remaining consumer since the storefront
 * pages were converted to Server Components fetching via getCatalog(). Used
 * to wrap every /admin route unconditionally rather than a fetch here.
 */
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <StoreProvider>{children}</StoreProvider>;
}
