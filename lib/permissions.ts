/**
 * Per-module access control. Replaces the old fixed-role (admin/manager/
 * pos_user/quotation_approver) tab-visibility map. `admin` accounts always
 * have full access and bypass this entirely; `staff` accounts are granted
 * none/read/edit per module by an admin, via the Users screen.
 *
 * Shared by server route guards (lib/admin-guard.ts) and the client admin UI
 * (app/admin/page.tsx) so the module list, grouping, and labels never drift
 * apart between what's enforced and what's displayed.
 */

export type PermLevel = 'none' | 'read' | 'edit';

export type ModuleKey =
  | 'dashboard' | 'products' | 'categories' | 'builder' | 'customization'
  | 'orders' | 'quotes' | 'quoteApprovals' | 'promos' | 'sizechart' | 'customers' | 'reviews'
  | 'settingsGeneral' | 'settingsLocations' | 'settingsUsers'
  | 'posSales' | 'posOrders' | 'posDeliveries' | 'posReturns' | 'posInventory' | 'posTransfers';

export type Permissions = Partial<Record<ModuleKey, PermLevel>>;

export interface SessionLike {
  role: 'admin' | 'staff';
  permissions?: Permissions | null;
}

const RANK: Record<PermLevel, number> = { none: 0, read: 1, edit: 2 };

/** True if the session has at least `need` access to `module`. Admins always pass. */
export function hasPermission(session: SessionLike | null | undefined, module: ModuleKey, need: 'read' | 'edit'): boolean {
  if (!session) return false;
  if (session.role === 'admin') return true;
  const level = session.permissions?.[module] ?? 'none';
  return RANK[level] >= RANK[need];
}

export interface ModuleDef {
  key: ModuleKey;
  label: string;
  group: 'Core' | 'Settings' | 'Point of Sale';
}

/** Full module list, in display order, grouped for the permission grid & sidebar. */
export const MODULES: ModuleDef[] = [
  { key: 'dashboard', label: 'Dashboard', group: 'Core' },
  { key: 'products', label: 'Products', group: 'Core' },
  { key: 'categories', label: 'Collections', group: 'Core' },
  { key: 'builder', label: 'Builder Options', group: 'Core' },
  { key: 'customization', label: 'Customization', group: 'Core' },
  { key: 'orders', label: 'Orders', group: 'Core' },
  { key: 'quotes', label: 'Quotes', group: 'Core' },
  { key: 'quoteApprovals', label: 'Quote Approvals', group: 'Core' },
  { key: 'promos', label: 'Promo Codes', group: 'Core' },
  { key: 'sizechart', label: 'Size Chart', group: 'Core' },
  { key: 'customers', label: 'Customers', group: 'Core' },
  { key: 'reviews', label: 'Reviews', group: 'Core' },
  { key: 'settingsGeneral', label: 'General Settings', group: 'Settings' },
  { key: 'settingsLocations', label: 'Inventory Locations', group: 'Settings' },
  { key: 'settingsUsers', label: 'Team & Permissions', group: 'Settings' },
  { key: 'posSales', label: 'Sales Terminal', group: 'Point of Sale' },
  { key: 'posOrders', label: 'POS Sales', group: 'Point of Sale' },
  { key: 'posDeliveries', label: 'Deliveries', group: 'Point of Sale' },
  { key: 'posReturns', label: 'Returns', group: 'Point of Sale' },
  { key: 'posInventory', label: 'Inventory', group: 'Point of Sale' },
  { key: 'posTransfers', label: 'Transfers', group: 'Point of Sale' },
];

export const MODULE_KEYS: ModuleKey[] = MODULES.map(m => m.key);

/** One-time migration mapping from the legacy roles to their equivalent permission grid. */
export const LEGACY_ROLE_PERMISSIONS: Record<'manager' | 'pos_user' | 'quotation_approver', Permissions> = {
  manager: {
    dashboard: 'edit', products: 'edit', categories: 'edit', builder: 'edit', customization: 'edit',
    orders: 'edit', quotes: 'edit', promos: 'edit', sizechart: 'edit', customers: 'edit',
    posSales: 'edit', posOrders: 'edit', posDeliveries: 'edit', posReturns: 'edit', posInventory: 'edit', posTransfers: 'edit',
  },
  pos_user: {
    dashboard: 'edit', quotes: 'edit', customers: 'edit',
    orders: 'read', posInventory: 'read',
    posSales: 'edit', posOrders: 'edit', posDeliveries: 'edit', posReturns: 'edit', posTransfers: 'edit',
  },
  quotation_approver: {
    dashboard: 'edit', products: 'edit', categories: 'edit', builder: 'edit', customization: 'edit',
    orders: 'edit', quotes: 'edit', promos: 'edit', sizechart: 'edit', customers: 'edit',
    posSales: 'edit', posOrders: 'edit', posDeliveries: 'edit', posReturns: 'edit', posInventory: 'edit', posTransfers: 'edit',
    quoteApprovals: 'edit', settingsGeneral: 'edit',
  },
};
