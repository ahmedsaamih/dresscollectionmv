'use client';
import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { MMCart } from '@/lib/cart';
import type { Cart, CartCounts } from '@/lib/types';

interface CartContextValue {
  cart: Cart;
  counts: CartCounts;
  refresh: () => void;
}

const CartContext = createContext<CartContextValue>({
  cart: { fixed: [] },
  counts: { fixed: 0, total: 0 },
  refresh: () => {},
});

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [cart, setCart] = useState<Cart>({ fixed: [] });

  const refresh = useCallback(() => {
    setCart(MMCart.get());
  }, []);

  useEffect(() => {
    refresh();
    window.addEventListener('mm-cart-change', refresh);
    window.addEventListener('storage', refresh);
    return () => {
      window.removeEventListener('mm-cart-change', refresh);
      window.removeEventListener('storage', refresh);
    };
  }, [refresh]);

  const counts = MMCart.counts();

  return (
    <CartContext.Provider value={{ cart, counts, refresh }}>
      {children}
    </CartContext.Provider>
  );
}

export const useCart = () => useContext(CartContext);
