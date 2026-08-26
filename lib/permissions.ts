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
  | 'dashboard' | 'products' | 'categories'
  | 'orders' | 'promos' | 'sizechart' | 'customers' | 'reviews'
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
  { key: 'orders', label: 'Orders', group: 'Core' },
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

