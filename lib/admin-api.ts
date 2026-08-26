'use client';
import type { Order, PromoCode, Redemption, AdminUser, AdminRole, Location, DeliveryArea, SizeChart, Customer, NotificationLog, Review, Product } from '@/lib/types';
import type { Permissions } from '@/lib/permissions';

export interface InventoryItem {
  locationId: string;
  locationName: string;
  productId: string;
  productName: string;
  productImg: string;
  size: string;
  color: string;
  qty: number;
  physicalLocation: string;
}

export interface XfrRecord {
  id: string;
  fromId: string;
  fromName: string;
  toId: string;
  toName: string;
  productId: string;
  productName: string;
  size: string;
  color: string;
  qty: number;
  note: string | null;
  actor: string;
  date: string;
}

export interface PosOrderResult {
  ref: string;
  subtotal: number;
  deliveryFee: number;
  discount: number;
  total: number;
  paid: boolean;
  paidCash: number;
  paidTransfer: number;
  customer: string;
  method: 'Pickup' | 'Delivery';
  address: string | null;
  date: string;
  pdfUrl: string | null;
  receiptUrl?: string | null;
  items: Array<{ name: string; qty: number; price: number; size: string; color: string }>;
}

export interface ReferrerSummary {
  referrer: string;
  redemptions: number;
  sales: number;
  discount: number;
  commission: number;
}

/**
 * Client-side wrapper around the /api/admin/* endpoints. Throws an Error with
 * the server message on failure so callers can surface it. A 401 means the
 * session expired — callers should send the user back to the login page.
 */
export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

