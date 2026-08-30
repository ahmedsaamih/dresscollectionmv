import type { Metadata } from 'next';
import { Archivo, Archivo_Narrow, Fraunces, Playfair_Display } from 'next/font/google';
import './globals.css';
import { CartProvider } from '@/contexts/CartContext';
import { SITE_URL } from '@/lib/site';

// `font-archivo` / `font-archivo-narrow` are used throughout the app (this
// file's CSS variable names must match app/globals.css's --font-archivo /
// --font-archivo-narrow, and app/tailwind.config.ts's fontFamily keys) —
// previously these named a font that was never actually loaded anywhere, so
// every browser silently fell back to the OS default UI font.
const archivo = Archivo({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800', '900'],
  variable: '--font-archivo',
  display: 'swap',
});
const archivoNarrow = Archivo_Narrow({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-archivo-narrow',
  display: 'swap',
});
// Small editorial-serif garnish — italic only, used sparingly for boutique
// warmth (testimonial quote marks, a story-headline accent word). Never used
// for body copy, buttons, or nav.
const fraunces = Fraunces({
  subsets: ['latin'],
  weight: ['500', '600'],
  style: ['italic'],
  variable: '--font-fraunces',
  display: 'swap',
});
// Headline/logo serif — tall, thin, high-contrast, letter-spaced. Used for
// the logo wordmark and editorial headlines (hero, section titles). Never
// used for body copy or buttons.
const playfair = Playfair_Display({
  subsets: ['latin'],
  weight: ['500', '600', '700'],
  variable: '--font-playfair',
  display: 'swap',
});

const SITE_NAME = 'Dress Collection';
const SITE_DESCRIPTION =
  'Dress Collection is an online-only womenswear boutique. Browse new arrivals, casual dresses, occasion wear and accessories — delivered to your door across the Maldives.';

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: `${SITE_NAME} — Womenswear, Delivered`,
    template: `%s | ${SITE_NAME}`,
  },
  description: SITE_DESCRIPTION,
  keywords: ['dresses', 'womenswear', 'online boutique', 'Maldives', 'occasion wear', 'delivery'],
  icons: {
    icon: [
      { url: '/favicon-32.png', sizes: '32x32', type: 'image/png' },
      { url: '/favicon-16.png', sizes: '16x16', type: 'image/png' },
    ],
    apple: '/apple-touch-icon.png',
  },
  openGraph: {
    type: 'website',
    siteName: SITE_NAME,
    title: `${SITE_NAME} — Womenswear, Delivered`,
    description: SITE_DESCRIPTION,
    url: '/',
    images: [{ url: '/logo-full.png' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: `${SITE_NAME} — Womenswear, Delivered`,
    description: SITE_DESCRIPTION,
    images: ['/logo-full.png'],
  },
};

const organizationJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'Organization',
  name: SITE_NAME,
  url: SITE_URL,
  logo: `${SITE_URL}/logo-full.png`,
  description: SITE_DESCRIPTION,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${archivo.variable} ${archivoNarrow.variable} ${fraunces.variable} ${playfair.variable}`}>
      <body className="min-h-screen bg-page text-body font-archivo antialiased">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationJsonLd) }}
        />
        <CartProvider>
          {children}
        </CartProvider>
      </body>
    </html>
  );
}
