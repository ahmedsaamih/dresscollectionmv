import React from 'react';
import type { Metadata } from 'next';
import { SearchClient } from './SearchClient';

// Query-string-driven results, thin/duplicate of the collection pages —
// also disallowed in robots.ts.
export const metadata: Metadata = {
  title: 'Search',
  robots: { index: false, follow: false },
};

export default function SearchPage() {
  return <SearchClient />;
}
