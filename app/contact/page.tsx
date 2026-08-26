import React from 'react';
import type { Metadata } from 'next';
import { ContactClient } from './ContactClient';

export const metadata: Metadata = {
  title: 'Contact Us',
  description: "Questions about an order, sizing, or a custom request? Get in touch with Dress Collection — we're online only, so this is the fastest way to reach us.",
  alternates: { canonical: '/contact' },
  openGraph: { url: '/contact' },
};

export default function ContactPage() {
  return <ContactClient />;
}
