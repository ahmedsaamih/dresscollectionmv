import type { Metadata } from 'next';
import { Archivo, Archivo_Narrow, Fraunces } from 'next/font/google';
import './globals.css';
import { CartProvider } from '@/contexts/CartContext';
import { StoreProvider } from '@/contexts/StoreContext';

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

export const metadata: Metadata = {
  title: 'Dress Collection — Womenswear, Delivered',
  description:
    'Dress Collection is an online-only womenswear boutique. Browse new arrivals, casual dresses, occasion wear and accessories — delivered to your door across the Maldives.',
  keywords: ['dresses', 'womenswear', 'online boutique', 'Maldives', 'occasion wear', 'delivery'],
  icons: {
    icon: [
      { url: '/favicon-32.png', sizes: '32x32', type: 'image/png' },
      { url: '/favicon-16.png', sizes: '16x16', type: 'image/png' },
    ],
    apple: '/favicon-192.png',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${archivo.variable} ${archivoNarrow.variable} ${fraunces.variable}`}>
      <body className="min-h-screen bg-page text-body font-archivo antialiased">
        <StoreProvider>
          <CartProvider>
            {children}
          </CartProvider>
        </StoreProvider>
      </body>
    </html>
  );
}
