import React from 'react';
import type { Metadata } from 'next';
import { FaqClient } from './FaqClient';

export const metadata: Metadata = {
  title: 'Frequently Asked Questions',
  description: 'Everything about ordering, sizing, payment and delivery at Dress Collection.',
  alternates: { canonical: '/faq' },
  openGraph: { url: '/faq' },
};

export default function FAQPage() {
  return <FaqClient />;
}