async function req<T = unknown>(url: string, method: string, body?: unknown): Promise<T> {
  const res = await fetch(url, {
    method,
    headers: body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(json.error || `Request failed (${res.status})`, res.status);
  return json as T;
}

export const adminApi = {
  // products
  listAllProducts: () => req<{ products: Product[] }>('/api/admin/products', 'GET'),
  createProduct: (body: Record<string, unknown>) => req('/api/admin/products', 'POST', body),
  updateProduct: (id: string, body: Record<string, unknown>) => req(`/api/admin/products/${id}`, 'PATCH', body),
  deleteProduct: (id: string) => req(`/api/admin/products/${id}`, 'DELETE'),

  // collections
  createCollection: (label: string, sizeChartId?: string | null) => req('/api/admin/collections', 'POST', { label, sizeChartId }),
  updateCollection: (id: string, label: string, sizeChartId?: string | null) => req(`/api/admin/collections/${id}`, 'PATCH', { label, sizeChartId }),
  deleteCollection: (id: string) => req(`/api/admin/collections/${id}`, 'DELETE'),

  // size charts
  listSizeCharts: () => req<{ sizeCharts: SizeChart[] }>('/api/admin/sizecharts', 'GET'),
  createSizeChart: (body: Record<string, unknown>) => req<{ sizeChart: SizeChart }>('/api/admin/sizecharts', 'POST', body),
  updateSizeChart: (id: string, body: Record<string, unknown>) => req<{ sizeChart: SizeChart }>(`/api/admin/sizecharts/${id}`, 'PATCH', body),
  deleteSizeChart: (id: string) => req(`/api/admin/sizecharts/${id}`, 'DELETE'),

  // categories
  createCategory: (name: string, collection: string) => req('/api/admin/categories', 'POST', { name, collection }),
  updateCategory: (id: string, body: Record<string, unknown>) => req(`/api/admin/categories/${id}`, 'PATCH', body),
  deleteCategory: (id: string) => req(`/api/admin/categories/${id}`, 'DELETE'),

  // orders
  listOrders: () => req<{ orders: Order[] }>('/api/admin/orders', 'GET'),
  createManualOrder: (body: Record<string, unknown>) => req<{ order: Order }>('/api/admin/orders', 'POST', body),
  updateOrder: (id: string, body: { stage?: number; paid?: boolean; paidCash?: number; paidTransfer?: number; balancePaid?: boolean }) => req<{ order: Order }>(`/api/admin/orders/${id}`, 'PATCH', body),
  generateOrderReceipt: (id: string) => req<{ url: string }>(`/api/admin/orders/${id}/receipt`, 'POST'),
  deleteOrder: (id: string) => req(`/api/admin/orders/${id}`, 'DELETE'),

  // settings
  updateSettings: (body: Record<string, unknown>) => req('/api/admin/settings', 'PATCH', body),
  testTelegram: (botToken: string, chatId: string) => req<{ username: string; chatId: string; lastTestAt: string | null; enabled: boolean }>('/api/admin/settings/telegram/test', 'POST', { botToken: botToken || undefined, chatId }),
  detectTelegramChats: (botToken: string) => req<{ chats: { id: string; title: string }[] }>('/api/admin/settings/telegram/detect-chat-id', 'POST', { botToken: botToken || undefined }),
  disconnectTelegram: () => req<{ disconnected: boolean }>('/api/admin/settings/telegram/disconnect', 'POST'),
  testEmail: (apiKey: string, emailFromUser: string, emailFromName: string, testRecipient: string) =>
    req<{ emailFromUser: string; emailFromName: string; lastTestAt: string | null; enabled: boolean }>('/api/admin/settings/email/test', 'POST', {
      apiKey: apiKey || undefined, emailFromUser, emailFromName, testRecipient,
    }),
  disconnectEmail: () => req<{ disconnected: boolean }>('/api/admin/settings/email/disconnect', 'POST'),
  testSms: (apiKey: string, senderId: string, testRecipient: string) =>
    req<{ senderId: string; lastTestAt: string | null; enabled: boolean }>('/api/admin/settings/sms/test', 'POST', { apiKey: apiKey || undefined, senderId, testRecipient }),
  disconnectSms: () => req<{ disconnected: boolean }>('/api/admin/settings/sms/disconnect', 'POST'),
  listNotificationPrefs: () => req<{ prefs: { event: string; emailEnabled: boolean; smsEnabled: boolean }[] }>('/api/admin/settings/notification-prefs', 'GET'),
  updateNotificationPrefs: (prefs: { event: string; emailEnabled: boolean; smsEnabled: boolean }[]) =>
    req<{ prefs: { event: string; emailEnabled: boolean; smsEnabled: boolean }[] }>('/api/admin/settings/notification-prefs', 'PATCH', { prefs }),

  // promo / referral codes
  listPromos: () => req<{ promos: PromoCode[] }>('/api/admin/promos', 'GET'),
  createPromo: (body: Record<string, unknown>) => req<{ promo: PromoCode }>('/api/admin/promos', 'POST', body),
  updatePromo: (id: string, body: Record<string, unknown>) => req<{ promo: PromoCode }>(`/api/admin/promos/${id}`, 'PATCH', body),
  deletePromo: (id: string) => req(`/api/admin/promos/${id}`, 'DELETE'),
  listRedemptions: () => req<{ redemptions: Redemption[]; referrers: ReferrerSummary[] }>('/api/admin/redemptions', 'GET'),

  // admin users (requires settingsUsers permission)
  getMe: () => req<{ email: string; role: AdminRole; permissions: Permissions }>('/api/admin/me', 'GET'),
  listUsers: () => req<{ users: AdminUser[] }>('/api/admin/users', 'GET'),
  createUser: (body: { email: string; password: string; role: AdminRole; permissions?: Permissions }) => req<{ user: AdminUser }>('/api/admin/users', 'POST', body),
  updateUser: (id: string, body: { role?: AdminRole; password?: string; permissions?: Permissions }) => req<{ user: AdminUser }>(`/api/admin/users/${id}`, 'PATCH', body),
  deleteUser: (id: string) => req(`/api/admin/users/${id}`, 'DELETE'),

  // locations
  createLocation: (body: Record<string, unknown>) => req<{ location: Location }>('/api/admin/locations', 'POST', body),
  updateLocation: (id: string, body: Record<string, unknown>) => req<{ location: Location }>(`/api/admin/locations/${id}`, 'PATCH', body),
  deleteLocation: (id: string) => req(`/api/admin/locations/${id}`, 'DELETE'),

  // delivery areas
  listDeliveryAreas: () => req<{ deliveryAreas: DeliveryArea[] }>('/api/admin/delivery-areas', 'GET'),
  createDeliveryArea: (body: Record<string, unknown>) => req<{ deliveryArea: DeliveryArea }>('/api/admin/delivery-areas', 'POST', body),
  updateDeliveryArea: (id: string, body: Record<string, unknown>) => req<{ deliveryArea: DeliveryArea }>(`/api/admin/delivery-areas/${id}`, 'PATCH', body),
  deleteDeliveryArea: (id: string) => req(`/api/admin/delivery-areas/${id}`, 'DELETE'),

  // cost prices (super-admin only)
  getCostPrices: () => req<{ products: { id: string; name: string; price: number; status: string; showInWebStore: boolean; costPrice: number }[] }>('/api/admin/products/cost-prices', 'GET'),

  // customers (read-only)
  listCustomers: () => req<{ customers: Customer[] }>('/api/admin/customers', 'GET'),

  // reviews
  listReviews: () => req<{ reviews: Review[] }>('/api/admin/reviews', 'GET'),
  approveReview: (id: string) => req<{ review: { id: string; status: string } }>(`/api/admin/reviews/${id}/approve`, 'POST'),
  rejectReview: (id: string, note?: string) => req<{ review: { id: string; status: string } }>(`/api/admin/reviews/${id}/reject`, 'POST', note ? { note } : undefined),
  setReviewFeatured: (id: string, featured: boolean) => req<{ review: { id: string; featured: boolean } }>(`/api/admin/reviews/${id}`, 'PATCH', { featured }),

  // notification delivery log (email + SMS)
  listNotifications: () => req<{ logs: NotificationLog[]; total: number }>('/api/admin/notifications', 'GET'),
  refreshNotificationStatus: () => req<{ checked: number; updated: number }>('/api/admin/notifications/refresh', 'POST'),

  // inventory
  listInventory: (locationId?: string) => req<{ inventory: InventoryItem[] }>(`/api/admin/inventory${locationId ? `?locationId=${encodeURIComponent(locationId)}` : ''}`, 'GET'),
  updateInventoryPlacement: (body: { locationId: string; productId: string; physicalLocation: string }) => req<{ placement: { locationId: string; productId: string; physicalLocation: string } }>('/api/admin/inventory', 'PATCH', body),
  receiveStock: (body: Record<string, unknown>) => req<{ row: unknown }>('/api/admin/inventory/receive', 'POST', body),
  listTransfers: () => req<{ transfers: XfrRecord[] }>('/api/admin/inventory/transfer', 'GET'),
  transferStock: (body: Record<string, unknown>) => req<{ transfer: unknown }>('/api/admin/inventory/transfer', 'POST', body),
  adjustStock: (body: Record<string, unknown>) => req<{ row: unknown }>('/api/admin/inventory/adjust', 'POST', body),

  // POS order
  createPosOrder: (body: Record<string, unknown>) => req<PosOrderResult>('/api/pos/order', 'POST', body),

  // auth
  logout: () => req('/api/admin/logout', 'POST'),
};
