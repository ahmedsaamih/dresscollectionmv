import type { Metadata } from 'next';
import './globals.css';
import { CartProvider } from '@/contexts/CartContext';
import { StoreProvider } from '@/contexts/StoreContext';

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
    <html lang="en">
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
