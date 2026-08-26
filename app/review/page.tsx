import React from 'react';
import type { Metadata } from 'next';
import { ReviewClient } from './ReviewClient';

// Token-gated review-submission form — no content without a valid ?token,
// and nothing generic worth ranking on. Also disallowed in robots.ts.
export const metadata: Metadata = {
  title: 'Leave a Review',
  robots: { index: false, follow: false },
};

export default function ReviewPage() {
  return <ReviewClient />;
}
