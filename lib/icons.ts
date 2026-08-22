import {
  LayoutDashboard, Boxes, Layers, ShoppingCart,
  Tag, Ruler, Settings, Store, Users, Package, Shirt,
  Home, Truck, DollarSign, CreditCard, ArrowLeftRight, Sparkles,
  type LucideIcon,
} from 'lucide-react';

/** Admin sidebar nav — keyed by the same tab key used in adminNavItems / Tab. */
export const ADMIN_NAV_ICONS: Record<string, LucideIcon> = {
  dashboard: LayoutDashboard,
  products: Boxes,
  categories: Layers,
  orders: ShoppingCart,
  promos: Tag,
  sizechart: Ruler,
  settings: Settings,
  pos: Store,
  customers: Users,
};

/** Homepage category cards. */
export const CATEGORY_ICONS: Record<string, LucideIcon> = {
  ready: Package,
  occasion: Sparkles,
  casual: Shirt,
  accessories: Boxes,
};

/** POS order fulfillment method. */
export const FULFILLMENT_ICONS: Record<'Pickup' | 'Delivery', LucideIcon> = {
  Pickup: Home,
  Delivery: Truck,
};

/** POS payment method. */
export const PAYMENT_METHOD_ICONS: Record<'Cash' | 'Card' | 'Transfer', LucideIcon> = {
  Cash: DollarSign,
  Card: CreditCard,
  Transfer: ArrowLeftRight,
};
