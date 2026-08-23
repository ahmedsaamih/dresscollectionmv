'use client';
import React, { useState, useEffect, useCallback, useRef } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useStore } from '@/contexts/StoreContext';
import { adminApi, ApiError, type ReferrerSummary, type InventoryItem, type XfrRecord, type PosOrderResult } from '@/lib/admin-api';
import { ORDER_STAGES, STAGE_META, formatMVR, PICKUP_STAGE_IDS, DELIVERY_STAGE_IDS, PRODUCT_SIZES, COLOR_MAP, productColorHex } from '@/lib/utils';
import { ORDER_NOTIFICATION_EVENTS, NOTIFICATION_EVENT_LABELS } from '@/lib/notify/event-labels';
import type { Order, SizeChart, PromoCode, Redemption, AdminUser, AdminRole, Product, ProductSection, Customer, NotificationLog, Review, DeliveryArea } from '@/lib/types';
import { hasPermission, MODULES, type ModuleKey, type Permissions } from '@/lib/permissions';
import { STOREFRONT_COPY_GROUPS, normalizeStorefrontCopy } from '@/lib/storefront-copy';
import { ADMIN_NAV_ICONS, FULFILLMENT_ICONS, PAYMENT_METHOD_ICONS } from '@/lib/icons';
import { StarRating } from '@/components/StarRating';
import {
  LayoutDashboard, Boxes, Layers, ShoppingCart,
  Tag, Ruler, Store, Receipt, Truck, Undo2, ArrowLeftRight,
  Percent, RefreshCw, Download, Info, Trash2, Pencil, X,
  Check, ArrowUpRight, LogOut, Star, DollarSign, MapPin, Users, Menu,
  ChevronDown, Phone, CheckCircle2,
  type LucideIcon,
} from 'lucide-react';

type Tab = 'dashboard' | 'products' | 'categories' | 'orders' | 'settings' | 'sizechart' | 'promos' | 'pos' | 'customers';
type OrderFilter = 'all' | 'web_checkout' | 'pos_sale' | 'manual_order' | 'quote_conversion' | 'paid' | 'unpaid';
type Session = { email: string; role: AdminRole; permissions: Permissions } | null;

const ALL_TABS: Tab[] = ['dashboard', 'products', 'categories', 'orders', 'promos', 'sizechart', 'settings', 'pos', 'customers'];
// Which module gates each top-level tab. 'settings' and 'pos' are handled
// separately below since each covers several sub-modules.
const TAB_MODULE: Partial<Record<Tab, ModuleKey>> = {
  dashboard: 'dashboard', products: 'products', categories: 'categories',
  orders: 'orders', promos: 'promos', sizechart: 'sizechart', customers: 'customers',
};
const SETTINGS_MODULES: ModuleKey[] = ['settingsGeneral', 'settingsLocations', 'settingsUsers'];
const POS_MODULES: ModuleKey[] = ['posSales', 'posOrders', 'posDeliveries', 'posReturns', 'posInventory', 'posTransfers'];
const POS_TAB_MODULE: Record<'sales' | 'orders' | 'deliveries' | 'returns' | 'inventory' | 'transfers', ModuleKey> = {
  sales: 'posSales', orders: 'posOrders', deliveries: 'posDeliveries', returns: 'posReturns', inventory: 'posInventory', transfers: 'posTransfers',
};
const CUSTOMERS_TAB_MODULE: Record<'list' | 'reviews' | 'notifications', ModuleKey> = { list: 'customers', reviews: 'reviews', notifications: 'customers' };

/** True if a tab should be visible to this session — admin always sees everything. */
function tabVisible(tab: Tab, session: Session): boolean {
  if (tab === 'settings') return SETTINGS_MODULES.some(m => hasPermission(session, m, 'read'));
  if (tab === 'pos') return POS_MODULES.some(m => hasPermission(session, m, 'read'));
  const key = TAB_MODULE[tab];
  return key ? hasPermission(session, key, 'read') : false;
}

const ROLE_LABEL: Record<AdminRole, string> = { admin: 'Admin', staff: 'Staff' };

// ─── helpers ────────────────────────────────────────────────────────────────
const GRADIENTS = [
  'linear-gradient(150deg,#8a1d50,#36021a)', 'linear-gradient(150deg,#600a32,#200c15)',
  'linear-gradient(150deg,#16302a,#080808)', 'linear-gradient(150deg,#c13978,#600a32)',
  'linear-gradient(150deg,#db5795,#600a32)', 'linear-gradient(150deg,#200c15,#1a1a1a)',
  'linear-gradient(135deg,#ff3d4d,#200c15)', 'linear-gradient(150deg,#36021a,#080808)',
];

function inventoryStockForVariant(rows: InventoryItem[], productId: string, color: string, size: string): number {
  return rows.find(r => r.productId === productId && r.color === (color || '') && r.size === (size || ''))?.qty ?? 0;
}

function inventoryPhysicalLocation(rows: InventoryItem[], productId: string): string {
  return rows.find(r => r.productId === productId)?.physicalLocation?.trim() ?? '';
}

function firstAvailableColor(rows: InventoryItem[], product: Product): string {
  return product.colors.find(c => {
    if (product.sizes.length === 0) return inventoryStockForVariant(rows, product.id, c, '') > 0;
    return product.sizes.some(s => inventoryStockForVariant(rows, product.id, c, s) > 0);
  }) ?? product.colors[0] ?? '';
}

function firstAvailableSize(rows: InventoryItem[], product: Product, color: string): string {
  return product.sizes.find(s => inventoryStockForVariant(rows, product.id, color, s) > 0) ?? product.sizes[0] ?? '';
}

function sumColorSizeStock(colorSizeStock: Record<string, Record<string, number>>): number {
  return Object.values(colorSizeStock).reduce((a, bySize) => a + Object.values(bySize).reduce((x, y) => x + y, 0), 0);
}

// Per-size totals summed across colours — used for the legacy sizeStock/sizeAdjustments display fields.
function sizeStockFromColorSize(colorSizeStock: Record<string, Record<string, number>>): Record<string, number> {
  const out: Record<string, number> = {};
  for (const bySize of Object.values(colorSizeStock)) {
    for (const [size, qty] of Object.entries(bySize)) {
      if (size === '') continue;
      out[size] = (out[size] ?? 0) + qty;
    }
  }
  return out;
}

function statusMeta(s: 'active' | 'soldout' | 'draft') {
  return s === 'active' ? { fg: '#600a32', bg: 'rgba(219,87,149,.12)', label: 'Active' }
       : s === 'soldout' ? { fg: '#e81a2b', bg: 'rgba(255,61,77,.12)', label: 'Sold out' }
       : { fg: '#705260', bg: 'rgba(0,0,0,.08)', label: 'Draft' };
}

function NavBtn({ label, icon: Icon, badge, active, onClick, coming }: { label: string; icon: LucideIcon; badge?: string; active: boolean; onClick: () => void; coming?: boolean }) {
  return (
    <button type="button" aria-current={active ? 'page' : undefined} onClick={coming ? undefined : onClick} className="flex items-center gap-3 rounded-lg py-[11px] px-3 font-archivo text-left transition-all w-full"
      style={{ background: active ? 'rgba(219,87,149,.08)' : 'transparent', border: 'none', borderLeft: active ? '3px solid #db5795' : '3px solid transparent', color: coming ? '#b29fa8' : active ? '#150d11' : '#705260', fontWeight: active ? 700 : 500, fontSize: 13.5, cursor: coming ? 'default' : 'pointer' }}>
      <span style={{ width: 20, display: 'inline-flex', justifyContent: 'center', color: coming ? '#d3c6cc' : active ? '#600a32' : '#907481' }}><Icon size={15} /></span>
      <span className="flex-1">{label}</span>
      {coming && <span className="text-[9px] font-extrabold uppercase text-[#d3c6cc] bg-[rgba(219,87,149,.06)] border border-[rgba(219,87,149,.12)] px-[7px] py-[2px] rounded-full tracking-[.08em]">Soon</span>}
      {!coming && badge && <span className="text-[10.5px] font-extrabold text-[#200612] bg-rose-500 px-[7px] py-[1px] rounded-full tabular">{badge}</span>}
    </button>
  );
}

function FieldInput({ label, value, onChange, placeholder, maxLength }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string; maxLength?: number }) {
  return (
    <div className="mb-[13px]">
      <label className="text-[11.5px] font-semibold text-sub block mb-[6px]">{label}</label>
      <input value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder ?? ''} maxLength={maxLength}
        className="w-full bg-well border border-[rgba(0,0,0,.12)] rounded-[9px] px-[13px] py-[10px] text-body font-archivo text-[13.5px] outline-none focus:border-rose-500" />
      {maxLength && <div className="text-[10.5px] text-muted mt-[5px] text-right tabular">{value.length}/{maxLength}</div>}
    </div>
  );
}

function CostPriceRow({ product, saving, onSave }: { product: { id: string; name: string; price: number; status: string; showInWebStore: boolean; costPrice: number }; saving: boolean; onSave: (id: string, costPrice: number) => void }) {
  const [value, setValue] = useState(String(product.costPrice));
  useEffect(() => { setValue(String(product.costPrice)); }, [product.costPrice]);
  const dirty = (parseInt(value) || 0) !== product.costPrice;
  return (
    <div className="grid px-[18px] py-[10px] border-b border-[rgba(0,0,0,.07)] items-center" style={{ gridTemplateColumns: '1fr .5fr .6fr .8fr 90px' }}>
      <div className="min-w-0">
        <div className="text-[13px] font-semibold truncate">{product.name}</div>
        {!product.showInWebStore && <div className="text-[10.5px] text-muted mt-[2px]">POS-only</div>}
      </div>
      <span className="text-[12px] text-sub capitalize">{product.status}</span>
      <span className="text-[12.5px] tabular text-sub">{formatMVR(product.price)}</span>
      <div>
        <input type="number" min="0" value={value} onChange={e => setValue(e.target.value)}
          className="w-full bg-well border border-[rgba(0,0,0,.12)] rounded-[8px] px-[10px] py-[7px] text-[12.5px] tabular outline-none focus:border-rose-500" />
        {(parseInt(value) || 0) > product.price && (
          <div className="text-[10.5px] text-amber-400 mt-[3px]">Sells at a loss</div>
        )}
      </div>
      <div className="flex justify-end">
        <button onClick={() => onSave(product.id, parseInt(value) || 0)} disabled={saving || !dirty}
          className="border border-[rgba(219,87,149,.35)] bg-[rgba(219,87,149,.06)] text-rose-700 font-bold text-[11.5px] px-[12px] py-[6px] rounded-[7px] cursor-pointer disabled:opacity-40">
          {saving ? '…' : 'Save'}
        </button>
      </div>
    </div>
  );
}

function orderOriginMeta(o: Order) {
  const origin = o.origin || (o.quoteRef ? 'quote_conversion' : o.source === 'pos' ? 'pos_sale' : 'web_checkout');
  return origin === 'pos_sale' ? { label: 'POS Sale', tone: '#705260', bg: 'rgba(0,0,0,.08)', border: 'rgba(0,0,0,.12)' }
       : origin === 'manual_order' ? { label: 'Manual', tone: '#f5c842', bg: 'rgba(245,200,66,.1)', border: 'rgba(245,200,66,.25)' }
       : origin === 'quote_conversion' ? { label: 'Quote', tone: '#f5c842', bg: 'rgba(245,200,66,.1)', border: 'rgba(245,200,66,.25)' }
       : { label: 'Online', tone: '#600a32', bg: 'rgba(219,87,149,.07)', border: 'rgba(219,87,149,.18)' };
}

function stageOptionsFor(o: Pick<Order, 'method'>) {
  return (o.method === 'Delivery' ? DELIVERY_STAGE_IDS : PICKUP_STAGE_IDS).map(i => ({ value: i, label: ORDER_STAGES[i] }));
}

function daysSinceReady(o: Order) {
  const source = o.readyForDeliveryAt ? new Date(o.readyForDeliveryAt) : new Date(o.date);
  if (Number.isNaN(source.getTime())) return 0;
  return Math.max(0, Math.floor((Date.now() - source.getTime()) / 86400000));
}

// mobile is free-form (digits, +, -, spaces, parens — see optionalMobile in lib/validation.ts);
// tel: needs just digits and a leading +. Returns null when there's nothing dialable.
function telHref(mobile: string | null | undefined): string | null {
  const cleaned = (mobile ?? '').replace(/[^\d+]/g, '');
  return cleaned ? `tel:${cleaned}` : null;
}

function paymentSlip(o: Order) {
  return o.receipts?.find(r => r.kind === 'payment_slip') ?? null;
}

function paymentReceipt(o: Order) {
  return o.receipts?.find(r => r.kind === 'payment_receipt') ?? null;
}

// ─── main component ──────────────────────────────────────────────────────────
export default function AdminPage() {
  const router = useRouter();
  const { data, refresh } = useStore();
  const [tab, setTab] = useState<Tab>('dashboard');
  const [search, setSearch] = useState('');
  const [colFilter, setColFilter] = useState('all');
  const [modal, setModal] = useState<{ kind: string; id: string | null; draft: Record<string, any>; error: string } | null>(null);
  const [colorInput, setColorInput] = useState('');
  const [confirm, setConfirm] = useState<{ kind: string; id: string; key?: string; name: string; detail?: string } | null>(null);
  const [toast, setToast] = useState('');
  const [saving, setSaving] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  // Current logged-in user (role-aware nav).
  const [currentUser, setCurrentUser] = useState<Session>(null);

  // Admin user management (admin-only).
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [userModal, setUserModal] = useState<{ id: string | null; draft: Record<string, any>; error: string } | null>(null);

  // Product image upload.
  const imgInputRef = useRef<HTMLInputElement>(null);
  const [imgUploading, setImgUploading] = useState(false);

  // Per-colour product image upload.
  const [colorImgUploading, setColorImgUploading] = useState<Record<string, boolean>>({});

  // Homepage hero image upload.
  const heroImgInputRef = useRef<HTMLInputElement>(null);
  const [heroImgUploading, setHeroImgUploading] = useState(false);

  // Homepage hero carousel images upload.
  const heroCarouselImgInputRef = useRef<HTMLInputElement>(null);
  const [heroCarouselImgUploading, setHeroCarouselImgUploading] = useState(false);

  // Homepage workshop image upload.
  const workshopImgInputRef = useRef<HTMLInputElement>(null);
  const [workshopImgUploading, setWorkshopImgUploading] = useState(false);

  // Homepage category card background images.
  const categoryImgInputRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const [categoryImgUploading, setCategoryImgUploading] = useState<Record<string, boolean>>({});
  const CATEGORY_IMAGE_FIELDS: { key: 'categoryReadyImage' | 'categoryCustomImage' | 'categoryCasualImage' | 'categoryAccessoriesImage'; label: string }[] = [
    { key: 'categoryReadyImage', label: 'Ready-Made' },
    { key: 'categoryCustomImage', label: 'Party & Occasion' },
    { key: 'categoryCasualImage', label: 'Casual Wear' },
    { key: 'categoryAccessoriesImage', label: 'Accessories' },
  ];

  // Slip viewer modal.
  const [slipModal, setSlipModal] = useState<{ url: string; expired: boolean } | null>(null);
  const [slipLoadFailed, setSlipLoadFailed] = useState(false);

  // Mark-paid amount entry modal (cash/card/transfer breakdown for orders with no
  // per-method amounts recorded yet — e.g. quote conversions, web-checkout orders).
  const [markPaidModal, setMarkPaidModal] = useState<{ orderId: string; total: number } | null>(null);
  const [markPaidDraft, setMarkPaidDraft] = useState({ paidCash: '', paidCard: '', paidTransfer: '' });
  const [markPaidError, setMarkPaidError] = useState('');
  const [markPaidSaving, setMarkPaidSaving] = useState(false);

  // Orders come straight from the DB (admin-only, not in /api/store).
  const [orders, setOrders] = useState<Order[]>([]);
  const [orderFilter, setOrderFilter] = useState<OrderFilter>('all');

  // Customers (read-only, admin-only, not in /api/store).
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [customersSubTab, setCustomersSubTab] = useState<'list' | 'reviews' | 'notifications'>('list');

  // Reviews (submitted via the customer review link, moderated here).
  const [reviews, setReviews] = useState<Review[]>([]);

  // Email/SMS delivery log (read-only, admin-only, not in /api/store).
  const [notifications, setNotifications] = useState<NotificationLog[]>([]);
  const [refreshingNotifications, setRefreshingNotifications] = useState(false);
  const [notifSearch, setNotifSearch] = useState('');
  const [notifChannelFilter, setNotifChannelFilter] = useState('');
  const [notifStatusFilter, setNotifStatusFilter] = useState('');
  const [notifEventFilter, setNotifEventFilter] = useState('');

  // Per-event Email/SMS channel toggles (Admin → Settings).
  const [notificationPrefs, setNotificationPrefs] = useState<{ event: string; emailEnabled: boolean; smsEnabled: boolean }[]>([]);

  // Promo / referral codes + redemption ledger.
  const [promos, setPromos] = useState<PromoCode[]>([]);
  const [redemptions, setRedemptions] = useState<Redemption[]>([]);
  const [referrers, setReferrers] = useState<ReferrerSummary[]>([]);
  const [promoModal, setPromoModal] = useState<{ id: string | null; draft: Record<string, any>; error: string } | null>(null);

  // ── Order drawer + manual creation ──
  const [orderDrawer, setOrderDrawer] = useState<Order | null>(null);
  const [manualOrderModal, setManualOrderModal] = useState(false);
  type ManualOrderLine = { sku: string; name: string; meta: string; img: string; size: string; color: string; qty: number; unitPrice: number };
  const [manualOrderDraft, setManualOrderDraft] = useState({ customer: '', email: '', mobile: '', discount: '0', discountNote: '', method: 'Pickup' as 'Pickup' | 'Delivery', address: '', deliveryAreaId: '', paidCash: '', paidCard: '', paidTransfer: '', notes: '', locationId: '' });
  const [manualOrderLines, setManualOrderLines] = useState<ManualOrderLine[]>([]);
  const [manualOrderInvRows, setManualOrderInvRows] = useState<InventoryItem[]>([]);
  const [manualOrderProductId, setManualOrderProductId] = useState('');
  const [manualOrderSize, setManualOrderSize] = useState('');
  const [manualOrderColor, setManualOrderColor] = useState('');
  const [manualOrderQty, setManualOrderQty] = useState(1);
  const [manualOrderSaving, setManualOrderSaving] = useState(false);
  const [manualOrderError, setManualOrderError] = useState('');

  // ── POS ──
  type PosCartItem = { sku: string; name: string; meta: string; img: string; size: string; color: string; qty: number; unitPrice: number };
  const [posTab, setPosTab] = useState<'sales' | 'orders' | 'deliveries' | 'returns' | 'inventory' | 'transfers' | 'costPrice'>('sales');
  // Sales terminal
  const [posLocId, setPosLocId] = useState('');
  const [posInvRows, setPosInvRows] = useState<InventoryItem[]>([]);
  const [posInvLoading, setPosInvLoading] = useState(false);
  const [posSearch, setPosSearch] = useState('');
  const [posColFilter, setPosColFilter] = useState('all');
  const [posCart, setPosCart] = useState<PosCartItem[]>([]);
  const [posAddItem, setPosAddItem] = useState<Product | null>(null);
  const [posAddSize, setPosAddSize] = useState('');
  const [posAddColor, setPosAddColor] = useState('');
  const [posAddQty, setPosAddQty] = useState(1);
  const [posCustomer, setPosCustomer] = useState({ name: '', mobile: '', email: '' });
  const [posMethod, setPosMethod] = useState<'Pickup' | 'Delivery'>('Pickup');
  const [posAddress, setPosAddress] = useState('');
  const [posDeliveryAreaId, setPosDeliveryAreaId] = useState('');
  const [posCash, setPosCash] = useState('');
  const [posCard, setPosCard] = useState('');
  const [posTransfer, setPosTransfer] = useState('');
  const [posPaymentMethod, setPosPaymentMethod] = useState<'Cash' | 'Card' | 'Transfer'>('Cash');
  const [posPaymentSplit, setPosPaymentSplit] = useState(false);
  const [posDiscount, setPosDiscount] = useState('');
  const [posDiscountNote, setPosDiscountNote] = useState('');
  const [posPromoInput, setPosPromoInput] = useState('');
  const [posPromo, setPosPromo] = useState<{ code: string; discount: number; description: string | null } | null>(null);
  const [posPromoError, setPosPromoError] = useState('');
  const [posPromoChecking, setPosPromoChecking] = useState(false);
  const [posDiscountMode, setPosDiscountMode] = useState<'manual' | 'promo'>('manual');
  const [posSubmitting, setPosSubmitting] = useState(false);
  const [posReceipt, setPosReceipt] = useState<PosOrderResult | null>(null);
  const [posError, setPosError] = useState('');
  // Inventory tab
  const [invLocId, setInvLocId] = useState('');
  const [invRows, setInvRows] = useState<InventoryItem[]>([]);
  const [invLoading, setInvLoading] = useState(false);
  const [invPlacementSaving, setInvPlacementSaving] = useState<Record<string, boolean>>({});
  const [invReceive, setInvReceive] = useState<{ productId: string; productName: string; size: string; color: string; qty: string } | null>(null);
  const [invReceiving, setInvReceiving] = useState(false);
  const [adjModal, setAdjModal] = useState<{ productId: string; productName: string; size: string; color: string; qty: string; reason: string; note: string } | null>(null);
  const [adjSubmitting, setAdjSubmitting] = useState(false);
  // Transfers tab
  const [xfrForm, setXfrForm] = useState({ fromId: '', toId: '', productId: '', size: '', color: '', qty: '1', note: '' });
  const [xfrFromInv, setXfrFromInv] = useState<InventoryItem[]>([]);
  const [xfrLog, setXfrLog] = useState<XfrRecord[]>([]);
  const [xfrSubmitting, setXfrSubmitting] = useState(false);
  // POS orders sub-tab
  const [posOrderSearch, setPosOrderSearch] = useState('');
  // POS returns sub-tab
  const [posReturnSearch, setPosReturnSearch] = useState('');
  const [posReturnOrder, setPosReturnOrder] = useState<Order | null>(null);
  const [posReturnNote, setPosReturnNote] = useState('');
  const [posReturnSubmitting, setPosReturnSubmitting] = useState(false);

  // Location management (Settings tab)
  const [locModal, setLocModal] = useState<{ id: string | null; draft: { name: string; showOnWeb: boolean; isWebDefault: boolean; sortOrder: string }; error: string } | null>(null);

  // Delivery area management (Settings tab) — full list incl. inactive, unlike data.deliveryAreas (public/active-only).
  const [deliveryAreas, setDeliveryAreas] = useState<DeliveryArea[]>([]);
  const [deliveryAreaModal, setDeliveryAreaModal] = useState<{ id: string | null; draft: { name: string; rate: string; active: boolean; sortOrder: string }; error: string } | null>(null);

  // Cost prices (super-admin only) — every product incl. draft/soldout/POS-only, unlike data.products.
  const [costPriceProducts, setCostPriceProducts] = useState<{ id: string; name: string; price: number; status: string; showInWebStore: boolean; costPrice: number }[]>([]);
  const [costPriceSaving, setCostPriceSaving] = useState<Record<string, boolean>>({});

  // Full unfiltered product list (incl. draft/soldout/POS-only, unlike data.products which is
  // the public-catalog-filtered set) — backs the admin Products tab and all internal pickers.
  const [allProducts, setAllProducts] = useState<Product[]>([]);

  // Settings edited locally, saved on demand.
  const [settingsDraft, setSettingsDraft] = useState(data.settings);
  const [settingsDirty, setSettingsDirty] = useState(false);
  const [telegramTokenDraft, setTelegramTokenDraft] = useState('');
  const [telegramTesting, setTelegramTesting] = useState(false);
  const [telegramDetecting, setTelegramDetecting] = useState(false);
  const [telegramMessage, setTelegramMessage] = useState('');
  const [telegramDisconnecting, setTelegramDisconnecting] = useState(false);
  const [telegramChatOptions, setTelegramChatOptions] = useState<{ id: string; title: string }[]>([]);
  const [resendApiKeyDraft, setResendApiKeyDraft] = useState('');
  const [emailTestRecipient, setEmailTestRecipient] = useState('');
  const [emailTesting, setEmailTesting] = useState(false);
  const [emailDisconnecting, setEmailDisconnecting] = useState(false);
  const [emailMessage, setEmailMessage] = useState('');
  const [msgowlKeyDraft, setMsgowlKeyDraft] = useState('');
  const [smsTestRecipient, setSmsTestRecipient] = useState('');
  const [smsTesting, setSmsTesting] = useState(false);
  const [smsDisconnecting, setSmsDisconnecting] = useState(false);
  const [smsMessage, setSmsMessage] = useState('');
  const [storefrontCopyOpen, setStorefrontCopyOpen] = useState(false);

  // Size charts — list of standalone, assignable charts. Each card saves independently.
  const [sizeCharts, setSizeCharts] = useState<SizeChart[]>([]);
  const [scDirty, setScDirty] = useState<Record<string, boolean>>({});
  const defaultSizeChart = sizeCharts.find(c => c.isDefault) ?? null;

  const flash = useCallback((msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(''), 2200);
  }, []);

  // A 401 means the session lapsed — bounce to login.
  const onError = useCallback((e: unknown, fallback = 'Something went wrong') => {
    if (e instanceof ApiError && e.status === 401) { router.replace('/admin/login'); return; }
    flash(e instanceof Error ? e.message : fallback);
  }, [router, flash]);

  const reloadOrders = useCallback(async () => {
    try { const { orders } = await adminApi.listOrders(); setOrders(orders); } catch (e) { onError(e); }
  }, [onError]);
  const reloadCustomers = useCallback(async () => {
    try { const { customers } = await adminApi.listCustomers(); setCustomers(customers); } catch (e) { onError(e); }
  }, [onError]);
  const reloadReviews = useCallback(async () => {
    try { const { reviews } = await adminApi.listReviews(); setReviews(reviews); } catch (e) { onError(e); }
  }, [onError]);
  const reloadNotifications = useCallback(async () => {
    try { const { logs } = await adminApi.listNotifications(); setNotifications(logs); } catch (e) { onError(e); }
  }, [onError]);
  const refreshNotificationStatus = useCallback(async () => {
    setRefreshingNotifications(true);
    try { await adminApi.refreshNotificationStatus(); await reloadNotifications(); } catch (e) { onError(e); } finally { setRefreshingNotifications(false); }
  }, [onError, reloadNotifications]);
  const reloadNotificationPrefs = useCallback(async () => {
    try { const { prefs } = await adminApi.listNotificationPrefs(); setNotificationPrefs(prefs); } catch (e) { onError(e); }
  }, [onError]);
  const toggleChannelPref = async (event: string, channel: 'emailEnabled' | 'smsEnabled', value: boolean) => {
    const current = notificationPrefs.find(p => p.event === event) ?? { event, emailEnabled: true, smsEnabled: true };
    const updated = { ...current, [channel]: value };
    setNotificationPrefs(prev => {
      const exists = prev.some(p => p.event === event);
      return exists ? prev.map(p => (p.event === event ? updated : p)) : [...prev, updated];
    });
    try { await adminApi.updateNotificationPrefs([updated]); } catch (e) { onError(e, 'Could not save notification preference.'); await reloadNotificationPrefs(); }
  };
  const reloadPromos = useCallback(async () => {
    try { const { promos } = await adminApi.listPromos(); setPromos(promos); } catch (e) { onError(e); }
  }, [onError]);
  const reloadRedemptions = useCallback(async () => {
    try { const { redemptions, referrers } = await adminApi.listRedemptions(); setRedemptions(redemptions); setReferrers(referrers); } catch (e) { onError(e); }
  }, [onError]);

  const reloadUsers = useCallback(async () => {
    try { const { users } = await adminApi.listUsers(); setUsers(users); } catch { /* non-admin: silently skip */ }
  }, []);

  const reloadDeliveryAreas = useCallback(async () => {
    try { const { deliveryAreas } = await adminApi.listDeliveryAreas(); setDeliveryAreas(deliveryAreas); } catch (e) { onError(e); }
  }, [onError]);

  const reloadCostPrices = useCallback(async () => {
    try { const { products } = await adminApi.getCostPrices(); setCostPriceProducts(products); } catch { /* non-admin: silently skip */ }
  }, []);

  const reloadAllProducts = useCallback(async () => {
    try { const { products } = await adminApi.listAllProducts(); setAllProducts(products); } catch (e) { onError(e); }
  }, [onError]);

  const reloadSizeCharts = useCallback(async () => {
    try { const { sizeCharts } = await adminApi.listSizeCharts(); setSizeCharts(sizeCharts); } catch (e) { onError(e); }
  }, [onError]);

  // ── POS handlers ──
  const loadInv = useCallback(async (locId: string) => {
    if (!locId) return;
    setInvLoading(true);
    try { const { inventory } = await adminApi.listInventory(locId); setInvRows(inventory); } catch (e) { onError(e); }
    finally { setInvLoading(false); }
  }, [onError]);

  const loadPosInventory = useCallback(async (locId: string) => {
    if (!locId) { setPosInvRows([]); return; }
    setPosInvLoading(true);
    try { const { inventory } = await adminApi.listInventory(locId); setPosInvRows(inventory); } catch (e) { setPosInvRows([]); onError(e); }
    finally { setPosInvLoading(false); }
  }, [onError]);

  const loadManualOrderInventory = useCallback(async (locId: string) => {
    if (!locId) { setManualOrderInvRows([]); return; }
    try { const { inventory } = await adminApi.listInventory(locId); setManualOrderInvRows(inventory); } catch (e) { setManualOrderInvRows([]); onError(e); }
  }, [onError]);

  const loadTransfers = useCallback(async () => {
    try { const { transfers } = await adminApi.listTransfers(); setXfrLog(transfers); } catch (e) { onError(e); }
  }, [onError]);

  const openPosProduct = (p: Product) => {
    const color = firstAvailableColor(posInvRows, p);
    setPosAddItem(p);
    setPosAddColor(color);
    setPosAddSize(firstAvailableSize(posInvRows, p, color));
    setPosAddQty(1);
  };

  const addToCart = () => {
    if (!posAddItem) return;
    const p = posAddItem;
    if (!posLocId) { flash('Select a POS location first.'); return; }
    const available = inventoryStockForVariant(posInvRows, p.id, posAddColor, posAddSize);
    if (available <= 0) { flash('Selected variant is out of stock at this location.'); return; }
    if (posAddQty > available) { flash(`Only ${available} unit${available !== 1 ? 's' : ''} available at this location.`); return; }
    setPosCart(c => [...c, { sku: p.id, name: p.name, meta: p.sub, img: p.img, size: posAddSize, color: posAddColor, qty: posAddQty, unitPrice: p.price }]);
    setPosAddItem(null);
  };

  const addManualOrderLine = () => {
    const p = allProducts.find(x => x.id === manualOrderProductId);
    if (!p) { setManualOrderError('Choose a product.'); return; }
    if (!manualOrderDraft.locationId) { setManualOrderError('Choose a stock location.'); return; }
    const available = inventoryStockForVariant(manualOrderInvRows, p.id, manualOrderColor, manualOrderSize);
    if (available <= 0) { setManualOrderError('Selected variant is out of stock at this location.'); return; }
    if (manualOrderQty > available) { setManualOrderError(`Only ${available} unit${available !== 1 ? 's' : ''} available at this location.`); return; }
    setManualOrderLines(lines => [...lines, {
      sku: p.id,
      name: p.name,
      meta: p.sub,
      img: p.img,
      size: manualOrderSize,
      color: manualOrderColor,
      qty: manualOrderQty,
      unitPrice: p.price,
    }]);
    setManualOrderError('');
    setManualOrderQty(1);
  };

  const saveInventoryPlacement = async (row: InventoryItem, physicalLocation: string) => {
    const key = `${row.locationId}:${row.productId}`;
    const trimmed = physicalLocation.trim();
    const previous = invRows;
    setInvRows(rows => rows.map(r => r.locationId === row.locationId && r.productId === row.productId ? { ...r, physicalLocation: trimmed } : r));
    if (posLocId === row.locationId) {
      setPosInvRows(rows => rows.map(r => r.locationId === row.locationId && r.productId === row.productId ? { ...r, physicalLocation: trimmed } : r));
    }
    setInvPlacementSaving(s => ({ ...s, [key]: true }));
    try {
      await adminApi.updateInventoryPlacement({ locationId: row.locationId, productId: row.productId, physicalLocation: trimmed });
    } catch (e) {
      setInvRows(previous);
      if (invLocId) await loadInv(invLocId);
      if (posLocId === row.locationId) await loadPosInventory(posLocId);
      onError(e, 'Could not save physical location.');
    } finally {
      setInvPlacementSaving(s => ({ ...s, [key]: false }));
    }
  };

  const applyPosPromo = async () => {
    const code = posPromoInput.trim();
    if (!code) return;
    setPosPromoChecking(true); setPosPromoError('');
    try {
      const res = await fetch('/api/promo/validate', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, items: posCart.map(i => ({ sku: i.sku, qty: i.qty })) }),
      });
      const j = await res.json();
      if (!j.valid) { setPosPromo(null); setPosPromoError(j.error || 'That code is not valid.'); }
      else { setPosPromo({ code: j.code, discount: j.discount, description: j.description ?? null }); setPosPromoError(''); }
    } catch { setPosPromoError('Could not check that code right now.'); }
    finally { setPosPromoChecking(false); }
  };

  const removePosPromo = () => { setPosPromo(null); setPosPromoInput(''); setPosPromoError(''); };

  const submitPosOrder = async () => {
    if (!posLocId) { setPosError('Select a location.'); return; }
    if (posCart.length === 0) { setPosError('Add at least one item.'); return; }
    if (posMethod === 'Delivery' && !posAddress.trim()) { setPosError('Delivery address is required.'); return; }
    if (posMethod === 'Delivery' && !posDeliveryAreaId) { setPosError('Select a delivery area.'); return; }
    if (posPaidTotal !== posTotal) { setPosError(`Payment (MVR ${posPaidTotal.toLocaleString()}) must equal total (MVR ${posTotal.toLocaleString()}).`); return; }
    setPosSubmitting(true); setPosError('');
    try {
      const result = await adminApi.createPosOrder({
        customer: posCustomer.name.trim(), mobile: posCustomer.mobile.trim(), email: posCustomer.email.trim(),
        locationId: posLocId,
        method: posMethod,
        address: posMethod === 'Delivery' ? posAddress.trim() : null,
        deliveryAreaId: posMethod === 'Delivery' ? posDeliveryAreaId : null,
        items: posCart.map(i => ({
          sku: i.sku, name: i.name, meta: i.meta, img: i.img, size: i.size, color: i.color, qty: i.qty,
        })),
        ...(posPromo ? { promoCode: posPromo.code } : { discount: posDiscountAmt, discountNote: posDiscountNote.trim() || null }),
        paidCash: parseInt(posCash) || 0, paidCard: parseInt(posCard) || 0, paidTransfer: parseInt(posTransfer) || 0,
      });
      setPosReceipt(result); setPosCart([]); setPosCustomer({ name: '', mobile: '', email: '' });
      setPosMethod('Pickup'); setPosAddress(''); setPosDeliveryAreaId('');
      setPosCash(''); setPosCard(''); setPosTransfer(''); setPosDiscount(''); setPosDiscountNote('');
      setPosPromo(null); setPosPromoInput(''); setPosPromoError('');
      await reloadOrders();
      flash(`Order ${result.ref} placed — MVR ${result.total.toLocaleString()}`);
    } catch (e) { setPosError(e instanceof Error ? e.message : 'Could not place order.'); }
    finally { setPosSubmitting(false); }
  };

  const submitManualOrder = async () => {
    const d = manualOrderDraft;
    if (!d.customer.trim() || !d.mobile.trim()) { setManualOrderError('Customer and mobile are required.'); return; }
    if (!d.locationId) { setManualOrderError('Choose a stock location.'); return; }
    if (manualOrderLines.length === 0) { setManualOrderError('Add at least one product.'); return; }
    if (d.method === 'Delivery' && !d.address.trim()) { setManualOrderError('Delivery address is required.'); return; }
    if (d.method === 'Delivery' && !d.deliveryAreaId) { setManualOrderError('Select a delivery area.'); return; }
    const itemSubtotal = manualOrderLines.reduce((sum, i) => sum + i.unitPrice * i.qty, 0);
    const discount = parseInt(d.discount) || 0;
    const deliveryFee = manualOrderDeliveryFee;
    const total = Math.max(0, itemSubtotal + deliveryFee - discount);
    const paidCash = parseInt(d.paidCash) || 0;
    const paidCard = parseInt(d.paidCard) || 0;
    const paidTransfer = parseInt(d.paidTransfer) || 0;
    if (paidCash + paidCard + paidTransfer > total) { setManualOrderError(`Payment received cannot exceed MVR ${total.toLocaleString()}.`); return; }
    setManualOrderSaving(true); setManualOrderError('');
    try {
      await adminApi.createManualOrder({
        customer: d.customer.trim(), email: d.email.trim(), mobile: d.mobile.trim(), locationId: d.locationId,
        items: manualOrderLines.map(i => ({ sku: i.sku, size: i.size, color: i.color, qty: i.qty })),
        discount, discountNote: d.discountNote.trim() || null, method: d.method, address: d.method === 'Delivery' ? d.address.trim() : null,
        deliveryAreaId: d.method === 'Delivery' ? d.deliveryAreaId : null,
        paidCash, paidCard, paidTransfer, notes: d.notes.trim() || null,
      });
      setManualOrderModal(false);
      setManualOrderDraft({ customer: '', email: '', mobile: '', discount: '0', discountNote: '', method: 'Pickup', address: '', deliveryAreaId: '', paidCash: '', paidCard: '', paidTransfer: '', notes: '', locationId: '' });
      setManualOrderLines([]);
      setManualOrderProductId('');
      setManualOrderInvRows([]);
      await reloadOrders();
      flash('Manual order created.');
    } catch (e) { setManualOrderError(e instanceof Error ? e.message : 'Could not create order.'); }
    finally { setManualOrderSaving(false); }
  };

  const processReturn = async (order: Order) => {
    if (!window.confirm(`Mark order ${order.id} as Cancelled? This cannot be undone.`)) return;
    setPosReturnSubmitting(true);
    try {
      await adminApi.updateOrder(order.id, { stage: 6 });
      setOrders(os => os.map(o => o.id === order.id ? { ...o, stage: 6 as any } : o));
      setPosReturnOrder(null); setPosReturnSearch(''); setPosReturnNote('');
      flash(`Order ${order.id} marked as Cancelled.`);
    } catch (e) { onError(e, 'Could not process return.'); }
    finally { setPosReturnSubmitting(false); }
  };

  const submitReceiveStock = async () => {
    if (!invReceive || invReceiving) return;
    const qty = parseInt(invReceive.qty) || 0;
    if (qty <= 0 || !invLocId) return;
    setInvReceiving(true);
    try {
      await adminApi.receiveStock({ locationId: invLocId, productId: invReceive.productId, size: invReceive.size, color: invReceive.color, qty });
      const variant = [invReceive.size, invReceive.color].filter(Boolean).join(' / ');
      flash(`+${qty} added to ${invReceive.productName}${variant ? ` (${variant})` : ''}`);
      setInvReceive(null);
      await loadInv(invLocId);
    } catch (e) { onError(e, 'Could not receive stock.'); }
    finally { setInvReceiving(false); }
  };

  const submitAdjustStock = async () => {
    if (!adjModal || adjSubmitting) return;
    const qty = parseInt(adjModal.qty);
    if (!adjModal.productId || isNaN(qty) || qty === 0) { flash('Fill in all fields.'); return; }
    setAdjSubmitting(true);
    try {
      await adminApi.adjustStock({ locationId: invLocId, productId: adjModal.productId, size: adjModal.size, color: adjModal.color, qty, reason: adjModal.reason, note: adjModal.note || null });
      const variant = [adjModal.size, adjModal.color].filter(Boolean).join(' / ');
      flash(`Stock adjusted (${qty > 0 ? '+' : ''}${qty} ${adjModal.productName}${variant ? ` ${variant}` : ''})`);
      setAdjModal(null);
      await loadInv(invLocId);
    } catch (e) { onError(e, 'Adjustment failed.'); }
    finally { setAdjSubmitting(false); }
  };

  const submitTransfer = async () => {
    if (xfrSubmitting) return;
    if (!xfrForm.fromId || !xfrForm.toId || !xfrForm.productId) { flash('Fill in From, To, and Product.'); return; }
    const qty = parseInt(xfrForm.qty) || 0;
    if (qty <= 0) { flash('Qty must be at least 1.'); return; }
    setXfrSubmitting(true);
    try {
      await adminApi.transferStock({ fromId: xfrForm.fromId, toId: xfrForm.toId, productId: xfrForm.productId, size: xfrForm.size, color: xfrForm.color, qty, note: xfrForm.note || null });
      flash('Stock transferred');
      setXfrForm({ fromId: '', toId: '', productId: '', size: '', color: '', qty: '1', note: '' });
      setXfrFromInv([]);
      await loadTransfers();
      if (invLocId) await loadInv(invLocId);
    } catch (e) { onError(e, 'Transfer failed.'); }
    finally { setXfrSubmitting(false); }
  };

  useEffect(() => {
    adminApi.getMe().then(me => {
      setCurrentUser(me);
      if (hasPermission(me, 'settingsUsers', 'read')) reloadUsers();
      if (hasPermission(me, 'reviews', 'read')) reloadReviews();
      if (me.role === 'admin') reloadCostPrices();
    }).catch(() => {});
    reloadOrders(); reloadPromos(); reloadRedemptions(); reloadSizeCharts(); reloadCustomers(); reloadNotifications(); reloadNotificationPrefs(); reloadDeliveryAreas(); reloadAllProducts();
  }, [reloadOrders, reloadPromos, reloadRedemptions, reloadUsers, reloadSizeCharts, reloadCustomers, reloadNotifications, reloadNotificationPrefs, reloadReviews, reloadDeliveryAreas, reloadCostPrices, reloadAllProducts]);

  // If the active POS sub-tab isn't permitted (e.g. a staff user without
  // Sales access lands on 'pos'), fall back to the first one they can see.
  useEffect(() => {
    if (tab !== 'pos' || !currentUser) return;
    if (posTab === 'costPrice') { if (currentUser.role !== 'admin') setPosTab('sales'); return; }
    if (hasPermission(currentUser, POS_TAB_MODULE[posTab], 'read')) return;
    const fallback = (Object.keys(POS_TAB_MODULE) as (keyof typeof POS_TAB_MODULE)[]).find(k => hasPermission(currentUser, POS_TAB_MODULE[k], 'read'));
    if (fallback) setPosTab(fallback);
  }, [tab, posTab, currentUser]);

  // Same fallback behavior for the Customers tab's Reviews sub-tab.
  useEffect(() => {
    if (tab !== 'customers' || !currentUser) return;
    if (hasPermission(currentUser, CUSTOMERS_TAB_MODULE[customersSubTab], 'read')) return;
    const fallback = (Object.keys(CUSTOMERS_TAB_MODULE) as (keyof typeof CUSTOMERS_TAB_MODULE)[]).find(k => hasPermission(currentUser, CUSTOMERS_TAB_MODULE[k], 'read'));
    if (fallback) setCustomersSubTab(fallback);
  }, [tab, customersSubTab, currentUser]);

  // Default both location pickers to the lowest-sortOrder location once locations load,
  // so staff aren't forced to reselect it every session.
  useEffect(() => {
    if (!posLocId && data.locations.length > 0) setPosLocId(data.locations[0].id);
  }, [posLocId, data.locations]);

  useEffect(() => {
    if (!invLocId && data.locations.length > 0) { const id = data.locations[0].id; setInvLocId(id); loadInv(id); }
  }, [invLocId, data.locations, loadInv]);

  useEffect(() => {
    loadPosInventory(posLocId);
  }, [posLocId, loadPosInventory]);

  useEffect(() => {
    loadManualOrderInventory(manualOrderDraft.locationId);
  }, [manualOrderDraft.locationId, loadManualOrderInventory]);

  useEffect(() => {
    const p = allProducts.find(x => x.id === manualOrderProductId);
    if (!p) return;
    const color = firstAvailableColor(manualOrderInvRows, p);
    setManualOrderColor(color);
    setManualOrderSize(firstAvailableSize(manualOrderInvRows, p, color));
    setManualOrderQty(1);
  }, [manualOrderProductId, manualOrderInvRows, allProducts]);

  useEffect(() => {
    if (!posAddItem || !posLocId) return;
    const available = inventoryStockForVariant(posInvRows, posAddItem.id, posAddColor, posAddSize);
    setPosAddQty(q => available > 0 ? Math.min(Math.max(1, q), available) : 1);
  }, [posAddItem, posAddColor, posAddSize, posLocId, posInvRows]);

  // Keep the settings draft in sync with live data while the admin isn't editing.
  useEffect(() => { if (!settingsDirty) setSettingsDraft(data.settings); }, [data.settings, settingsDirty]);

  // Escape closes whichever overlay is open.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { setModal(null); setConfirm(null); setPromoModal(null); setUserModal(null); setSlipModal(null); setMarkPaidModal(null); setPosAddItem(null); setInvReceive(null); setAdjModal(null); setLocModal(null); setDeliveryAreaModal(null); setMobileNavOpen(false); } };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // ── modal save ──
  const saveModal = async () => {
    if (!modal || saving) return;
    const draft = modal.draft;
    const kind = modal.kind;

    const nameVal = draft.name || draft.label || '';
    if (!String(nameVal).trim()) { setModal(m => m ? { ...m, error: 'Please enter a name.' } : m); return; }
    if (kind === 'product' && !modal.id && !String(draft.locationId ?? '').trim()) {
      setModal(m => m ? { ...m, error: 'Please select a location.' } : m); return;
    }

    setSaving(true);
    try {
      if (kind === 'product') {
        const colorSizeStock: Record<string, Record<string, number>> = (draft.colorSizeStock as Record<string, Record<string, number>>) ?? {};
        const sizeStock = sizeStockFromColorSize(colorSizeStock);
        const computedSizes = Object.entries(sizeStock).filter(([, q]) => q > 0).map(([s]) => s);
        const computedStock = sumColorSizeStock(colorSizeStock);
        const status = computedStock === 0 && draft.status === 'active' ? 'soldout' : draft.status;
        const body: Record<string, unknown> = {
          name: draft.name, collection: draft.collection, category: draft.category, sub: draft.sub ?? '',
          price: draft.price, was: draft.was || null, status, badge: draft.badge ?? '', img: draft.img,
          colors: Array.isArray(draft.colors) ? draft.colors : [],
          colorImages: draft.colorImages ?? {},
          colorHex: draft.colorHex ?? {},
          descriptionSections: (Array.isArray(draft.descriptionSections) ? draft.descriptionSections as ProductSection[] : [])
            .filter(sec => sec.title.trim() || sec.body.trim()),
          showInWebStore: draft.showInWebStore !== false,
        };
        if (currentUser?.role === 'admin') body.costPrice = parseInt(String(draft.costPrice ?? 0)) || 0;
        if (!modal.id) {
          // Initial stock is only set at creation — edits never touch existing Inventory.
          body.stock = computedStock;
          body.sizes = computedSizes;
          body.sizeStock = sizeStock;
          body.colorSizeStock = colorSizeStock;
          body.locationId = draft.locationId;
        } else {
          // Edits may only seed brand-new colour/size combos (no existing Inventory row) —
          // never touch a combo that's already tracked.
          const origStock: Record<string, Record<string, number>> = (draft.colorSizeStockOriginal as Record<string, Record<string, number>>) ?? {};
          const newColorSizeStock: Record<string, Record<string, number>> = {};
          for (const [color, bySize] of Object.entries(colorSizeStock)) {
            for (const [size, qty] of Object.entries(bySize)) {
              if (qty > 0 && origStock[color]?.[size] === undefined) {
                (newColorSizeStock[color] ??= {})[size] = qty;
              }
            }
          }
          if (Object.keys(newColorSizeStock).length > 0) {
            body.newColorSizeStock = newColorSizeStock;
            body.newStockLocationId = draft.newStockLocationId ?? data.locations[0]?.id;
          }
        }
        if (modal.id) await adminApi.updateProduct(modal.id, body) as any;
        else await adminApi.createProduct(body) as any;
      } else if (kind === 'collection') {
        if (modal.id) await adminApi.updateCollection(modal.id, draft.label, draft.sizeChartId ?? null) as any;
        else await adminApi.createCollection(draft.label, draft.sizeChartId ?? null) as any;
      } else if (kind === 'category') {
        if (modal.id) await adminApi.updateCategory(modal.id, { name: draft.name, collection: draft.collection }) as any;
        else await adminApi.createCategory(draft.name, draft.collection) as any;
      }
      await refresh();
      if (kind === 'product') {
        reloadAllProducts();
        if (currentUser?.role === 'admin') reloadCostPrices();
      }
      flash((modal.id ? 'Saved' : 'Added') + ' ' + kind.replace(/s$/, ''));
      setModal(null);
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) { router.replace('/admin/login'); return; }
      setModal(m => m ? { ...m, error: e instanceof Error ? e.message : 'Could not save.' } : m);
    } finally {
      setSaving(false);
    }
  };

  // ── delete ──
  const doDelete = async () => {
    if (!confirm || saving) return;
    setSaving(true);
    try {
      if (confirm.kind === 'product') await adminApi.deleteProduct(confirm.id);
      else if (confirm.kind === 'category') await adminApi.deleteCategory(confirm.id);
      else if (confirm.kind === 'collection') await adminApi.deleteCollection(confirm.id);
      else if (confirm.kind === 'promo') { await adminApi.deletePromo(confirm.id); await reloadPromos(); flash('Code deleted'); setConfirm(null); return; }
      else if (confirm.kind === 'sizechart') { await adminApi.deleteSizeChart(confirm.id); await reloadSizeCharts(); await refresh(); flash('Size chart deleted'); setConfirm(null); return; }
      await refresh();
      if (confirm.kind === 'product') reloadAllProducts();
      flash('Deleted');
      setConfirm(null);
    } catch (e) {
      onError(e, 'Could not delete.');
      setConfirm(null);
    } finally {
      setSaving(false);
    }
  };

  const askDelete = (kind: string, item: { id: string; name?: string; label?: string; key?: string }, detail?: string) => {
    setConfirm({ kind, id: item.id, key: item.key, name: item.name ?? item.label ?? '', detail });
  };

  const openModal = (kind: string, item?: Record<string, any>) => {
    const firstCol = data.collections[0]?.key ?? 'ready';
    const defaults: Record<string, Record<string, any>> = {
      product:    { name:'', collection: firstCol, category: data.categories[0]?.name ?? '', sub:'', price:'', was:'', locationId: data.locations.find(l => l.isWebDefault)?.id ?? '', stock:'0', status:'active', badge:'', img: GRADIENTS[0], colors: [], sizes: [], sizeStock: {}, colorSizeStock: {}, colorImages: {}, colorHex: {}, descriptionSections: [], showInWebStore: true },
      collection: { label:'', sizeChartId: null },
      category:   { name:'', collection: firstCol },
    };
    let draft = item ? { ...item } : { ...(defaults[kind] ?? {}) };
    if (kind === 'product' && item) {
      // colorSizeStock comes from mapProduct — the real Inventory-derived total, not the vestigial Product.sizeStock JSON.
      // costPrice never comes through mapProduct/data.products (public catalog) — merge it in from the
      // super-admin-only cost-prices endpoint instead.
      draft = {
        ...draft,
        colorSizeStock: (item.colorSizeStock as Record<string, Record<string, number>>) ?? {},
        // Frozen snapshot from when the modal opened — used only to tell which colour/size
        // combos are genuinely new (no existing Inventory row) vs already-tracked, so edits
        // never get misclassified as new just because the admin typed into the grid.
        colorSizeStockOriginal: (item.colorSizeStock as Record<string, Record<string, number>>) ?? {},
        costPrice: costPriceProducts.find(p => p.id === item.id)?.costPrice ?? 0,
      };
    }
    setModal({ kind, id: item?.id ?? null, draft, error: '' });
    setColorInput('');
  };

  const setDraftField = (key: string, val: any) => setModal(m => m ? { ...m, draft: { ...m.draft, [key]: val }, error: '' } : m);
  // Toggle a value in a draft array field (product colours).
  const toggleDraftArr = (key: string, val: string) => setModal(m => {
    if (!m) return m;
    const cur: string[] = Array.isArray(m.draft[key]) ? m.draft[key] : [];
    const next = cur.includes(val) ? cur.filter(x => x !== val) : [...cur, val];
    return { ...m, draft: { ...m.draft, [key]: next }, error: '' };
  });
  // Product page text sections — add/edit/reorder/remove {title, body} entries in the draft.
  const addDraftSection = () => setModal(m => {
    if (!m) return m;
    const cur: ProductSection[] = Array.isArray(m.draft.descriptionSections) ? m.draft.descriptionSections : [];
    return { ...m, draft: { ...m.draft, descriptionSections: [...cur, { id: 'sec-' + Date.now(), title: '', body: '' }] }, error: '' };
  });
  const updateDraftSection = (i: number, patch: Partial<ProductSection>) => setModal(m => {
    if (!m) return m;
    const cur: ProductSection[] = Array.isArray(m.draft.descriptionSections) ? m.draft.descriptionSections : [];
    const next = [...cur];
    next[i] = { ...next[i], ...patch };
    return { ...m, draft: { ...m.draft, descriptionSections: next }, error: '' };
  });
  const removeDraftSection = (i: number) => setModal(m => {
    if (!m) return m;
    const cur: ProductSection[] = Array.isArray(m.draft.descriptionSections) ? m.draft.descriptionSections : [];
    return { ...m, draft: { ...m.draft, descriptionSections: cur.filter((_, j) => j !== i) }, error: '' };
  });
  const moveDraftSection = (i: number, dir: -1 | 1) => setModal(m => {
    if (!m) return m;
    const cur: ProductSection[] = Array.isArray(m.draft.descriptionSections) ? m.draft.descriptionSections : [];
    const j = i + dir;
    if (j < 0 || j >= cur.length) return m;
    const next = [...cur];
    [next[i], next[j]] = [next[j], next[i]];
    return { ...m, draft: { ...m.draft, descriptionSections: next }, error: '' };
  });
  // Increment/decrement a colour+size cell's stock quantity; 0 means that combo is unavailable.
  const setColorSizeQty = (color: string, size: string, delta: number) => setModal(m => {
    if (!m) return m;
    const cur: Record<string, Record<string, number>> = (m.draft.colorSizeStock as Record<string, Record<string, number>>) ?? {};
    const next = Math.max(0, (cur[color]?.[size] ?? 0) + delta);
    return { ...m, draft: { ...m.draft, colorSizeStock: { ...cur, [color]: { ...cur[color], [size]: next } } }, error: '' };
  });
  // Directly set a colour+size cell's stock quantity (typed input, as opposed to the +/- stepper above).
  const setColorSizeQtyValue = (color: string, size: string, value: number) => setModal(m => {
    if (!m) return m;
    const cur: Record<string, Record<string, number>> = (m.draft.colorSizeStock as Record<string, Record<string, number>>) ?? {};
    const next = Math.max(0, value);
    return { ...m, draft: { ...m.draft, colorSizeStock: { ...cur, [color]: { ...cur[color], [size]: next } } }, error: '' };
  });

  // ── order helpers ──
  const setOrderStage = async (id: string, stage: number) => {
    try {
      const body: { stage: number; paid?: boolean } = { stage };
      const { order } = await adminApi.updateOrder(id, body);
      // Merge: PATCH now returns receipts, but fall back to preserving them if not present.
      setOrders(os => os.map(o => o.id === id ? { ...order, receipts: order.receipts ?? o.receipts } : o));
      setOrderDrawer(o => o && o.id === id ? { ...order, receipts: order.receipts ?? o.receipts } : o);
      flash('Order updated');
    } catch (e) { onError(e); }
  };
  const togglePaid = async (id: string) => {
    const cur = orders.find(o => o.id === id);
    if (!cur) return;
    if (cur.paid) {
      try {
        const { order } = await adminApi.updateOrder(id, { paid: false });
        setOrders(os => os.map(o => o.id === id ? { ...order, receipts: order.receipts ?? o.receipts } : o));
        setOrderDrawer(o => o && o.id === id ? { ...order, receipts: order.receipts ?? o.receipts } : o);
      } catch (e) { onError(e); }
      return;
    }
    // Marking paid: prompt for the cash/card/transfer breakdown rather than just
    // flipping the flag, so orders with no per-method amounts recorded yet (quote
    // conversions, web-checkout orders) end up with a real reconciled breakdown
    // instead of "No payment recorded" and a receipt PDF stuck on 0.
    const hasSlip = !!paymentSlip(cur);
    setMarkPaidError('');
    setMarkPaidDraft({
      paidCash: cur.paidCash ? String(cur.paidCash) : '',
      paidCard: cur.paidCard ? String(cur.paidCard) : '',
      paidTransfer: cur.paidTransfer ? String(cur.paidTransfer) : (hasSlip ? String(cur.total) : ''),
    });
    setMarkPaidModal({ orderId: id, total: cur.total });
  };
  const confirmMarkPaid = async () => {
    if (!markPaidModal) return;
    const paidCash = parseInt(markPaidDraft.paidCash) || 0;
    const paidCard = parseInt(markPaidDraft.paidCard) || 0;
    const paidTransfer = parseInt(markPaidDraft.paidTransfer) || 0;
    if (paidCash + paidCard + paidTransfer > markPaidModal.total) {
      setMarkPaidError(`Payment received cannot exceed MVR ${markPaidModal.total.toLocaleString()}.`);
      return;
    }
    setMarkPaidSaving(true); setMarkPaidError('');
    try {
      const { order } = await adminApi.updateOrder(markPaidModal.orderId, { paid: true, paidCash, paidCard, paidTransfer });
      setOrders(os => os.map(o => o.id === order.id ? { ...order, receipts: order.receipts ?? o.receipts } : o));
      setOrderDrawer(o => o && o.id === order.id ? { ...order, receipts: order.receipts ?? o.receipts } : o);
      setMarkPaidModal(null);
      flash('Order marked as paid');
    } catch (e) { onError(e); }
    finally { setMarkPaidSaving(false); }
  };
  const generateOrderReceipt = async (id: string) => {
    try {
      await adminApi.generateOrderReceipt(id);
      const { orders: freshOrders } = await adminApi.listOrders();
      setOrders(freshOrders);
      const refreshed = freshOrders.find(o => o.id === id);
      if (refreshed) setOrderDrawer(refreshed);
      flash('Receipt ready');
    } catch (e) { onError(e, 'Could not generate receipt.'); }
  };
  const deleteOrder = async (id: string, ref: string) => {
    if (!window.confirm(`Delete order ${ref}? This cannot be undone.`)) return;
    try {
      await adminApi.deleteOrder(id);
      setOrders(os => os.filter(o => o.id !== id));
      flash('Order deleted');
    } catch (e) { onError(e, 'Could not delete order.'); }
  };
  const approveReview = async (id: string) => {
    try {
      await adminApi.approveReview(id);
      flash('Review approved');
      await reloadReviews();
    } catch (e) { onError(e, 'Could not approve review.'); }
  };
  const rejectReview = async (id: string) => {
    const note = window.prompt('Optional rejection note:') || undefined;
    try {
      await adminApi.rejectReview(id, note);
      flash('Review rejected');
      await reloadReviews();
    } catch (e) { onError(e, 'Could not reject review.'); }
  };
  const setReviewFeatured = async (id: string, featured: boolean) => {
    try {
      await adminApi.setReviewFeatured(id, featured);
      await reloadReviews();
    } catch (e) { onError(e, 'Could not update review.'); }
  };

  const setSetting = (key: string, val: any) => {
    setSettingsDirty(true);
    setSettingsDraft(s => ({ ...s, [key]: val }));
  };
  const setStorefrontCopyField = (section: keyof ReturnType<typeof normalizeStorefrontCopy>, key: string, value: string) => {
    setSettingsDirty(true);
    setSettingsDraft(s => {
      const current = normalizeStorefrontCopy(s.storefrontCopy);
      return {
        ...s,
        storefrontCopy: {
          ...current,
          [section]: {
            ...current[section],
            [key]: value,
          },
        },
      };
    });
  };
  const saveSettings = async () => {
    setSaving(true);
    try {
      await adminApi.updateSettings(settingsDraft as unknown as Record<string, unknown>);
      setSettingsDirty(false);
      await refresh();
      flash('Settings saved');
    } catch (e) { onError(e, 'Could not save settings.'); }
    finally { setSaving(false); }
  };
  const detectTelegramChatId = async () => {
    const botToken = telegramTokenDraft.trim();
    if (!botToken && !settingsDraft.telegramConnected) { setTelegramMessage('Enter your bot token first.'); return; }
    setTelegramDetecting(true); setTelegramMessage(''); setTelegramChatOptions([]);
    try {
      const { chats } = await adminApi.detectTelegramChats(botToken);
      if (chats.length === 1) {
        setSetting('telegramChatId', chats[0].id);
        setTelegramMessage(`Found "${chats[0].title}" — chat ID filled in below.`);
      } else {
        setTelegramChatOptions(chats);
        setTelegramMessage('Multiple chats found — pick one below.');
      }
    } catch (e) {
      setTelegramMessage(e instanceof Error ? e.message : 'Could not detect a chat ID.');
    } finally {
      setTelegramDetecting(false);
    }
  };
  const testTelegram = async () => {
    const botToken = telegramTokenDraft.trim();
    const chatId = String(settingsDraft.telegramChatId ?? '').trim();
    if (!botToken && !settingsDraft.telegramConnected) { setTelegramMessage('Enter your bot token first.'); return; }
    if (!chatId) { setTelegramMessage('Enter or detect a chat ID first.'); return; }
    setTelegramTesting(true); setTelegramMessage('');
    try {
      const res = await adminApi.testTelegram(botToken, chatId);
      setSettingsDraft(s => ({
        ...s,
        telegramConnected: true,
        telegramChatId: res.chatId,
        telegramBotUsername: res.username,
        telegramLastTestAt: res.lastTestAt,
      }));
      setTelegramTokenDraft('');
      setTelegramChatOptions([]);
      setTelegramMessage(`Connected as @${res.username} — test message sent.`);
      await refresh();
    } catch (e) {
      setTelegramMessage(e instanceof Error ? e.message : 'Could not connect to Telegram.');
    } finally {
      setTelegramTesting(false);
    }
  };
  const disconnectTelegram = async () => {
    setTelegramDisconnecting(true);
    try {
      await adminApi.disconnectTelegram();
      setTelegramMessage('');
      setTelegramTokenDraft('');
      setTelegramChatOptions([]);
      await refresh();
      flash('Telegram disconnected.');
    } catch (e) { onError(e, 'Could not disconnect Telegram.'); }
    finally { setTelegramDisconnecting(false); }
  };
  const testEmail = async () => {
    const apiKey = resendApiKeyDraft.trim();
    const fromUser = String(settingsDraft.emailFromUser ?? '').trim();
    const recipient = emailTestRecipient.trim();
    if (!apiKey && !settingsDraft.emailConnected) { setEmailMessage('Enter your Resend API key first.'); return; }
    if (!fromUser) { setEmailMessage('Enter a "send from" username first.'); return; }
    if (!recipient) { setEmailMessage('Enter an address to send the test email to.'); return; }
    setEmailTesting(true); setEmailMessage('');
    try {
      const res = await adminApi.testEmail(apiKey, fromUser, String(settingsDraft.emailFromName ?? ''), recipient);
      setSettingsDraft(s => ({
        ...s,
        emailConnected: true,
        emailFromUser: res.emailFromUser,
        emailFromName: res.emailFromName,
        emailLastTestAt: res.lastTestAt,
      }));
      setResendApiKeyDraft('');
      setEmailMessage(`Test email sent to ${recipient}.`);
      await refresh();
    } catch (e) {
      setEmailMessage(e instanceof Error ? e.message : 'Could not send a test email via Resend.');
    } finally {
      setEmailTesting(false);
    }
  };
  const disconnectEmail = async () => {
    setEmailDisconnecting(true);
    try {
      await adminApi.disconnectEmail();
      setEmailMessage('');
      setResendApiKeyDraft('');
      await refresh();
      flash('Resend disconnected.');
    } catch (e) { onError(e, 'Could not disconnect Resend.'); }
    finally { setEmailDisconnecting(false); }
  };
  const testSms = async () => {
    const apiKey = msgowlKeyDraft.trim();
    const senderId = String(settingsDraft.msgowlSenderId ?? '').trim();
    const recipient = smsTestRecipient.trim();
    if (!apiKey && !settingsDraft.smsConnected) { setSmsMessage('Enter your MsgOwl API key first.'); return; }
    if (!senderId) { setSmsMessage('Enter a sender ID first.'); return; }
    if (!recipient) { setSmsMessage('Enter a phone number to send the test SMS to.'); return; }
    setSmsTesting(true); setSmsMessage('');
    try {
      const res = await adminApi.testSms(apiKey, senderId, recipient);
      setSettingsDraft(s => ({
        ...s,
        smsConnected: true,
        msgowlSenderId: res.senderId,
        smsLastTestAt: res.lastTestAt,
      }));
      setMsgowlKeyDraft('');
      setSmsMessage(`Test SMS sent to ${recipient}.`);
      await refresh();
    } catch (e) {
      setSmsMessage(e instanceof Error ? e.message : 'Could not send a test SMS via MsgOwl.');
    } finally {
      setSmsTesting(false);
    }
  };
  const disconnectSms = async () => {
    setSmsDisconnecting(true);
    try {
      await adminApi.disconnectSms();
      setSmsMessage('');
      setMsgowlKeyDraft('');
      await refresh();
      flash('MsgOwl disconnected.');
    } catch (e) { onError(e, 'Could not disconnect MsgOwl.'); }
    finally { setSmsDisconnecting(false); }
  };

  // ── size chart editor ──
  const scMutate = (id: string, fn: (d: SizeChart) => void) => {
    setSizeCharts(prev => prev.map(c => {
      if (c.id !== id) return c;
      const d: SizeChart = structuredClone(c);
      fn(d);
      return d;
    }));
    setScDirty(prev => ({ ...prev, [id]: true }));
  };
  const scAddColumn = (id: string) => scMutate(id, d => { d.columns.push('Column'); d.rows.forEach(r => r.push('')); });
  const scRemoveColumn = (id: string, ci: number) => scMutate(id, d => { if (d.columns.length <= 1) return; d.columns.splice(ci, 1); d.rows.forEach(r => r.splice(ci, 1)); });
  const scAddRow = (id: string) => scMutate(id, d => { d.rows.push(new Array(d.columns.length).fill('')); });
  const scRemoveRow = (id: string, ri: number) => scMutate(id, d => { d.rows.splice(ri, 1); });

  const addSizeChart = async () => {
    setSaving(true);
    try {
      const { sizeChart } = await adminApi.createSizeChart({ name: 'New chart', note: '', columns: ['Size', 'Chest (cm)'], rows: [['', '']] });
      setSizeCharts(prev => [...prev, sizeChart as SizeChart]);
      flash('Size chart added');
    } catch (e) { onError(e, 'Could not add size chart.'); }
    finally { setSaving(false); }
  };

  const saveSizeChart = async (id: string) => {
    const chart = sizeCharts.find(c => c.id === id);
    if (!chart) return;
    setSaving(true);
    try {
      const { sizeChart } = await adminApi.updateSizeChart(id, { name: chart.name, note: chart.note, columns: chart.columns, rows: chart.rows });
      setSizeCharts(prev => prev.map(c => (c.id === id ? (sizeChart as SizeChart) : c)));
      setScDirty(prev => { const n = { ...prev }; delete n[id]; return n; });
      flash('Size chart saved');
    } catch (e) { onError(e, 'Could not save size chart.'); }
    finally { setSaving(false); }
  };

  const setDefaultSizeChart = async (id: string) => {
    setSaving(true);
    try {
      await adminApi.updateSizeChart(id, { isDefault: true });
      await reloadSizeCharts();
      await refresh();
      flash('Default size chart updated');
    } catch (e) { onError(e, 'Could not set default.'); }
    finally { setSaving(false); }
  };

  // ── promo codes ──
  const openPromoModal = (p?: PromoCode) => {
    setPromoModal({
      id: p?.id ?? null,
      draft: p ? {
        code: p.code, description: p.description ?? '', discountType: p.discountType, discountValue: String(p.discountValue),
        scope: p.scope, scopeValue: p.scopeValue ?? '', minSubtotal: String(p.minSubtotal),
        maxRedemptions: p.maxRedemptions != null ? String(p.maxRedemptions) : '', expiresAt: p.expiresAt ? p.expiresAt.slice(0, 10) : '',
        active: p.active, referrer: p.referrer ?? '', commissionType: p.commissionType, commissionValue: String(p.commissionValue),
      } : {
        code: '', description: '', discountType: 'percent', discountValue: '10', scope: 'all', scopeValue: '', minSubtotal: '0',
        maxRedemptions: '', expiresAt: '', active: true, referrer: '', commissionType: 'none', commissionValue: '0',
      },
      error: '',
    });
  };
  const setPromoField = (k: string, v: any) => setPromoModal(m => m ? { ...m, draft: { ...m.draft, [k]: v }, error: '' } : m);

  const savePromo = async () => {
    if (!promoModal || saving) return;
    const d = promoModal.draft;
    if (!String(d.code).trim()) { setPromoModal(m => m ? { ...m, error: 'Enter a code.' } : m); return; }
    if (d.scope !== 'all' && !String(d.scopeValue).trim()) { setPromoModal(m => m ? { ...m, error: 'Pick what the code applies to.' } : m); return; }
    setSaving(true);
    try {
      const body: Record<string, unknown> = {
        code: d.code, description: d.description || null, discountType: d.discountType, discountValue: d.discountValue,
        scope: d.scope, scopeValue: d.scope === 'all' ? null : (d.scopeValue || null), minSubtotal: d.minSubtotal || 0,
        maxRedemptions: d.maxRedemptions ? d.maxRedemptions : null, expiresAt: d.expiresAt || null, active: d.active,
        referrer: d.referrer || null, commissionType: d.commissionType, commissionValue: d.commissionValue || 0,
      };
      if (promoModal.id) await adminApi.updatePromo(promoModal.id, body);
      else await adminApi.createPromo(body);
      await reloadPromos();
      flash(promoModal.id ? 'Code saved' : 'Code created');
      setPromoModal(null);
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) { router.replace('/admin/login'); return; }
      setPromoModal(m => m ? { ...m, error: e instanceof Error ? e.message : 'Could not save.' } : m);
    } finally { setSaving(false); }
  };

  // ── product image upload ──
  const uploadProductImage = async (file: File) => {
    if (!file || imgUploading) return;
    setImgUploading(true);
    try {
      const form = new FormData();
      form.append('file', file);
      form.append('kind', 'product');
      const res = await fetch('/api/upload', { method: 'POST', body: form });
      const { url } = await res.json();
      if (!res.ok || !url) throw new Error('Upload failed');
      setDraftField('img', `url(${url}) center/cover no-repeat`);
    } catch (e) {
      setModal(m => m ? { ...m, error: e instanceof Error ? e.message : 'Upload failed.' } : m);
    } finally { setImgUploading(false); }
  };

  const uploadColorImage = async (colorLabel: string, file: File) => {
    if (!file || colorImgUploading[colorLabel]) return;
    setColorImgUploading(u => ({ ...u, [colorLabel]: true }));
    try {
      const form = new FormData();
      form.append('file', file);
      form.append('kind', 'product');
      const res = await fetch('/api/upload', { method: 'POST', body: form });
      const { url } = await res.json();
      if (!res.ok || !url) throw new Error('Upload failed');
      setDraftField('colorImages', { ...(modal?.draft.colorImages as Record<string, string> ?? {}), [colorLabel]: `url(${url}) center/cover no-repeat` });
    } catch (e) {
      setModal(m => m ? { ...m, error: e instanceof Error ? e.message : 'Upload failed.' } : m);
    } finally { setColorImgUploading(u => ({ ...u, [colorLabel]: false })); }
  };

  // ── homepage hero image upload ──
  const uploadHeroImage = async (file: File) => {
    if (!file || heroImgUploading) return;
    setHeroImgUploading(true);
    try {
      const form = new FormData();
      form.append('file', file);
      form.append('kind', 'site');
      const res = await fetch('/api/upload', { method: 'POST', body: form });
      const { url } = await res.json();
      if (!res.ok || !url) throw new Error('Upload failed');
      setSetting('heroImage', url);
    } catch (e) {
      onError(e, 'Could not upload hero image.');
    } finally { setHeroImgUploading(false); }
  };

  // ── homepage hero carousel images ──
  const uploadHeroCarouselImage = async (file: File) => {
    if (!file || heroCarouselImgUploading) return;
    setHeroCarouselImgUploading(true);
    try {
      const form = new FormData();
      form.append('file', file);
      form.append('kind', 'site');
      const res = await fetch('/api/upload', { method: 'POST', body: form });
      const { url } = await res.json();
      if (!res.ok || !url) throw new Error('Upload failed');
      setSettingsDirty(true);
      setSettingsDraft(s => ({ ...s, heroImages: [...(s.heroImages ?? []), url] }));
    } catch (e) {
      onError(e, 'Could not upload hero carousel image.');
    } finally { setHeroCarouselImgUploading(false); }
  };
  const removeHeroCarouselImage = (index: number) => {
    setSettingsDirty(true);
    setSettingsDraft(s => ({ ...s, heroImages: (s.heroImages ?? []).filter((_, i) => i !== index) }));
  };
  const moveHeroCarouselImage = (index: number, dir: -1 | 1) => {
    setSettingsDirty(true);
    setSettingsDraft(s => {
      const arr = [...(s.heroImages ?? [])];
      const j = index + dir;
      if (j < 0 || j >= arr.length) return s;
      [arr[index], arr[j]] = [arr[j], arr[index]];
      return { ...s, heroImages: arr };
    });
  };

  // ── homepage workshop image upload ──
  const uploadWorkshopImage = async (file: File) => {
    if (!file || workshopImgUploading) return;
    setWorkshopImgUploading(true);
    try {
      const form = new FormData();
      form.append('file', file);
      form.append('kind', 'site');
      const res = await fetch('/api/upload', { method: 'POST', body: form });
      const { url } = await res.json();
      if (!res.ok || !url) throw new Error('Upload failed');
      setSetting('workshopImage', url);
    } catch (e) {
      onError(e, 'Could not upload workshop image.');
    } finally { setWorkshopImgUploading(false); }
  };

  // ── homepage category card background image upload ──
  const uploadCategoryImage = async (key: string, file: File) => {
    if (!file || categoryImgUploading[key]) return;
    setCategoryImgUploading(u => ({ ...u, [key]: true }));
    try {
      const form = new FormData();
      form.append('file', file);
      form.append('kind', 'site');
      const res = await fetch('/api/upload', { method: 'POST', body: form });
      const { url } = await res.json();
      if (!res.ok || !url) throw new Error('Upload failed');
      setSetting(key, url);
    } catch (e) {
      onError(e, 'Could not upload category image.');
    } finally { setCategoryImgUploading(u => ({ ...u, [key]: false })); }
  };

  // ── user management ──
  const openUserModal = (u?: AdminUser) => {
    setUserModal({ id: u?.id ?? null, draft: u ? { email: u.email, role: u.role, permissions: u.permissions ?? {}, password: '' } : { email: '', role: 'staff', permissions: {}, password: '' }, error: '' });
  };
  const setUserField = (k: string, v: any) => setUserModal(m => m ? { ...m, draft: { ...m.draft, [k]: v }, error: '' } : m);
  const setUserPermission = (module: ModuleKey, level: 'none' | 'read' | 'edit') =>
    setUserModal(m => m ? { ...m, draft: { ...m.draft, permissions: { ...m.draft.permissions, [module]: level } }, error: '' } : m);
  const saveUser = async () => {
    if (!userModal || saving) return;
    const d = userModal.draft;
    if (!d.email?.trim()) { setUserModal(m => m ? { ...m, error: 'Email is required.' } : m); return; }
    if (!userModal.id && !d.password?.trim()) { setUserModal(m => m ? { ...m, error: 'Password is required for new users.' } : m); return; }
    setSaving(true);
    try {
      const permissions = d.role === 'admin' ? {} : d.permissions;
      if (userModal.id) {
        const body: Record<string, unknown> = { role: d.role, permissions };
        if (d.password?.trim()) body.password = d.password;
        await adminApi.updateUser(userModal.id, body as any);
      } else {
        await adminApi.createUser({ email: d.email, password: d.password, role: d.role, permissions });
      }
      await reloadUsers();
      flash(userModal.id ? 'User updated' : 'User created');
      setUserModal(null);
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) { router.replace('/admin/login'); return; }
      setUserModal(m => m ? { ...m, error: e instanceof Error ? e.message : 'Could not save.' } : m);
    } finally { setSaving(false); }
  };
  const deleteUser = async (u: AdminUser) => {
    if (!window.confirm(`Delete ${u.email}? This cannot be undone.`)) return;
    try { await adminApi.deleteUser(u.id); await reloadUsers(); flash('User deleted'); }
    catch (e) { onError(e, 'Could not delete user.'); }
  };

  // ── location management ──
  const saveLocation = async () => {
    if (!locModal || saving) return;
    const { name, showOnWeb, isWebDefault, sortOrder } = locModal.draft;
    if (!name.trim()) { setLocModal(m => m ? { ...m, error: 'Name is required.' } : m); return; }
    setSaving(true);
    try {
      const body = { name: name.trim(), showOnWeb, isWebDefault, sortOrder: parseInt(sortOrder) || 0 };
      if (locModal.id) await adminApi.updateLocation(locModal.id, body);
      else await adminApi.createLocation(body);
      await refresh();
      flash(locModal.id ? 'Location updated' : 'Location created');
      setLocModal(null);
    } catch (e) {
      setLocModal(m => m ? { ...m, error: e instanceof Error ? e.message : 'Could not save.' } : m);
    } finally { setSaving(false); }
  };
  const deleteLocationById = async (id: string, name: string) => {
    if (!window.confirm(`Delete "${name}"?\nAll stock must be transferred out first.`)) return;
    try { await adminApi.deleteLocation(id); await refresh(); flash('Location deleted'); }
    catch (e) { onError(e, 'Could not delete location. Transfer all stock out first.'); }
  };

  // ── delivery area management ──
  const saveDeliveryArea = async () => {
    if (!deliveryAreaModal || saving) return;
    const { name, rate, active, sortOrder } = deliveryAreaModal.draft;
    if (!name.trim()) { setDeliveryAreaModal(m => m ? { ...m, error: 'Name is required.' } : m); return; }
    setSaving(true);
    try {
      const body = { name: name.trim(), rate: parseInt(rate) || 0, active, sortOrder: parseInt(sortOrder) || 0 };
      if (deliveryAreaModal.id) await adminApi.updateDeliveryArea(deliveryAreaModal.id, body);
      else await adminApi.createDeliveryArea(body);
      await reloadDeliveryAreas();
      await refresh();
      flash(deliveryAreaModal.id ? 'Delivery area updated' : 'Delivery area created');
      setDeliveryAreaModal(null);
    } catch (e) {
      setDeliveryAreaModal(m => m ? { ...m, error: e instanceof Error ? e.message : 'Could not save.' } : m);
    } finally { setSaving(false); }
  };
  const deleteDeliveryAreaById = async (id: string, name: string) => {
    if (!window.confirm(`Delete "${name}"?`)) return;
    try { await adminApi.deleteDeliveryArea(id); await reloadDeliveryAreas(); await refresh(); flash('Delivery area deleted'); }
    catch (e) { onError(e, 'Could not delete delivery area.'); }
  };

  // ── cost price (super-admin only) ──
  const saveCostPrice = async (productId: string, costPrice: number) => {
    setCostPriceSaving(s => ({ ...s, [productId]: true }));
    try {
      await adminApi.updateProduct(productId, { costPrice });
      setCostPriceProducts(ps => ps.map(p => p.id === productId ? { ...p, costPrice } : p));
      flash('Cost price saved');
    } catch (e) { onError(e, 'Could not save cost price.'); }
    finally { setCostPriceSaving(s => ({ ...s, [productId]: false })); }
  };

  const logout = async () => {
    try { await adminApi.logout(); } catch { /* ignore */ }
    router.replace('/admin/login');
  };

  // ── derived ──
  const allowedTabs: Tab[] = ALL_TABS.filter(t => tabVisible(t, currentUser));
  const colFilters = [{ k: 'all', label: 'All' }, ...data.collections.map(c => ({ k: c.key, label: c.label }))];
  const filteredProducts = allProducts.filter(p => {
    if (colFilter !== 'all' && p.collection !== colFilter) return false;
    if (search && !p.name.toLowerCase().includes(search.toLowerCase()) && !p.category.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });
  const filteredCustomers = customers.filter(c => {
    if (!search) return true;
    const q = search.toLowerCase();
    return c.name.toLowerCase().includes(q) || c.phone.toLowerCase().includes(q) || (c.email ?? '').toLowerCase().includes(q);
  });
  const openOrders = orders.filter(o => o.stage < 3).length;
  const pendingReviews = reviews.filter(r => r.status === 'pending').length;
  const paidRevenue = orders.filter(o => o.paid).reduce((a, o) => a + o.total, 0);
  const orderFilterOptions: { key: OrderFilter; label: string; count: number }[] = [
    { key: 'all', label: 'All', count: orders.length },
    { key: 'web_checkout', label: 'Online', count: orders.filter(o => o.origin === 'web_checkout').length },
    { key: 'pos_sale', label: 'POS', count: orders.filter(o => o.origin === 'pos_sale').length },
    { key: 'manual_order', label: 'Manual', count: orders.filter(o => o.origin === 'manual_order').length },
    { key: 'quote_conversion', label: 'Quotes', count: orders.filter(o => o.origin === 'quote_conversion').length },
    { key: 'paid', label: 'Paid', count: orders.filter(o => o.paid).length },
    { key: 'unpaid', label: 'Unpaid', count: orders.filter(o => !o.paid).length },
  ];
  const filteredOrders = orders.filter(o => {
    if (orderFilter === 'all') return true;
    if (orderFilter === 'paid') return o.paid;
    if (orderFilter === 'unpaid') return !o.paid;
    return o.origin === orderFilter;
  });
  const ledgerTotals = filteredOrders.reduce((acc, o) => {
    acc.gross += o.subtotal ?? o.total + (o.discount ?? 0);
    acc.discount += o.discount ?? 0;
    acc.total += o.total;
    acc.paid += o.paid ? o.total : 0;
    acc.unpaid += o.paid ? 0 : o.total;
    acc.cash += o.paidCash;
    acc.card += o.paidCard;
    acc.transfer += o.paidTransfer;
    return acc;
  }, { gross: 0, discount: 0, total: 0, paid: 0, unpaid: 0, cash: 0, card: 0, transfer: 0 });
  const s = settingsDraft;
  const storefrontCopy = normalizeStorefrontCopy(s.storefrontCopy);
  const posSubtotal = posCart.reduce((sum, i) => sum + i.unitPrice * i.qty, 0);
  const posDeliveryFee = posMethod === 'Delivery' ? (data.deliveryAreas.find(a => a.id === posDeliveryAreaId)?.rate ?? 0) : 0;
  const posDiscountAmt = posPromo ? Math.min(posPromo.discount, posSubtotal + posDeliveryFee) : Math.min(parseInt(posDiscount) || 0, posSubtotal + posDeliveryFee);
  const posTotal = posSubtotal + posDeliveryFee - posDiscountAmt;
  const posPaidTotal = (parseInt(posCash) || 0) + (parseInt(posCard) || 0) + (parseInt(posTransfer) || 0);
  const posBlockers: string[] = [];
  if (!posLocId) posBlockers.push('Select a location');
  if (posCart.length === 0) posBlockers.push('Add at least one item');
  if (posMethod === 'Delivery' && !posAddress.trim()) posBlockers.push('Enter a delivery address');
  if (posMethod === 'Delivery' && !posDeliveryAreaId) posBlockers.push('Select a delivery area');
  if (posCart.length > 0 && posPaidTotal !== posTotal) {
    posBlockers.push(posPaidTotal < posTotal ? `Payment is short by MVR ${(posTotal - posPaidTotal).toLocaleString()}` : `Payment is over by MVR ${(posPaidTotal - posTotal).toLocaleString()}`);
  }
  const posProducts = allProducts.filter(p => {
    if (p.status !== 'active') return false;
    if (posColFilter !== 'all' && p.collection !== posColFilter) return false;
    if (posSearch && !p.name.toLowerCase().includes(posSearch.toLowerCase()) && !p.category.toLowerCase().includes(posSearch.toLowerCase())) return false;
    return true;
  });
  const manualOrderProduct = allProducts.find(p => p.id === manualOrderProductId) ?? null;
  const manualOrderSubtotal = manualOrderLines.reduce((sum, i) => sum + i.unitPrice * i.qty, 0);
  const manualOrderDeliveryFee = manualOrderDraft.method === 'Delivery' ? (data.deliveryAreas.find(a => a.id === manualOrderDraft.deliveryAreaId)?.rate ?? 0) : 0;
  const manualOrderDiscount = Math.min(parseInt(manualOrderDraft.discount) || 0, manualOrderSubtotal + manualOrderDeliveryFee);
  const manualOrderTotal = Math.max(0, manualOrderSubtotal + manualOrderDeliveryFee - manualOrderDiscount);
  const manualOrderPaidTotal = (parseInt(manualOrderDraft.paidCash) || 0) + (parseInt(manualOrderDraft.paidCard) || 0) + (parseInt(manualOrderDraft.paidTransfer) || 0);
  const manualOrderAvailable = manualOrderProduct ? inventoryStockForVariant(manualOrderInvRows, manualOrderProduct.id, manualOrderColor, manualOrderSize) : 0;
  const pendingDeliveries = orders
    .filter(o => o.method === 'Delivery' && (o.stage === 3 || o.stage === 4))
    .sort((a, b) => daysSinceReady(b) - daysSinceReady(a));

  const colOpts = data.collections.map(c => ({ v: c.key, label: c.label }));
  const isEditingProduct = modal?.kind === 'product' && Boolean(modal.id);
  const adminNavItems = ([
    { k: 'dashboard', label: 'Dashboard',        icon: ADMIN_NAV_ICONS.dashboard },
    { k: 'products',  label: 'Products',         icon: ADMIN_NAV_ICONS.products, badge: String(allProducts.length) },
    { k: 'categories',label: 'Collections',      icon: ADMIN_NAV_ICONS.categories },
    { k: 'orders',    label: 'Orders',           icon: ADMIN_NAV_ICONS.orders, badge: String(openOrders) },
    { k: 'promos',    label: 'Promo Codes',      icon: ADMIN_NAV_ICONS.promos },
    { k: 'sizechart', label: 'Size Chart',       icon: ADMIN_NAV_ICONS.sizechart },
    { k: 'settings',  label: 'Settings',         icon: ADMIN_NAV_ICONS.settings },
    { k: 'pos',       label: 'Point of Sale',    icon: ADMIN_NAV_ICONS.pos },
    { k: 'customers', label: 'Customers',        icon: ADMIN_NAV_ICONS.customers, badge: String(customers.length) },
  ] as const).filter(n => allowedTabs.includes(n.k as Tab));
  const currentTabLabel = adminNavItems.find(n => n.k === tab)?.label ?? 'Admin';

  // ─── render ───────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-page text-body font-archivo flex flex-col lg:flex-row">
      {mobileNavOpen && (
        <button
          type="button"
          aria-label="Close admin menu"
          onClick={() => setMobileNavOpen(false)}
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-[2px] lg:hidden"
        />
      )}

      {/* Sidebar */}
      <aside className={`fixed inset-y-0 left-0 z-50 w-[min(82vw,292px)] bg-[#f9f6f7] border-r border-[rgba(0,0,0,.08)] flex flex-col px-[14px] py-[18px] transition-transform duration-200 ease-out lg:z-auto lg:w-[248px] lg:flex-none lg:min-h-screen lg:sticky lg:top-0 lg:h-screen lg:translate-x-0 ${mobileNavOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="flex items-center gap-[11px] pb-[18px] border-b border-[rgba(0,0,0,.07)]">
          <div className="w-9 h-9 rounded-full overflow-hidden border border-[rgba(219,87,149,.25)] relative flex-none">
            <Image src="/logo-icon.png" alt="Dress Collection" fill className="object-cover" />
          </div>
          <div className="leading-[1.1] flex-1 min-w-0">
            <div className="font-archivo-narrow font-bold text-[14px] tracking-[.1em] uppercase">Dress Collection</div>
            <div className="text-[10.5px] text-muted tracking-[.16em] uppercase mt-[3px]">Admin</div>
          </div>
          <button
            type="button"
            aria-label="Close admin menu"
            onClick={() => setMobileNavOpen(false)}
            className="lg:hidden w-9 h-9 rounded-[9px] border border-[rgba(0,0,0,.1)] bg-surface text-sub text-[18px] cursor-pointer"
          >
            ×
          </button>
        </div>

        <nav className="flex flex-col gap-[3px] mt-4 flex-1 overflow-y-auto pr-1">
          {adminNavItems.map(n => (
            <NavBtn key={n.k} label={n.label} icon={n.icon} badge={(n as any).badge} active={tab === n.k} coming={(n as any).coming} onClick={() => { setTab(n.k as Tab); setSearch(''); setColFilter('all'); setMobileNavOpen(false); }} />
          ))}
        </nav>

        <div className="border-t border-[rgba(0,0,0,.07)] pt-3 flex flex-col gap-1">
          <Link href="/" className="flex items-center gap-[11px] no-underline text-sub text-[12.5px] px-3 py-[9px] rounded-lg hover:text-rose-700 transition-colors"><ArrowUpRight size={14} /> View storefront</Link>
          <button onClick={logout} className="flex items-center gap-[11px] bg-transparent border-none text-[#907481] font-archivo text-[12.5px] px-3 py-[9px] rounded-lg cursor-pointer text-left hover:text-sub transition-colors"><LogOut size={14} /> Log out</button>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 min-w-0 flex flex-col lg:h-screen lg:overflow-hidden">
        {/* topbar */}
        <div className="sticky top-0 z-30 flex-none flex items-center justify-between gap-3 px-4 sm:px-7 py-4" style={{ background: 'rgba(255,255,255,.82)', backdropFilter: 'blur(14px)', borderBottom: '1px solid rgba(0,0,0,.08)' }}>
          <button
            type="button"
            aria-label="Open admin menu"
            aria-expanded={mobileNavOpen}
            onClick={() => setMobileNavOpen(true)}
            className="lg:hidden w-10 h-10 rounded-[10px] border border-[rgba(0,0,0,.1)] bg-surface text-sub cursor-pointer flex-none flex items-center justify-center"
          >
            <Menu size={20} />
          </button>
          <div className="min-w-0 flex-1">
            <div className="lg:hidden text-[10.5px] text-muted tracking-[.16em] uppercase mb-[2px] truncate">{currentTabLabel}</div>
            <h1 className="font-archivo-narrow font-bold text-[22px] sm:text-[24px] tracking-[.01em] truncate">
              {{ dashboard: 'Dashboard', products: 'Products', categories: 'Collections & Categories', orders: 'Orders', settings: 'Settings', sizechart: 'Size Chart', promos: 'Promo Codes & Referrals', pos: 'Point of Sale', customers: 'Customers' }[tab]}
            </h1>
          </div>
          <div className="flex items-center gap-2 sm:gap-3 flex-none">
            {tab === 'products' && (
              <button onClick={() => openModal('product')} className="border-none bg-rose-500 text-[#200612] font-extrabold text-[13px] px-[12px] sm:px-[18px] py-[10px] rounded-[10px] cursor-pointer shadow-rose-sm whitespace-nowrap">+ Add</button>
            )}
            {tab === 'promos' && (
              <button onClick={() => openPromoModal()} className="border-none bg-rose-500 text-[#200612] font-extrabold text-[13px] px-[12px] sm:px-[18px] py-[10px] rounded-[10px] cursor-pointer shadow-rose-sm whitespace-nowrap">+ New</button>
            )}
            <div className="hidden sm:flex items-center gap-[9px] bg-surface border border-[rgba(0,0,0,.08)] rounded-[10px] px-3 py-[7px]">
              <span className="w-7 h-7 rounded-full bg-[linear-gradient(135deg,#600a32,#36021a)] inline-flex items-center justify-center text-[12px] font-extrabold text-rose-700">{(currentUser?.email?.[0] ?? 'A').toUpperCase()}</span>
              <div className="leading-[1.1]"><div className="text-[12px] font-bold truncate max-w-[110px]">{currentUser?.email ?? 'Admin'}</div><div className="text-[10.5px] text-muted">{ROLE_LABEL[currentUser?.role ?? 'admin']}</div></div>
            </div>
          </div>
        </div>

        <div className="p-4 sm:p-7 pb-20 flex-1 lg:overflow-y-auto lg:min-h-0">

          {/* ── DASHBOARD ── */}
          {tab === 'dashboard' && (
            <div>
              {!data.locations.some(l => l.isWebDefault) && (
                <div className="flex items-center justify-between gap-4 bg-[rgba(245,200,66,.1)] border border-[rgba(245,200,66,.25)] rounded-[12px] px-5 py-4 mb-4">
                  <div className="text-[13px] text-[#8a6205]">
                    <span className="font-extrabold">No web-default location configured.</span> Online checkout is not tracking inventory — set one in Locations settings.
                  </div>
                  <button onClick={() => setTab('settings')}
                    className="border border-[rgba(245,200,66,.4)] bg-[rgba(245,200,66,.12)] text-[#8a6205] font-bold text-[12px] px-4 py-[8px] rounded-[8px] cursor-pointer whitespace-nowrap">
                    Go to Locations
                  </button>
                </div>
              )}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
                {[
                  { label: 'Products',          value: allProducts.length, icon: Boxes, iconBg: 'rgba(219,87,149,.1)', iconFg: '#600a32', delta: allProducts.filter(p => p.status === 'active').length + ' active' },
                  { label: 'Open orders',        value: openOrders,           icon: ShoppingCart, iconBg: 'rgba(193,57,120,.12)', iconFg: '#8a1d50', delta: orders.filter(o => !o.paid).length + ' awaiting payment' },
                  { label: 'Pending deliveries', value: pendingDeliveries.length, icon: Truck, iconBg: 'rgba(245,200,66,.12)', iconFg: '#8a6205', delta: pendingDeliveries.length > 0 ? `${daysSinceReady(pendingDeliveries[0])} days oldest` : 'all clear' },
                  { label: 'Confirmed revenue',  value: 'MVR ' + paidRevenue.toLocaleString(), icon: Percent, iconBg: 'rgba(193,57,120,.12)', iconFg: '#8a1d50', delta: 'from paid orders' },
                ].map(st => (
                  <div key={st.label} className="bg-surface border border-[rgba(0,0,0,.08)] rounded-[15px] p-5">
                    <div className="flex items-center justify-between">
                      <span className="text-[12px] text-sub">{st.label}</span>
                      <span className="w-8 h-8 rounded-[9px] inline-flex items-center justify-center" style={{ background: st.iconBg, color: st.iconFg }}><st.icon size={15} /></span>
                    </div>
                    <div className="font-archivo-narrow font-bold text-[32px] mt-[14px] tracking-[.01em]">{st.value}</div>
                    <div className="text-[11.5px] text-muted mt-1">{st.delta}</div>
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 mb-4">
                <div className="bg-surface border border-[rgba(0,0,0,.08)] rounded-[15px] p-5">
                  <div className="flex items-center justify-between mb-[14px]">
                    <span className="font-extrabold text-[14px]">Recent orders</span>
                    <button onClick={() => setTab('orders')} className="border-none bg-transparent text-rose-700 font-semibold text-[12px] cursor-pointer">View all →</button>
                  </div>
                  {orders.slice(0, 4).map(o => {
                    const m = STAGE_META[o.stage];
                    return (
                      <div key={o.id} className="flex items-center gap-3 px-2 py-[11px] rounded-[9px] hover:bg-[rgba(0,0,0,.045)] transition-colors">
                        <span className="text-[12.5px] font-bold text-rose-700 tabular w-[104px] flex-none">{o.id}</span>
                        <div className="flex-1 min-w-0"><div className="text-[13px] truncate">{o.customer}</div><div className="text-[11px] text-muted">{o.date}</div></div>
                        <span className="text-[9.5px] font-extrabold uppercase px-2 py-[3px] rounded-[6px] whitespace-nowrap" style={{ color: m.fg, background: m.bg }}>{ORDER_STAGES[o.stage]}</span>
                        <span className="text-[13px] font-bold tabular w-[88px] text-right flex-none">MVR {o.total.toLocaleString()}</span>
                      </div>
                    );
                  })}
                  {orders.length === 0 && <div className="text-[12.5px] text-muted py-6 text-center">No orders yet.</div>}
                </div>
                <div className="bg-surface border border-[rgba(0,0,0,.08)] rounded-[15px] p-5">
                  <div className="flex items-center justify-between mb-[14px]">
                    <span className="font-extrabold text-[14px]">Pending deliveries</span>
                    <button onClick={() => { setTab('pos'); setPosTab('deliveries'); }} className="border-none bg-transparent text-[#8a6205] font-semibold text-[12px] cursor-pointer">Open →</button>
                  </div>
                  {pendingDeliveries.slice(0, 5).map(o => (
                    <div key={o.id} className="flex items-center gap-[11px] px-2 py-[11px] rounded-[9px] hover:bg-[rgba(0,0,0,.045)] transition-colors">
                      <span className="text-[12px] font-bold text-rose-700 tabular flex-none">{o.id}</span>
                      <div className="flex-1 min-w-0">
                        <div className="text-[12.5px] truncate">{o.customer}</div>
                        <div className="text-[11px] text-muted">{ORDER_STAGES[o.stage]} · {daysSinceReady(o)} day{daysSinceReady(o) === 1 ? '' : 's'}</div>
                      </div>
                    </div>
                  ))}
                  {pendingDeliveries.length === 0 && <div className="text-[12.5px] text-muted py-6 text-center">No pending deliveries.</div>}
                </div>
              </div>

              {/* Low stock */}
              <div className="bg-surface border border-[rgba(0,0,0,.08)] rounded-[15px] p-5">
                <div className="flex items-center gap-[9px] mb-[14px]">
                  <span className="font-extrabold text-[14px]">Low stock</span>
                  <span className="text-[11px] text-muted">items at or below 10 units</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {allProducts.filter(p => p.status !== 'draft' && p.stock <= 10).slice(0, 6).map(p => (
                    <div key={p.id} className="flex items-center gap-3 bg-well rounded-xl p-[11px]"
                      style={{ border: p.stock === 0 ? '1px solid rgba(255,61,77,.25)' : '1px solid rgba(0,0,0,.08)' }}>
                      <span className="w-[38px] h-[38px] rounded-[8px] flex-none" style={{ background: p.img }} />
                      <div className="flex-1 min-w-0"><div className="text-[12.5px] font-semibold truncate">{p.name}</div><div className="text-[11px] text-muted">{p.category}</div></div>
                      <span className="font-extrabold text-[15px] tabular" style={{ color: p.stock === 0 ? '#b80f1d' : '#e81a2b' }}>{p.stock}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ── PRODUCTS ── */}
          {tab === 'products' && (
            <div>
              <div className="flex items-center gap-[10px] mb-4 flex-wrap">
                <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search products…"
                  className="flex-1 min-w-[200px] bg-surface border border-[rgba(0,0,0,.1)] rounded-[10px] px-[14px] py-[11px] text-body font-archivo text-[13.5px] outline-none focus:border-rose-500" />
                <div className="flex gap-[6px]">
                  {colFilters.map(f => {
                    const on = colFilter === f.k;
                    return <button key={f.k} onClick={() => setColFilter(f.k)} className="font-semibold text-[12.5px] px-[14px] py-[9px] rounded-[9px] cursor-pointer transition-all" style={{ border: on ? 'none' : '1px solid rgba(0,0,0,.1)', background: on ? '#db5795' : 'rgba(0,0,0,.08)', color: on ? '#200612' : '#705260' }}>{f.label}</button>;
                  })}
                </div>
              </div>

              <div className="bg-surface border border-[rgba(0,0,0,.08)] rounded-[15px] overflow-x-auto [&>div]:min-w-[680px]">
                <div className="grid px-[18px] py-[13px] bg-[rgba(0,0,0,.045)] border-b border-[rgba(0,0,0,.07)] text-[11px] font-extrabold tracking-[.06em] uppercase text-muted" style={{ gridTemplateColumns: '2.4fr 1.2fr 1fr .8fr 1fr 96px' }}>
                  <span>Product</span><span>Category</span><span>Price</span><span>Stock</span><span>Status</span><span className="text-right">Actions</span>
                </div>
                {filteredProducts.map(p => {
                  const sm = statusMeta(p.status);
                  return (
                    <div key={p.id} className="grid px-[18px] py-[13px] border-b border-[rgba(0,0,0,.07)] items-center hover:bg-[rgba(0,0,0,.045)] transition-colors" style={{ gridTemplateColumns: '2.4fr 1.2fr 1fr .8fr 1fr 96px' }}>
                      <div className="flex items-center gap-3 min-w-0">
                        <span className="w-10 h-10 rounded-[9px] flex-none" style={{ background: p.img }} />
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <div className="text-[13.5px] font-semibold truncate">{p.name}</div>
                            {!p.showInWebStore && <span className="text-[9px] font-extrabold uppercase text-[#e81a2b] bg-[rgba(255,61,77,.1)] border border-[rgba(255,61,77,.3)] px-[6px] py-[2px] rounded-full flex-none">POS only</span>}
                          </div>
                          <div className="text-[11px] text-muted truncate">{p.sub}</div>
                        </div>
                      </div>
                      <span className="text-[12.5px] text-sub">{p.category}</span>
                      <span className="text-[13px] font-bold text-rose-700 tabular">MVR {p.price}</span>
                      <span className="text-[13px] font-bold tabular" style={{ color: p.stock === 0 ? '#b80f1d' : p.stock <= 10 ? '#e81a2b' : '#705260' }}>{p.stock}</span>
                      <span className="text-[10px] font-extrabold uppercase px-[9px] py-1 rounded-[6px] justify-self-start" style={{ color: sm.fg, background: sm.bg }}>{sm.label}</span>
                      <div className="flex gap-[7px] justify-end">
                        <button onClick={() => openModal('product', p as any)} className="w-[30px] h-[30px] rounded-[8px] border border-[rgba(0,0,0,.12)] bg-transparent text-sub cursor-pointer text-[13px] hover:text-rose-700 hover:border-[rgba(219,87,149,.4)] transition-all"><Pencil size={13} /></button>
                        <button onClick={() => askDelete('product', p)} className="w-[30px] h-[30px] rounded-[8px] border border-[rgba(0,0,0,.12)] bg-transparent text-sub cursor-pointer text-[13px] hover:text-[#e81a2b] hover:border-[rgba(255,61,77,.35)] transition-all"><Trash2 size={13} /></button>
                      </div>
                    </div>
                  );
                })}
                {filteredProducts.length === 0 && (
                  <div className="py-12 text-center text-[13px] text-muted">No products match. <button onClick={() => openModal('product')} className="border-none bg-transparent text-rose-700 font-semibold cursor-pointer">Add one →</button></div>
                )}
              </div>
              <div className="text-[12px] text-muted mt-3">Showing {filteredProducts.length} of {allProducts.length} products</div>
            </div>
          )}

          {/* ── CUSTOMERS ── */}
          {tab === 'customers' && (
            <div>
              <div className="flex items-center gap-1 mb-5 -mt-1 flex-wrap">
                {([
                  { k: 'list', label: 'Customers' },
                  { k: 'reviews', label: 'Reviews' },
                  { k: 'notifications', label: 'Notifications' },
                ] as const).filter(t => hasPermission(currentUser, CUSTOMERS_TAB_MODULE[t.k], 'read')).map(t => (
                  <button key={t.k} onClick={() => setCustomersSubTab(t.k)}
                    className="px-4 py-[10px] text-[13px] font-bold border-b-2 transition-colors whitespace-nowrap"
                    style={{ borderColor: customersSubTab === t.k ? '#db5795' : 'transparent', color: customersSubTab === t.k ? '#600a32' : '#705260' }}>
                    {t.label}{t.k === 'reviews' && pendingReviews > 0 ? ` (${pendingReviews})` : ''}
                  </button>
                ))}
              </div>

              {customersSubTab === 'list' && (
                <div>
                  <div className="flex items-center gap-[10px] mb-4 flex-wrap">
                    <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search customers…"
                      className="flex-1 min-w-[200px] bg-surface border border-[rgba(0,0,0,.1)] rounded-[10px] px-[14px] py-[11px] text-body font-archivo text-[13.5px] outline-none focus:border-rose-500" />
                  </div>

                  <div className="bg-surface border border-[rgba(0,0,0,.08)] rounded-[15px] overflow-x-auto [&>div]:min-w-[560px]">
                    <div className="grid px-[18px] py-[13px] bg-[rgba(0,0,0,.045)] border-b border-[rgba(0,0,0,.07)] text-[11px] font-extrabold tracking-[.06em] uppercase text-muted" style={{ gridTemplateColumns: '2fr 1.2fr 1.6fr 1fr' }}>
                      <span>Name</span><span>Phone</span><span>Email</span><span>Customer since</span>
                    </div>
                    {filteredCustomers.map(c => (
                      <div key={c.id} className="grid px-[18px] py-[13px] border-b border-[rgba(0,0,0,.07)] items-center hover:bg-[rgba(0,0,0,.045)] transition-colors" style={{ gridTemplateColumns: '2fr 1.2fr 1.6fr 1fr' }}>
                        <span className="text-[13.5px] font-semibold truncate">{c.name}</span>
                        <span className="text-[12.5px] text-sub tabular">{c.phone}</span>
                        <span className="text-[12.5px] text-sub truncate">{c.email || '—'}</span>
                        <span className="text-[12.5px] text-muted tabular">{new Date(c.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
                      </div>
                    ))}
                    {filteredCustomers.length === 0 && (
                      <div className="py-12 text-center text-[13px] text-muted">No customers match.</div>
                    )}
                  </div>
                  <div className="text-[12px] text-muted mt-3">Showing {filteredCustomers.length} of {customers.length} customers</div>
                </div>
              )}

              {customersSubTab === 'notifications' && (
                <div>
                  <div className="flex items-center justify-between mb-4 gap-[10px] flex-wrap">
                    <span className="font-archivo-narrow font-bold text-[17px]">SMS &amp; Email Delivery</span>
                    <div className="flex items-center gap-[10px] flex-wrap">
                      <select value={notifChannelFilter} onChange={e => setNotifChannelFilter(e.target.value)}
                        className="bg-surface border border-[rgba(0,0,0,.1)] rounded-[9px] px-[10px] py-[8px] text-body font-archivo text-[12.5px] outline-none focus:border-rose-500">
                        <option value="">All channels</option>
                        <option value="email">Email</option>
                        <option value="sms">SMS</option>
                        <option value="telegram">Telegram</option>
                      </select>
                      <select value={notifStatusFilter} onChange={e => setNotifStatusFilter(e.target.value)}
                        className="bg-surface border border-[rgba(0,0,0,.1)] rounded-[9px] px-[10px] py-[8px] text-body font-archivo text-[12.5px] outline-none focus:border-rose-500">
                        <option value="">All statuses</option>
                        <option value="sent">Sent</option>
                        <option value="delivered">Delivered</option>
                        <option value="failed">Failed</option>
                        <option value="skipped">Skipped</option>
                      </select>
                      <select value={notifEventFilter} onChange={e => setNotifEventFilter(e.target.value)}
                        className="bg-surface border border-[rgba(0,0,0,.1)] rounded-[9px] px-[10px] py-[8px] text-body font-archivo text-[12.5px] outline-none focus:border-rose-500">
                        <option value="">All events</option>
                        {Array.from(new Set(notifications.map(n => n.event))).sort().map(ev => (
                          <option key={ev} value={ev}>{ev}</option>
                        ))}
                      </select>
                      <input value={notifSearch} onChange={e => setNotifSearch(e.target.value)} placeholder="Search order ref or recipient…"
                        className="bg-surface border border-[rgba(0,0,0,.1)] rounded-[9px] px-[12px] py-[8px] text-body font-archivo text-[12.5px] outline-none focus:border-rose-500 w-[220px]" />
                      <button onClick={refreshNotificationStatus} disabled={refreshingNotifications}
                        className="border-none bg-rose-500 text-[#200612] font-extrabold text-[12px] px-[14px] py-2 rounded-[9px] cursor-pointer disabled:opacity-50">
                        {refreshingNotifications ? 'Refreshing…' : 'Refresh delivery status'}
                      </button>
                    </div>
                  </div>
                  {(() => {
                    const q = notifSearch.trim().toLowerCase();
                    const filteredNotifications = notifications.filter(n =>
                      (!notifChannelFilter || n.channel === notifChannelFilter) &&
                      (!notifStatusFilter || n.status === notifStatusFilter) &&
                      (!notifEventFilter || n.event === notifEventFilter) &&
                      (!q || (n.orderRef ?? '').toLowerCase().includes(q) || n.recipient.toLowerCase().includes(q))
                    );
                    return (
                      <div className="bg-surface border border-[rgba(0,0,0,.08)] rounded-[15px] overflow-x-auto [&>div]:min-w-[640px]">
                        <div className="grid px-[18px] py-[13px] bg-[rgba(0,0,0,.045)] border-b border-[rgba(0,0,0,.07)] text-[11px] font-extrabold tracking-[.06em] uppercase text-muted" style={{ gridTemplateColumns: '.8fr 1.6fr 1.2fr 1.2fr 1fr 1.2fr' }}>
                          <span>Channel</span><span>Recipient</span><span>Event</span><span>Order Ref</span><span>Status</span><span>Sent At</span>
                        </div>
                        {filteredNotifications.map(n => {
                          const statusColor = n.status === 'delivered' ? '#600a32' : n.status === 'failed' ? '#b80f1d' : n.status === 'skipped' ? '#b8760f' : '#705260';
                          return (
                            <div key={n.id} className="grid px-[18px] py-[13px] border-b border-[rgba(0,0,0,.07)] items-center hover:bg-[rgba(0,0,0,.045)] transition-colors" style={{ gridTemplateColumns: '.8fr 1.6fr 1.2fr 1.2fr 1fr 1.2fr' }}>
                              <span className="text-[11px] font-extrabold uppercase text-sub">{n.channel}</span>
                              <span className="text-[12.5px] text-sub truncate">{n.recipient}</span>
                              <span className="text-[12px] text-sub truncate">{n.event}</span>
                              <span className="text-[12.5px] text-sub tabular truncate">{n.orderRef || '—'}</span>
                              <span>
                                <span className="text-[12px] font-bold uppercase block" style={{ color: statusColor }} title={n.status === 'skipped' ? 'Channel disabled or unconfigured in Admin → Settings — nothing was actually sent.' : undefined}>{n.status}</span>
                                {n.error && <span className="text-[10.5px] block truncate max-w-[220px]" style={{ color: '#b80f1d' }} title={n.error}>{n.error}</span>}
                              </span>
                              <span className="text-[12px] text-muted tabular">{new Date(n.createdAt).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>
                            </div>
                          );
                        })}
                        {filteredNotifications.length === 0 && (
                          <div className="py-12 text-center text-[13px] text-muted">No notifications match.</div>
                        )}
                      </div>
                    );
                  })()}
                </div>
              )}

              {customersSubTab === 'reviews' && (
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-[13px] text-muted">{pendingReviews} pending</span>
                    <button onClick={() => reloadReviews()}
                      className="border border-[rgba(0,0,0,.12)] bg-transparent text-sub font-bold text-[12px] px-[14px] py-[8px] rounded-[9px] cursor-pointer hover:brightness-125 transition-all">
                      <RefreshCw size={12} className="inline mr-1" /> Refresh
                    </button>
                  </div>
                  <div className="bg-surface border border-[rgba(0,0,0,.08)] rounded-[15px] overflow-x-auto [&>div]:min-w-[900px]">
                    <div className="grid px-[18px] py-[13px] bg-[rgba(0,0,0,.045)] border-b border-[rgba(0,0,0,.07)] text-[11px] font-extrabold tracking-[.06em] uppercase text-muted" style={{ gridTemplateColumns: '90px 1.3fr 2fr 1fr .8fr 1.4fr' }}>
                      <span>Rating</span><span>Author</span><span>Review</span><span>Order</span><span>Status</span><span></span>
                    </div>
                    {reviews.map(r => (
                      <div key={r.id} className="grid px-[18px] py-[13px] border-b border-[rgba(0,0,0,.07)] items-center hover:bg-[rgba(0,0,0,.045)] transition-colors" style={{ gridTemplateColumns: '90px 1.3fr 2fr 1fr .8fr 1.4fr' }}>
                        <StarRating rating={r.rating ?? 0} size={13} className="text-rose-700" />
                        <div className="min-w-0"><div className="text-[13px] font-semibold truncate">{r.authorName || r.orderCustomer}</div>{r.authorRole && <div className="text-[11px] text-muted truncate">{r.authorRole}</div>}</div>
                        <div className="text-[12px] text-sub truncate">{r.quote}</div>
                        <button onClick={() => { setTab('orders'); const o = orders.find(o => o.id === r.orderId); if (o) setOrderDrawer(o); }}
                          className="text-[12px] font-bold text-rose-600 tabular hover:underline border-none bg-transparent cursor-pointer p-0 text-left">{r.orderId}</button>
                        <span className="text-[10.5px] font-extrabold uppercase px-[9px] py-[4px] rounded-full w-fit" style={{
                          color: r.status === 'pending' ? '#8a6205' : r.status === 'approved' ? '#600a32' : '#e81a2b',
                          background: r.status === 'pending' ? 'rgba(245,200,66,.1)' : r.status === 'approved' ? 'rgba(219,87,149,.1)' : 'rgba(255,99,112,.1)',
                        }}>{r.status}</span>
                        {r.status === 'pending' ? (
                          <div className="flex items-center gap-2">
                            <button onClick={() => approveReview(r.id)}
                              className="font-extrabold text-[11px] px-[11px] py-[6px] rounded-[8px] cursor-pointer border transition-all whitespace-nowrap"
                              style={{ background: 'rgba(219,87,149,.1)', border: '1px solid rgba(219,87,149,.4)', color: '#600a32' }}>
                              <Check size={12} className="inline mr-1" /> Approve
                            </button>
                            <button onClick={() => rejectReview(r.id)}
                              className="font-extrabold text-[11px] px-[11px] py-[6px] rounded-[8px] cursor-pointer border transition-all whitespace-nowrap"
                              style={{ background: 'rgba(255,99,112,.1)', border: '1px solid rgba(255,99,112,.4)', color: '#e81a2b' }}>
                              <X size={12} className="inline mr-1" /> Reject
                            </button>
                          </div>
                        ) : r.status === 'approved' ? (
                          <label className="flex items-center gap-[7px] text-[11.5px] text-sub cursor-pointer whitespace-nowrap">
                            <input type="checkbox" checked={r.featured} onChange={e => setReviewFeatured(r.id, e.target.checked)} />
                            Featured
                          </label>
                        ) : (
                          <span className="text-[11px] text-muted">{r.resolvedBy}{r.rejectionNote ? ` · "${r.rejectionNote}"` : ''}</span>
                        )}
                      </div>
                    ))}
                    {reviews.length === 0 && <div className="py-12 text-center text-[13px] text-muted">No reviews submitted yet.</div>}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── COLLECTIONS & CATEGORIES ── */}
          {tab === 'categories' && (
            <div>
              <div className="bg-surface border border-[rgba(0,0,0,.08)] rounded-[15px] p-[18px] mb-4">
                <div className="flex items-center justify-between mb-[14px]">
                  <div><span className="font-archivo-narrow font-bold text-[17px]">Collections</span><span className="text-[11px] text-muted ml-2">top-level storefront sections</span></div>
                  <button onClick={() => openModal('collection')} className="border-none bg-rose-500 text-[#200612] font-extrabold text-[12px] px-[14px] py-2 rounded-[9px] cursor-pointer">+ Add collection</button>
                </div>
                <div className="grid gap-[10px]" style={{ gridTemplateColumns: 'repeat(auto-fill,minmax(240px,1fr))' }}>
                  {data.collections.map(c => {
                    const catCount = data.categories.filter(cat => cat.collection === c.key).length;
                    const prodCount = allProducts.filter(p => p.collection === c.key).length;
                    const chartName = c.sizeChartId
                      ? (sizeCharts.find(sc => sc.id === c.sizeChartId)?.name ?? 'Unknown')
                      : `Default${defaultSizeChart ? ` (${defaultSizeChart.name})` : ''}`;
                    return (
                      <div key={c.id} className="flex items-center gap-[11px] bg-well border border-[rgba(0,0,0,.08)] rounded-xl px-[13px] py-3">
                        <div className="flex-1 min-w-0"><div className="flex items-center gap-2"><span className="text-[13.5px] font-bold truncate">{c.label}</span></div><div className="inline-flex items-center gap-1 text-[11px] text-muted">{catCount} categories · {prodCount} products · <Ruler size={10} /> {chartName}</div></div>
                        <button onClick={() => openModal('collection', c as any)} className="w-7 h-7 rounded-[7px] border border-[rgba(0,0,0,.12)] bg-transparent text-sub cursor-pointer text-[12px] hover:text-rose-700 transition-colors"><Pencil size={12} /></button>
                        <button onClick={() => { const det = catCount || prodCount ? `This also removes ${catCount} categor${catCount===1?'y':'ies'} and ${prodCount} product${prodCount===1?'':'s'}.` : undefined; askDelete('collection', c, det); }} className="w-7 h-7 rounded-[7px] border border-[rgba(0,0,0,.12)] bg-transparent text-sub cursor-pointer text-[12px] hover:text-[#e81a2b] transition-colors"><X size={12} /></button>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fill,minmax(280px,1fr))' }}>
                {data.collections.map(cl => {
                  const cats = data.categories.filter(c => c.collection === cl.key);
                  return (
                    <div key={cl.id} className="bg-surface border border-[rgba(0,0,0,.08)] rounded-[15px] p-[18px]">
                      <div className="flex items-center justify-between mb-[14px]">
                        <span className="font-archivo-narrow font-bold text-[17px]">{cl.label}</span>
                        <button onClick={() => openModal('category', { collection: cl.key })} className="border border-[rgba(219,87,149,.3)] bg-[rgba(219,87,149,.06)] text-rose-700 font-bold text-[12px] px-3 py-[7px] rounded-[8px] cursor-pointer">+ Add</button>
                      </div>
                      <div className="flex flex-col gap-[7px]">
                        {cats.map(cat => {
                          const cnt = allProducts.filter(p => p.category === cat.name).length;
                          return (
                            <div key={cat.id} className="flex items-center gap-[10px] bg-well border border-[rgba(0,0,0,.08)] rounded-[10px] px-[13px] py-[11px] hover:bg-[rgba(0,0,0,.055)] transition-colors">
                              <span className="flex-1 text-[13px] font-semibold">{cat.name}</span>
                              <span className="text-[11px] text-muted tabular">{cnt}</span>
                              <button onClick={() => openModal('category', cat as any)} className="w-[26px] h-[26px] rounded-[7px] border border-[rgba(0,0,0,.12)] bg-transparent text-sub cursor-pointer text-[12px] hover:text-rose-700 transition-colors"><Pencil size={12} /></button>
                              <button onClick={() => askDelete('category', cat)} className="w-[26px] h-[26px] rounded-[7px] border border-[rgba(0,0,0,.12)] bg-transparent text-sub cursor-pointer text-[12px] hover:text-[#e81a2b] transition-colors"><X size={12} /></button>
                            </div>
                          );
                        })}
                        {cats.length === 0 && <div className="text-[12px] text-muted py-3 text-center">No categories yet.</div>}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ── ORDERS ── */}
          {tab === 'orders' && (
            <div>
              <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
                <div>
                  <div className="font-bold text-[15px]">Sales ledger</div>
                  <div className="text-[12px] text-muted">{filteredOrders.length} visible of {orders.length} order{orders.length !== 1 ? 's' : ''}</div>
                </div>
                {hasPermission(currentUser, 'orders', 'edit') && (
                  <button onClick={() => setManualOrderModal(true)}
                    className="border-none bg-rose-500 text-[#200612] font-extrabold text-[13px] px-[18px] py-[9px] rounded-[10px] cursor-pointer shadow-rose-sm">
                    + Manual Order
                  </button>
                )}
              </div>
              <div className="flex items-center gap-2 mb-4 overflow-x-auto pb-1">
                {orderFilterOptions.map(opt => (
                  <button key={opt.key} onClick={() => setOrderFilter(opt.key)}
                    className="flex-none border font-extrabold text-[11.5px] px-3 py-[7px] rounded-[8px] cursor-pointer transition-colors"
                    style={{ background: orderFilter === opt.key ? 'rgba(219,87,149,.12)' : 'rgba(0,0,0,.05)', borderColor: orderFilter === opt.key ? 'rgba(219,87,149,.45)' : 'rgba(0,0,0,.1)', color: orderFilter === opt.key ? '#600a32' : '#705260' }}>
                    {opt.label} <span className="tabular opacity-75">{opt.count}</span>
                  </button>
                ))}
              </div>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
                {[
                  ['Gross sales', ledgerTotals.gross],
                  ['Discounts', ledgerTotals.discount],
                  ['Paid collected', ledgerTotals.paid],
                  ['Unpaid balance', ledgerTotals.unpaid],
                  ['Cash', ledgerTotals.cash],
                  ['Card', ledgerTotals.card],
                  ['Bank transfer', ledgerTotals.transfer],
                  ['Net sales', ledgerTotals.total],
                ].map(([label, value]) => (
                  <div key={label} className="bg-surface border border-[rgba(0,0,0,.08)] rounded-[10px] p-3">
                    <div className="text-[10.5px] font-extrabold uppercase tracking-[.06em] text-muted">{label}</div>
                    <div className="text-[15px] font-bold tabular text-body mt-1">MVR {(value as number).toLocaleString()}</div>
                  </div>
                ))}
              </div>
              <div className="bg-surface border border-[rgba(0,0,0,.08)] rounded-[15px] overflow-x-auto [&>div]:min-w-[820px]">
                <div className="grid px-[18px] py-[13px] bg-[rgba(0,0,0,.045)] border-b border-[rgba(0,0,0,.07)] text-[11px] font-extrabold tracking-[.06em] uppercase text-muted" style={{ gridTemplateColumns: '148px 1.3fr 1.5fr .85fr 1fr 1.5fr 56px 36px' }}>
                  <span>Ref</span><span>Customer</span><span>Items</span><span>Total</span><span>Payment</span><span>Status</span><span>Docs</span><span></span>
                </div>
                {filteredOrders.map(o => {
                  const m = STAGE_META[Math.min(o.stage, STAGE_META.length - 1)];
                  const slip = paymentSlip(o);
                  const receipt = paymentReceipt(o);
                  const canDelete = hasPermission(currentUser, 'orders', 'edit');
                  const origin = orderOriginMeta(o);
                  return (
                    <div key={o.id} className="grid px-[18px] py-[13px] border-b border-[rgba(0,0,0,.07)] items-center hover:bg-[rgba(0,0,0,.045)] transition-colors" style={{ gridTemplateColumns: '148px 1.3fr 1.5fr .85fr 1fr 1.5fr 56px 36px' }}>
                      <div className="min-w-0">
                        <button onClick={() => setOrderDrawer(o)} className="text-[12px] font-bold text-rose-700 tabular hover:underline border-none bg-transparent cursor-pointer p-0 text-left">{o.id}</button>
                        <div className="flex items-center gap-1 mt-[2px]">
                          <span className="text-[8.5px] font-extrabold uppercase rounded-[4px] px-[5px] py-[1px] border" style={{ color: origin.tone, background: origin.bg, borderColor: origin.border }}>{origin.label}</span>
                          {o.quoteRef && <span className="text-[8.5px] font-extrabold text-[#8a6205] bg-[rgba(245,200,66,.1)] border border-[rgba(245,200,66,.25)] rounded-[4px] px-[5px] py-[1px]">from {o.quoteRef}</span>}
                          {o.pdfUrl && <a href={o.pdfUrl} target="_blank" rel="noopener noreferrer" title="Download invoice PDF" className="text-[8.5px] font-extrabold text-rose-700 border border-[rgba(219,87,149,.3)] rounded-[4px] px-[5px] py-[1px] no-underline hover:brightness-125">PDF</a>}
                        </div>
                      </div>
                      <div className="min-w-0"><div className="text-[13px] font-semibold truncate">{o.customer}</div><div className="text-[11px] text-muted">{o.date} · {[o.method, o.locationName].filter(Boolean).join(' · ')}</div></div>
                      <span className="text-[12px] text-sub truncate">{o.items}</span>
                      <span className="text-[13px] font-bold tabular">MVR {o.total.toLocaleString()}</span>
                      <button onClick={() => togglePaid(o.id)} className="justify-self-start font-bold text-[11px] px-[11px] py-[5px] rounded-[7px] cursor-pointer border transition-colors"
                        style={{ background: o.paid ? '#db5795' : 'rgba(255,61,77,.12)', color: o.paid ? '#200612' : '#e81a2b', border: o.paid ? 'none' : '1px solid rgba(255,61,77,.35)' }}>
                        {o.paid ? <><Check size={11} className="inline mr-1" /> Paid</> : 'Unpaid'}
                      </button>
                      {o.origin === 'pos_sale' ? (
                        <span className="justify-self-start text-[10.5px] font-extrabold uppercase px-2 py-[5px] rounded-[7px] border border-[rgba(219,87,149,.25)] text-rose-600 bg-[rgba(219,87,149,.07)]">Completed POS sale</span>
                      ) : (
                        <select value={o.stage} onChange={e => setOrderStage(o.id, +e.target.value)}
                          className="bg-well border rounded-[8px] px-[9px] py-[7px] font-archivo font-bold text-[12px] outline-none cursor-pointer"
                          style={{ borderColor: m.fg, color: m.fg }}>
                          {stageOptionsFor(o).map(st => <option key={st.value} value={st.value}>{st.label}</option>)}
                        </select>
                      )}
                      <div className="flex items-center gap-1">
                        {slip && (
                          <button onClick={() => setSlipModal({ url: slip.url, expired: slip.expired })}
                            title={slip.expired ? 'Payment slip expired (auto-deleted after 90 days)' : 'View payment slip'}
                            className={`w-[28px] h-[28px] rounded-[7px] border bg-transparent inline-flex items-center justify-center text-[12px] cursor-pointer transition-all ${slip.expired ? 'border-[rgba(0,0,0,.1)] text-[rgba(0,0,0,.3)]' : 'border-[rgba(0,0,0,.16)] text-sub hover:text-body'}`}>
                            Slip
                          </button>
                        )}
                        {receipt && (
                          <a href={receipt.url} target="_blank" rel="noopener noreferrer" title="Download receipt PDF"
                            className="w-[28px] h-[28px] rounded-[7px] border border-[rgba(219,87,149,.35)] bg-[rgba(219,87,149,.08)] text-rose-700 inline-flex items-center justify-center text-[10px] font-extrabold no-underline hover:brightness-125 transition-all">
                            Rec
                          </a>
                        )}
                        {!slip && !receipt && <span className="text-muted text-[12px]">—</span>}
                      </div>
                      {canDelete ? (
                        <button onClick={() => deleteOrder(o.id, o.id)} title="Delete order"
                          className="w-[28px] h-[28px] rounded-[7px] border border-[rgba(0,0,0,.1)] bg-transparent text-muted cursor-pointer hover:text-[#e81a2b] hover:border-[rgba(255,61,77,.35)] transition-all flex items-center justify-center">
                          <Trash2 size={12} />
                        </button>
                      ) : <span />}
                    </div>
                  );
                })}
                {filteredOrders.length === 0 && <div className="py-12 text-center text-[13px] text-muted">No orders match this filter.</div>}
              </div>
            </div>
          )}

          {/* ── PROMO CODES & REFERRALS ── */}
          {tab === 'promos' && (() => {
            const discLabel = (p: PromoCode) => p.discountType === 'percent' ? `${p.discountValue}% off` : `${formatMVR(p.discountValue)} off`;
            const scopeLabel = (p: PromoCode) => p.scope === 'all' ? 'Everything' : `${p.scope === 'collection' ? 'Collection' : 'Category'} · ${p.scopeValue}`;
            const commLabel = (p: PromoCode) => p.commissionType === 'none' ? '—'
              : p.commissionType === 'percent_of_order' ? `${p.commissionValue}% of order`
              : p.commissionType === 'percent_of_discount' ? `${p.commissionValue}% of discount`
              : `${formatMVR(p.commissionValue)}/use`;
            const totalOwed = referrers.reduce((a, r) => a + r.commission, 0);
            return (
            <div>
              {/* Codes table */}
              <div className="bg-surface border border-[rgba(0,0,0,.08)] rounded-[15px] overflow-x-auto [&>div]:min-w-[820px] mb-6">
                <div className="grid px-[18px] py-[13px] bg-[rgba(0,0,0,.045)] border-b border-[rgba(0,0,0,.07)] text-[11px] font-extrabold tracking-[.06em] uppercase text-muted" style={{ gridTemplateColumns: '1.2fr 1fr 1.3fr 1.2fr 1fr .7fr .8fr' }}>
                  <span>Code</span><span>Discount</span><span>Applies to</span><span>Referrer</span><span>Commission</span><span>Uses</span><span className="text-right">Actions</span>
                </div>
                {promos.map(p => {
                  const expired = p.expiresAt && new Date(p.expiresAt).getTime() < Date.now();
                  return (
                    <div key={p.id} className="grid px-[18px] py-[13px] border-b border-[rgba(0,0,0,.07)] items-center hover:bg-[rgba(0,0,0,.045)] transition-colors" style={{ gridTemplateColumns: '1.2fr 1fr 1.3fr 1.2fr 1fr .7fr .8fr' }}>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-[13px] font-extrabold text-rose-700 tracking-[.04em]">{p.code}</span>
                          {!p.active && <span className="text-[9px] font-extrabold uppercase text-muted bg-[rgba(0,0,0,.08)] px-[6px] py-[2px] rounded">Off</span>}
                          {expired && <span className="text-[9px] font-extrabold uppercase text-[#e81a2b] bg-[rgba(255,61,77,.12)] px-[6px] py-[2px] rounded">Expired</span>}
                        </div>
                        {p.description && <div className="text-[11px] text-muted truncate">{p.description}</div>}
                      </div>
                      <span className="text-[12.5px] text-body font-semibold">{discLabel(p)}</span>
                      <span className="text-[12px] text-sub truncate">{scopeLabel(p)}</span>
                      <span className="text-[12px] text-sub truncate">{p.referrer || '—'}</span>
                      <span className="text-[12px] text-sub">{commLabel(p)}</span>
                      <span className="text-[12.5px] font-bold tabular">{p.timesUsed}{p.maxRedemptions != null ? ` / ${p.maxRedemptions}` : ''}</span>
                      <div className="flex gap-[7px] justify-end">
                        <button onClick={() => openPromoModal(p)} className="w-[30px] h-[30px] rounded-[8px] border border-[rgba(0,0,0,.12)] bg-transparent text-sub cursor-pointer text-[13px] hover:text-rose-700 hover:border-[rgba(219,87,149,.4)] transition-all"><Pencil size={13} /></button>
                        <button onClick={() => askDelete('promo', { id: p.id, name: p.code })} className="w-[30px] h-[30px] rounded-[8px] border border-[rgba(0,0,0,.12)] bg-transparent text-sub cursor-pointer text-[13px] hover:text-[#e81a2b] hover:border-[rgba(255,61,77,.35)] transition-all"><Trash2 size={13} /></button>
                      </div>
                    </div>
                  );
                })}
                {promos.length === 0 && <div className="py-12 text-center text-[13px] text-muted">No codes yet. <button onClick={() => openPromoModal()} className="border-none bg-transparent text-rose-700 font-semibold cursor-pointer">Create one →</button></div>}
              </div>

              {/* Referrer compensation summary */}
              <div className="flex items-center gap-[9px] mb-[14px]">
                <span className="font-archivo-narrow font-bold text-[18px]">Referrer compensation</span>
                <span className="text-[11px] text-muted">from {redemptions.length} redemption{redemptions.length !== 1 ? 's' : ''}</span>
                {totalOwed > 0 && <span className="ml-auto text-[13px] font-bold text-rose-700">Total owed: {formatMVR(totalOwed)}</span>}
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div className="bg-surface border border-[rgba(0,0,0,.08)] rounded-[15px] overflow-x-auto [&>div]:min-w-[420px]">
                  <div className="grid px-[16px] py-[12px] bg-[rgba(0,0,0,.045)] border-b border-[rgba(0,0,0,.07)] text-[11px] font-extrabold tracking-[.06em] uppercase text-muted" style={{ gridTemplateColumns: '1.4fr .7fr 1fr 1fr' }}>
                    <span>Referrer</span><span>Uses</span><span>Sales</span><span className="text-right">Owed</span>
                  </div>
                  {referrers.map(r => (
                    <div key={r.referrer} className="grid px-[16px] py-[12px] border-b border-[rgba(0,0,0,.07)] items-center" style={{ gridTemplateColumns: '1.4fr .7fr 1fr 1fr' }}>
                      <span className="text-[13px] font-semibold truncate">{r.referrer}</span>
                      <span className="text-[12.5px] tabular">{r.redemptions}</span>
                      <span className="text-[12.5px] text-sub tabular">{formatMVR(r.sales)}</span>
                      <span className="text-[13px] font-bold text-rose-700 tabular text-right">{formatMVR(r.commission)}</span>
                    </div>
                  ))}
                  {referrers.length === 0 && <div className="py-10 text-center text-[12.5px] text-muted">No referrer redemptions yet.</div>}
                </div>

                {/* Redemption ledger */}
                <div className="bg-surface border border-[rgba(0,0,0,.08)] rounded-[15px] overflow-x-auto [&>div]:min-w-[440px]">
                  <div className="grid px-[16px] py-[12px] bg-[rgba(0,0,0,.045)] border-b border-[rgba(0,0,0,.07)] text-[11px] font-extrabold tracking-[.06em] uppercase text-muted" style={{ gridTemplateColumns: '1fr 1.2fr 1fr 1fr 1fr' }}>
                    <span>Code</span><span>Order</span><span>Discount</span><span>Referrer</span><span className="text-right">Commission</span>
                  </div>
                  {redemptions.slice(0, 30).map(r => (
                    <div key={r.id} className="grid px-[16px] py-[11px] border-b border-[rgba(0,0,0,.07)] items-center" style={{ gridTemplateColumns: '1fr 1.2fr 1fr 1fr 1fr' }}>
                      <span className="text-[12px] font-bold text-rose-700 truncate">{r.code}</span>
                      <span className="text-[11.5px] text-sub tabular truncate">{r.orderId}</span>
                      <span className="text-[12px] tabular">{formatMVR(r.discount)}</span>
                      <span className="text-[11.5px] text-sub truncate">{r.referrer || '—'}</span>
                      <span className="text-[12px] font-bold tabular text-right">{formatMVR(r.commission)}</span>
                    </div>
                  ))}
                  {redemptions.length === 0 && <div className="py-10 text-center text-[12.5px] text-muted">No redemptions yet.</div>}
                </div>
              </div>
            </div>
            );
          })()}

          {/* ── SIZE CHART ── */}
          {tab === 'sizechart' && (
            <div className="max-w-[920px]">
              <div className="flex gap-[11px] items-start bg-[rgba(219,87,149,.04)] border border-[rgba(219,87,149,.16)] rounded-[13px] px-[18px] py-[14px] mb-[18px]">
                <span className="text-rose-700 text-[15px]"><Info size={15} /></span>
                <div className="text-[12.5px] text-sub leading-[1.5]">Each chart here (e.g. Adult, Kids) can be assigned to one or more collections under <strong className="text-[#705260]">Collections &amp; Categories</strong>. Collections without an assignment fall back to the <strong className="text-[#705260]">★ default</strong> chart. All charts are listed on the <strong className="text-[#705260]">/size-guide</strong> page.</div>
              </div>

              {sizeCharts.map((c) => {
                const dirty = !!scDirty[c.id];
                const usedBy = data.collections.filter(cl => cl.sizeChartId === c.id).length;
                return (
                  <div key={c.id} className="bg-surface border border-[rgba(0,0,0,.08)] rounded-[15px] p-[18px] mb-4">
                    <div className="flex items-center gap-3 mb-[10px]">
                      <input value={c.name} onChange={e => scMutate(c.id, d => { d.name = e.target.value; })}
                        className="flex-1 bg-well border border-[rgba(0,0,0,.12)] rounded-[9px] px-[13px] py-[9px] text-body font-archivo font-bold text-[14px] outline-none focus:border-rose-500" placeholder="Chart name (e.g. Adult)" />
                      <button onClick={() => setDefaultSizeChart(c.id)} disabled={c.isDefault || saving}
                        className="border border-[rgba(219,87,149,.3)] bg-[rgba(219,87,149,.06)] text-rose-700 font-bold text-[12px] px-3 py-[8px] rounded-[8px] cursor-pointer disabled:opacity-70 disabled:cursor-default whitespace-nowrap">
                        {c.isDefault ? <><Star size={11} className="inline mr-1 fill-current" /> Default</> : 'Set as default'}
                      </button>
                      <button onClick={() => { const det = usedBy ? `Used by ${usedBy} collection${usedBy === 1 ? '' : 's'} — they will fall back to the default chart.` : undefined; askDelete('sizechart', c, det); }}
                        disabled={c.isDefault} title={c.isDefault ? 'Set another chart as default before deleting this one' : undefined}
                        className="border border-[rgba(255,61,77,.35)] bg-transparent text-[#e81a2b] font-bold text-[12px] px-3 py-[8px] rounded-[8px] cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed">
                        Remove
                      </button>
                    </div>

                    <textarea value={c.note} onChange={e => scMutate(c.id, d => { d.note = e.target.value; })} placeholder="Intro note (optional)"
                      className="w-full h-[44px] resize-none bg-well border border-[rgba(0,0,0,.12)] rounded-[9px] px-[13px] py-[9px] mb-3 text-body font-archivo text-[13px] outline-none focus:border-rose-500" />

                    <div className="overflow-x-auto">
                      <div className="min-w-[520px]">
                        {/* Column headers */}
                        <div className="flex gap-2 mb-2">
                          {c.columns.map((col, ci) => (
                            <div key={ci} className="flex-1 flex items-center gap-1">
                              <input value={col} onChange={e => scMutate(c.id, d => { d.columns[ci] = e.target.value; })}
                                className="w-full bg-[rgba(219,87,149,.05)] border border-[rgba(219,87,149,.2)] rounded-[8px] px-[10px] py-[7px] text-rose-700 font-extrabold text-[11.5px] uppercase tracking-[.04em] outline-none" placeholder="Column" />
                              {c.columns.length > 1 && <button onClick={() => scRemoveColumn(c.id, ci)} title="Remove column" className="border-none bg-transparent text-muted hover:text-[#e81a2b] cursor-pointer text-[13px] flex-none"><X size={13} /></button>}
                            </div>
                          ))}
                          <button onClick={() => scAddColumn(c.id)} className="flex-none border border-[rgba(0,0,0,.14)] bg-transparent text-sub text-[12px] px-[10px] rounded-[8px] cursor-pointer">+ Col</button>
                        </div>
                        {/* Rows */}
                        {c.rows.map((row, ri) => (
                          <div key={ri} className="flex gap-2 mb-2 items-center">
                            {c.columns.map((_, ci) => (
                              <input key={ci} value={row[ci] ?? ''} onChange={e => scMutate(c.id, d => { d.rows[ri][ci] = e.target.value; })}
                                className="flex-1 bg-well border border-[rgba(0,0,0,.1)] rounded-[8px] px-[10px] py-[7px] text-body font-archivo text-[13px] outline-none focus:border-rose-500 tabular" />
                            ))}
                            <button onClick={() => scRemoveRow(c.id, ri)} title="Remove row" className="flex-none border-none bg-transparent text-muted hover:text-[#e81a2b] cursor-pointer text-[14px]"><Trash2 size={14} /></button>
                          </div>
                        ))}
                      </div>
                    </div>
                    <button onClick={() => scAddRow(c.id)} className="mt-1 border border-[rgba(219,87,149,.3)] bg-[rgba(219,87,149,.06)] text-rose-700 font-bold text-[12px] px-3 py-[7px] rounded-[8px] cursor-pointer">+ Add row</button>

                    <div className="flex items-center gap-3 mt-4">
                      <button onClick={() => saveSizeChart(c.id)} disabled={!dirty || saving}
                        className="border-none bg-rose-400 text-[#200612] font-extrabold text-[13px] px-[20px] py-[10px] rounded-xl cursor-pointer hover:brightness-105 transition-all disabled:opacity-50 disabled:cursor-not-allowed">
                        {saving ? 'Saving…' : 'Save'}
                      </button>
                      {dirty && <span className="text-[12px] text-[#e81a2b]">Unsaved changes</span>}
                    </div>
                  </div>
                );
              })}

              <button onClick={addSizeChart} disabled={saving} className="border border-[rgba(0,0,0,.16)] bg-transparent text-body font-bold text-[13px] px-[18px] py-[11px] rounded-[10px] cursor-pointer disabled:opacity-50">+ Add size chart</button>
            </div>
          )}

          {/* ── POS ── */}
          {tab === 'pos' && (
            <div className="flex flex-col -m-4 sm:-m-7 -mb-20 sm:-mb-20 lg:h-full">

              {/* Sub-tab bar */}
              <div className="flex items-center gap-1 px-5 bg-page border-b border-[rgba(0,0,0,.08)] overflow-x-auto flex-none">
                  {([
                  ...(([
                    { k: 'sales',     label: 'Sales', icon: Store },
                    { k: 'orders',    label: 'POS Sales', icon: Receipt },
                    { k: 'deliveries', label: 'Deliveries', icon: Truck },
                    { k: 'returns',   label: 'Returns', icon: Undo2 },
                    { k: 'inventory', label: 'Inventory', icon: Boxes },
                    { k: 'transfers', label: 'Transfers', icon: ArrowLeftRight },
                  ] as const).filter(t => hasPermission(currentUser, POS_TAB_MODULE[t.k], 'read'))),
                  // Cost Price is gated on role === 'admin' directly, bypassing the
                  // per-module permission grid entirely — staff can never see this
                  // tab regardless of what permissions an admin grants them.
                  ...(currentUser?.role === 'admin' ? [{ k: 'costPrice' as const, label: 'Cost Price', icon: DollarSign }] : []),
                ]).map(t => (
                  <button key={t.k} onClick={() => { setPosTab(t.k); if (t.k === 'inventory' && invLocId) loadInv(invLocId); if (t.k === 'transfers') loadTransfers(); if (t.k === 'costPrice') reloadCostPrices(); }}
                    className="inline-flex items-center gap-[7px] px-4 py-[13px] text-[13px] font-bold border-b-2 transition-colors whitespace-nowrap flex-none"
                    style={{ borderColor: posTab === t.k ? '#db5795' : 'transparent', color: posTab === t.k ? '#600a32' : '#705260' }}>
                    <t.icon size={14} /> {t.label}
                  </button>
                ))}
              </div>

              {/* ── SALES ── */}
              {posTab === 'sales' && (
                <div className="flex flex-col lg:flex-row flex-1 min-h-0">

                  {/* Panel 1: Product browser */}
                  <div className="w-full lg:w-[270px] flex-none flex flex-col min-h-0 border-b lg:border-b-0 lg:border-r border-[rgba(0,0,0,.08)]">
                    <div className="p-3 flex flex-col gap-2 border-b border-[rgba(0,0,0,.08)]">
                      <div className="inline-flex items-center gap-[6px] text-[10.5px] font-extrabold uppercase tracking-[.08em] text-muted"><MapPin size={11} /> 1 · Location &amp; product</div>
                      <select value={posLocId} onChange={e => setPosLocId(e.target.value)}
                        className="w-full rounded-[9px] px-3 py-[9px] text-[12px] font-bold outline-none cursor-pointer"
                        style={{ background: posLocId ? '#f9e8f0' : 'rgba(219,87,149,.08)', border: posLocId ? '1px solid rgba(0,0,0,.12)' : '1px solid rgba(219,87,149,.45)' }}>
                        <option value="">Select location…</option>
                        {data.locations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
                      </select>
                      <input autoFocus value={posSearch} onChange={e => setPosSearch(e.target.value)}
                        onKeyDown={e => {
                          if (e.key === 'Enter' && posProducts.length === 1) {
                            openPosProduct(posProducts[0]);
                            setPosSearch('');
                          }
                        }}
                        placeholder="Scan barcode or search…"
                        className="w-full bg-well border border-[rgba(0,0,0,.12)] rounded-[9px] px-3 py-[9px] text-[12px] outline-none focus:border-rose-500" />
                      <div className="flex gap-[5px] flex-wrap">
                        {colFilters.map(f => {
                          const on = posColFilter === f.k;
                          return <button key={f.k} onClick={() => setPosColFilter(f.k)}
                            className="font-semibold text-[11px] px-[10px] py-[6px] rounded-[7px] cursor-pointer transition-all"
                            style={{ border: on ? 'none' : '1px solid rgba(0,0,0,.1)', background: on ? '#db5795' : 'rgba(0,0,0,.08)', color: on ? '#200612' : '#705260' }}>
                            {f.label}
                          </button>;
                        })}
                      </div>
                    </div>
                    <div className="max-h-[46vh] lg:max-h-none flex-1 overflow-y-auto p-2 flex flex-col gap-[5px]">
                      {!posLocId ? (
                        <div className="text-center text-[12.5px] text-rose-600 bg-[rgba(219,87,149,.06)] border border-[rgba(219,87,149,.2)] rounded-[9px] py-8 px-3 mt-2">
                          Select a location above to browse products.
                        </div>
                      ) : (
                        <>
                          {posProducts.map(p => (
                            <button key={p.id} onClick={() => openPosProduct(p)}
                              className="flex items-center gap-[10px] bg-surface border border-[rgba(0,0,0,.07)] rounded-[9px] p-[9px] text-left cursor-pointer hover:border-[rgba(219,87,149,.3)] transition-all w-full">
                              <span className="w-9 h-9 rounded-[7px] flex-none" style={{ background: p.img }} />
                              <div className="flex-1 min-w-0">
                                <div className="text-[12.5px] font-semibold truncate">{p.name}</div>
                                <div className="text-[11px] text-muted truncate">MVR {p.price.toLocaleString()} · {p.category}</div>
                              </div>
                            </button>
                          ))}
                          {posProducts.length === 0 && <div className="text-center text-muted text-[12px] py-10">No products found.</div>}
                        </>
                      )}
                    </div>
                  </div>

                  {/* Panel 2: Ticket */}
                  <div className="flex-1 flex flex-col min-w-0 min-h-0 border-b lg:border-b-0 lg:border-r border-[rgba(0,0,0,.08)]">
                    <div className="p-4 border-b border-[rgba(0,0,0,.08)] flex items-center justify-between flex-none">
                      <span className="inline-flex items-center gap-[6px] font-bold text-[14px]"><span className="inline-flex items-center gap-[4px] text-muted font-extrabold"><Receipt size={12} /> 2 ·</span> Ticket</span>
                      {posCart.length > 0 && <button onClick={() => { setPosCart([]); setPosReceipt(null); }} className="text-[12px] text-[#e81a2b] border-none bg-transparent cursor-pointer">Clear</button>}
                    </div>

                    {/* Receipt confirmation */}
                    {posReceipt && (
                      <div className="m-3 p-4 bg-[rgba(219,87,149,.06)] border border-[rgba(219,87,149,.25)] rounded-[12px]">
                        <div className="text-[11px] font-extrabold text-rose-600 uppercase tracking-[.08em] mb-1">Order placed</div>
                        <div className="font-bold text-[15px] text-rose-600">{posReceipt.ref}</div>
                        <div className="text-[12px] text-sub mt-1">{posReceipt.customer} · MVR {posReceipt.total.toLocaleString()} · {posReceipt.date}</div>
                        {posReceipt.discount > 0 && <div className="text-[11px] text-[#e81a2b] mt-[2px]">Discount: MVR {posReceipt.discount.toLocaleString()}</div>}
                        <div className="flex items-center gap-3 mt-2">
                          {posReceipt.receiptUrl && (
                            <a href={posReceipt.receiptUrl} target="_blank" rel="noopener noreferrer"
                              className="text-[11.5px] font-bold text-rose-600 border border-[rgba(219,87,149,.3)] px-3 py-[5px] rounded-[7px] no-underline hover:brightness-125 transition-all">
                              ↓ Receipt PDF
                            </a>
                          )}
                          {posReceipt.pdfUrl && (
                            <a href={posReceipt.pdfUrl} target="_blank" rel="noopener noreferrer"
                              className="text-[11.5px] font-bold text-sub border border-[rgba(0,0,0,.14)] px-3 py-[5px] rounded-[7px] no-underline hover:text-body transition-all">
                              ↓ Invoice PDF
                            </a>
                          )}
                          <button onClick={() => setPosReceipt(null)} className="text-[11.5px] text-sub border-none bg-transparent cursor-pointer underline">Dismiss</button>
                        </div>
                      </div>
                    )}

                    <div className="max-h-[42vh] lg:max-h-none flex-1 overflow-y-auto p-3 flex flex-col gap-2">
                      {posCart.length === 0 && !posReceipt && <div className="text-center text-muted text-[12.5px] py-12">Select a product to add it here.</div>}
                      {posCart.map((item, i) => {
                        const effPrice = item.unitPrice;
                        return (
                          <div key={i} className="bg-surface border border-[rgba(0,0,0,.07)] rounded-[10px] p-3 flex items-start gap-3">
                            <span className="w-9 h-9 rounded-[7px] flex-none" style={{ background: item.img }} />
                            <div className="flex-1 min-w-0">
                              <div className="text-[12.5px] font-semibold">{item.name}</div>
                              <div className="text-[11px] text-muted">{[item.size, item.color].filter(Boolean).join(' · ') || item.meta || '—'}</div>
                            </div>
                            <div className="flex flex-col items-end gap-[6px]">
                              <div className="flex items-center gap-1">
                                <button onClick={() => setPosCart(c => c.map((x, j) => j === i ? { ...x, qty: Math.max(1, x.qty - 1) } : x))} className="w-8 h-8 lg:w-6 lg:h-6 bg-[rgba(0,0,0,.08)] border border-[rgba(0,0,0,.1)] rounded-[5px] text-[13px] cursor-pointer">−</button>
                                <span className="w-6 text-center text-[13px] font-bold tabular">{item.qty}</span>
                                <button onClick={() => setPosCart(c => c.map((x, j) => {
                                  if (j !== i) return x;
                                  const available = inventoryStockForVariant(posInvRows, x.sku, x.color, x.size);
                                  if (x.qty >= available) { flash(`Only ${available} unit${available !== 1 ? 's' : ''} available at this location.`); return x; }
                                  return { ...x, qty: x.qty + 1 };
                                }))} className="w-8 h-8 lg:w-6 lg:h-6 bg-[rgba(0,0,0,.08)] border border-[rgba(0,0,0,.1)] rounded-[5px] text-[13px] cursor-pointer">+</button>
                              </div>
                              <span className="text-[13px] font-bold tabular">MVR {(effPrice * item.qty).toLocaleString()}</span>
                              <button onClick={() => setPosCart(c => c.filter((_, j) => j !== i))} className="text-[11px] text-[#e81a2b] border-none bg-transparent cursor-pointer"><X size={11} /></button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    {posCart.length > 0 && (
                      <div className="p-3 border-t border-[rgba(0,0,0,.08)] flex-none">
                        {(posDeliveryFee > 0 || posDiscountAmt > 0) && (
                          <div className="flex justify-between items-center mb-1">
                            <span className="text-[11.5px] text-sub">Subtotal</span>
                            <span className="text-[12px] text-sub tabular">MVR {posSubtotal.toLocaleString()}</span>
                          </div>
                        )}
                        {posDeliveryFee > 0 && (
                          <div className="flex justify-between items-center mb-1">
                            <span className="text-[11.5px] text-sub">Delivery</span>
                            <span className="text-[12px] text-sub tabular">MVR {posDeliveryFee.toLocaleString()}</span>
                          </div>
                        )}
                        {posDiscountAmt > 0 && (
                          <div className="flex justify-between items-center mb-1">
                            <span className="text-[11.5px] text-[#e81a2b]">Discount</span>
                            <span className="text-[12px] text-[#e81a2b] tabular">−MVR {posDiscountAmt.toLocaleString()}</span>
                          </div>
                        )}
                        <div className="flex justify-between items-center">
                          <span className="text-[11.5px] text-sub">{posCart.length} item{posCart.length !== 1 ? 's' : ''} in ticket</span>
                          <span className="text-[11.5px] text-sub">See total in payment panel →</span>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Panel 3: Customer + Payment */}
                  <div className="w-full lg:w-[300px] flex-none flex flex-col min-h-0">
                    <div className="flex-1 overflow-y-auto">
                      <div className="p-4 border-b border-[rgba(0,0,0,.08)]">
                        <div className="text-[13px] font-bold mb-3"><span className="inline-flex items-center gap-[4px] text-muted font-extrabold"><Users size={12} /> 3 ·</span> Customer</div>
                        {[['name', 'Name (optional)', 'text'], ['mobile', 'Mobile (optional)', 'tel'], ['email', 'Email', 'email']].map(([k, lbl, t]) => (
                          <div key={k} className="mb-2">
                            <label className="text-[10.5px] text-sub block mb-1">{lbl}</label>
                            <input type={t} value={(posCustomer as Record<string, string>)[k]} onChange={e => setPosCustomer(c => ({ ...c, [k]: e.target.value }))}
                              className="w-full bg-well border border-[rgba(0,0,0,.12)] rounded-[8px] px-3 py-[8px] text-[12.5px] outline-none focus:border-rose-500" />
                          </div>
                        ))}
                        <div className="grid grid-cols-2 gap-2 mt-3">
                          {(['Pickup', 'Delivery'] as const).map(m => {
                            const MethodIcon = FULFILLMENT_ICONS[m];
                            return (
                              <button key={m} onClick={() => setPosMethod(m)}
                                className="inline-flex items-center justify-center gap-[6px] rounded-[8px] px-3 py-[8px] text-[11.5px] font-extrabold border cursor-pointer transition-colors"
                                style={{ background: posMethod === m ? 'rgba(219,87,149,.08)' : 'transparent', color: posMethod === m ? '#600a32' : '#705260', borderColor: posMethod === m ? 'rgba(219,87,149,.45)' : 'rgba(0,0,0,.12)' }}>
                                <MethodIcon size={13} /> {m}
                              </button>
                            );
                          })}
                        </div>
                        {posMethod === 'Delivery' && (
                          <div className="mt-2">
                            <label className="text-[10.5px] text-sub block mb-1">Delivery area *</label>
                            <select value={posDeliveryAreaId} onChange={e => setPosDeliveryAreaId(e.target.value)}
                              className="w-full bg-well border border-[rgba(0,0,0,.12)] rounded-[8px] px-3 py-[8px] text-[12.5px] outline-none focus:border-rose-500 cursor-pointer mb-2">
                              <option value="">Select area…</option>
                              {data.deliveryAreas.map(a => <option key={a.id} value={a.id}>{a.name} — MVR {a.rate.toLocaleString()}</option>)}
                            </select>
                            <label className="text-[10.5px] text-sub block mb-1">Delivery address *</label>
                            <textarea value={posAddress} onChange={e => setPosAddress(e.target.value)}
                              className="w-full h-[56px] resize-none bg-well border border-[rgba(0,0,0,.12)] rounded-[8px] px-3 py-[8px] text-[12.5px] outline-none focus:border-rose-500" />
                            <div className="text-[10.5px] text-muted mt-1">Delivery fee: MVR {posDeliveryFee.toLocaleString()}</div>
                          </div>
                        )}
                      </div>
                      <div className="p-4">
                        <div className="flex items-center justify-between mb-3">
                          <div className="inline-flex items-center gap-[6px] text-[13px] font-bold">{posDiscountMode === 'promo' ? <><Tag size={13} /> Promo code</> : <><Percent size={13} /> Discount</>}</div>
                          <button type="button"
                            onClick={() => { setPosDiscountMode(mo => mo === 'promo' ? 'manual' : 'promo'); setPosPromo(null); setPosPromoInput(''); setPosPromoError(''); setPosDiscount(''); setPosDiscountNote(''); }}
                            className="text-[11px] text-rose-600 border-none bg-transparent cursor-pointer underline">
                            {posDiscountMode === 'promo' ? 'Use manual discount' : 'Have a promo code?'}
                          </button>
                        </div>

                        {posDiscountMode === 'manual' ? (
                          <>
                            <div className="flex items-center gap-2 mb-1">
                              <label className="text-[11.5px] text-sub w-[64px]">MVR off</label>
                              <input type="number" min="0" value={posDiscount} onChange={e => setPosDiscount(e.target.value)} placeholder="0"
                                className="flex-1 bg-well border border-[rgba(0,0,0,.12)] rounded-[8px] px-3 py-[8px] text-[12.5px] tabular outline-none focus:border-[#ff6370]" />
                            </div>
                            {(parseInt(posDiscount) || 0) > 0 && (
                              <input value={posDiscountNote} onChange={e => setPosDiscountNote(e.target.value)} placeholder="Reason (optional)"
                                className="mb-1 w-full bg-well border border-[rgba(0,0,0,.12)] rounded-[8px] px-3 py-[7px] text-[12px] outline-none focus:border-rose-500" />
                            )}
                          </>
                        ) : !posPromo ? (
                          <>
                            <div className="flex gap-2">
                              <input value={posPromoInput} onChange={e => { setPosPromoInput(e.target.value.toUpperCase()); setPosPromoError(''); }}
                                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); applyPosPromo(); } }}
                                placeholder="Enter code" disabled={posCart.length === 0}
                                className="flex-1 bg-well border border-[rgba(0,0,0,.12)] rounded-[8px] px-3 py-[8px] text-[12.5px] uppercase outline-none focus:border-rose-500 disabled:opacity-50" />
                              <button type="button" onClick={applyPosPromo} disabled={posPromoChecking || !posPromoInput.trim() || posCart.length === 0}
                                className="flex-none text-[11.5px] font-extrabold text-rose-600 border border-[rgba(219,87,149,.3)] bg-transparent rounded-[8px] px-[14px] cursor-pointer disabled:opacity-40">
                                {posPromoChecking ? '…' : 'Apply'}
                              </button>
                            </div>
                            {posPromoError && <div className="text-[11.5px] text-[#e81a2b] mt-[7px]">{posPromoError}</div>}
                          </>
                        ) : (
                          <div className="flex items-center justify-between bg-[rgba(219,87,149,.06)] border border-[rgba(219,87,149,.25)] rounded-[8px] px-3 py-[9px]">
                            <div className="flex items-center gap-2 min-w-0">
                              <span className="text-rose-700 text-[13px]"><Check size={13} /></span>
                              <span className="text-[12.5px] font-bold truncate">{posPromo.code}</span>
                              <span className="text-[11px] text-muted whitespace-nowrap">applied · −MVR {posPromo.discount.toLocaleString()}</span>
                            </div>
                            <button type="button" onClick={removePosPromo} aria-label="Remove code" className="flex-none text-[13px] text-[#e81a2b] border-none bg-transparent cursor-pointer"><X size={13} /></button>
                          </div>
                        )}

                        <div className="inline-flex items-center gap-[6px] text-[13px] font-bold mb-3 mt-4"><DollarSign size={13} /> Payment</div>
                        <div className="grid grid-cols-3 gap-2 mb-2">
                          {(['Cash', 'Card', 'Transfer'] as const).map(m => {
                            const MethodIcon = PAYMENT_METHOD_ICONS[m];
                            return (
                            <button key={m} type="button"
                              onClick={() => {
                                setPosPaymentMethod(m); setPosPaymentSplit(false);
                                if (m !== 'Cash') setPosCash('');
                                if (m !== 'Card') setPosCard('');
                                if (m !== 'Transfer') setPosTransfer('');
                                const current = m === 'Cash' ? posCash : m === 'Card' ? posCard : posTransfer;
                                if (!parseInt(current)) (m === 'Cash' ? setPosCash : m === 'Card' ? setPosCard : setPosTransfer)(String(posTotal));
                              }}
                              className="rounded-[8px] px-2 py-[11px] lg:py-[9px] text-[11px] font-extrabold border cursor-pointer transition-colors flex flex-col items-center gap-[2px]"
                              style={{ background: !posPaymentSplit && posPaymentMethod === m ? 'rgba(219,87,149,.08)' : 'transparent', color: !posPaymentSplit && posPaymentMethod === m ? '#600a32' : '#705260', borderColor: !posPaymentSplit && posPaymentMethod === m ? 'rgba(219,87,149,.45)' : 'rgba(0,0,0,.12)' }}>
                              <MethodIcon size={14} />
                              <span>{m}</span>
                            </button>
                            );
                          })}
                        </div>

                        {!posPaymentSplit ? (
                          <div className="flex items-center gap-2 mb-2">
                            <label className="text-[12px] font-semibold text-sub w-[60px] flex-none">{posPaymentMethod}</label>
                            <input key={posPaymentMethod} type="number" min="0"
                              value={posPaymentMethod === 'Cash' ? posCash : posPaymentMethod === 'Card' ? posCard : posTransfer}
                              onChange={e => (posPaymentMethod === 'Cash' ? setPosCash : posPaymentMethod === 'Card' ? setPosCard : setPosTransfer)(e.target.value)}
                              placeholder="0"
                              className="flex-1 min-w-0 bg-well border border-[rgba(0,0,0,.12)] rounded-[9px] px-3 py-[11px] text-[15px] font-semibold tabular outline-none focus:border-rose-500" />
                          </div>
                        ) : (
                          <>
                            {([['Cash', posCash, setPosCash], ['Card', posCard, setPosCard], ['Transfer', posTransfer, setPosTransfer]] as [string, string, (v: string) => void][]).map(([lbl, val, setFn]) => (
                              <div key={lbl} className="flex items-center gap-2 mb-2">
                                <label className="text-[12px] font-semibold text-sub w-[60px] flex-none">{lbl}</label>
                                <input type="number" min="0" value={val} onChange={e => setFn(e.target.value)} placeholder="0"
                                  className="flex-1 min-w-0 bg-well border border-[rgba(0,0,0,.12)] rounded-[9px] px-3 py-[11px] text-[15px] font-semibold tabular outline-none focus:border-rose-500" />
                                <button type="button"
                                  onClick={() => setFn(String(Math.max(0, posTotal - posPaidTotal + (parseInt(val) || 0))))}
                                  className="flex-none text-[11px] font-extrabold text-rose-600 border border-[rgba(219,87,149,.3)] bg-transparent rounded-[7px] px-[10px] py-[10px] cursor-pointer hover:brightness-125 transition-all">
                                  Exact
                                </button>
                              </div>
                            ))}
                          </>
                        )}
                        <button type="button" onClick={() => setPosPaymentSplit(s => !s)}
                          className="text-[11px] text-rose-600 border-none bg-transparent cursor-pointer underline">
                          {posPaymentSplit ? 'Use one payment method' : 'Split payment'}
                        </button>
                      </div>
                    </div>

                    {/* Footer — Total + Place Order, in-flow at the bottom of this column, always reachable, never overlaps other content */}
                    <div className="flex-none border-t border-[rgba(0,0,0,.1)] p-3 bg-page">
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-[12px] font-bold text-sub">Total</span>
                        <span className="text-[17px] font-extrabold tabular" style={{ color: posCart.length > 0 ? '#600a32' : '#b29fa8' }}>MVR {posTotal.toLocaleString()}</span>
                      </div>
                      {posTotal > 0 && (
                        <div className={`text-[11px] mb-2 font-semibold ${posPaidTotal === posTotal ? 'text-rose-600' : 'text-[#e81a2b]'}`}>
                          {posPaidTotal === posTotal ? <><Check size={11} className="inline mr-1" /> Balanced</> : posPaidTotal < posTotal ? `Short MVR ${(posTotal - posPaidTotal).toLocaleString()}` : `Over MVR ${(posPaidTotal - posTotal).toLocaleString()}`}
                        </div>
                      )}
                      {posBlockers.length > 0 && (
                        <ul className="text-[10.5px] text-[#e81a2b] mb-2 pl-[16px] leading-[1.5] list-disc">
                          {posBlockers.map(b => <li key={b}>{b}</li>)}
                        </ul>
                      )}
                      {posError && <div className="text-[11px] text-[#e81a2b] mb-2 leading-[1.4]">{posError}</div>}
                      <button onClick={submitPosOrder} disabled={posSubmitting || posBlockers.length > 0}
                        className="w-full bg-rose-500 text-[#200612] font-extrabold text-[13.5px] py-[12px] rounded-[9px] border-none cursor-pointer disabled:opacity-50 shadow-rose-sm hover:brightness-105 transition-all">
                        {posSubmitting ? 'Placing…' : 'Place Order'}
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* ── POS ORDERS ── */}
              {posTab === 'orders' && (
                <div className="flex-1 p-5 overflow-y-auto">
                  <div className="flex items-center gap-3 mb-4">
                    <input value={posOrderSearch} onChange={e => setPosOrderSearch(e.target.value)} placeholder="Search by ref, customer…"
                      className="flex-1 max-w-[340px] bg-surface border border-[rgba(0,0,0,.12)] rounded-[9px] px-3 py-[9px] text-[13px] outline-none focus:border-rose-500" />
                    <span className="text-[12px] text-muted">{orders.filter(o => o.origin === 'pos_sale').length} POS sales</span>
                  </div>
                  <div className="bg-surface border border-[rgba(0,0,0,.08)] rounded-[14px] overflow-x-auto">
                    <div className="grid px-4 py-3 bg-[rgba(0,0,0,.045)] border-b border-[rgba(0,0,0,.07)] text-[11px] font-extrabold tracking-[.06em] uppercase text-muted" style={{ gridTemplateColumns: '130px 1.4fr 1.2fr .9fr .8fr 1.1fr 32px' }}>
                      <span>Ref</span><span>Customer</span><span>Items</span><span>Total</span><span>Payment</span><span>Status</span><span></span>
                    </div>
                    {orders
                      .filter(o => o.origin === 'pos_sale' && (!posOrderSearch || o.id.toLowerCase().includes(posOrderSearch.toLowerCase()) || o.customer.toLowerCase().includes(posOrderSearch.toLowerCase())))
                      .map(o => {
                        return (
                          <div key={o.id} className="grid px-4 py-3 border-b border-[rgba(0,0,0,.07)] items-center hover:bg-[rgba(0,0,0,.04)] transition-colors" style={{ gridTemplateColumns: '130px 1.4fr 1.2fr .9fr .8fr 1.1fr 32px' }}>
                            <div>
                              <button onClick={() => setOrderDrawer(o)} className="text-[12px] font-bold text-rose-700 hover:underline border-none bg-transparent cursor-pointer p-0">{o.id}</button>
                              {o.pdfUrl && <a href={o.pdfUrl} target="_blank" rel="noopener noreferrer" className="block text-[8px] font-extrabold text-rose-700 border border-[rgba(219,87,149,.25)] rounded px-1 mt-[2px] w-fit no-underline">PDF</a>}
                            </div>
                            <div className="min-w-0"><div className="text-[12.5px] font-semibold truncate">{o.customer}</div><div className="text-[11px] text-muted">{[o.date, o.locationName].filter(Boolean).join(' · ')}</div></div>
                            <span className="text-[11.5px] text-sub truncate">{o.items}</span>
                            <span className="text-[12.5px] font-bold tabular">MVR {o.total.toLocaleString()}</span>
                            <button onClick={() => togglePaid(o.id)} className="justify-self-start text-[10.5px] font-bold px-[9px] py-[4px] rounded-[6px] cursor-pointer border transition-colors whitespace-nowrap"
                              style={{ background: o.paid ? '#db5795' : 'rgba(255,61,77,.12)', color: o.paid ? '#200612' : '#e81a2b', border: o.paid ? 'none' : '1px solid rgba(255,61,77,.35)' }}>
                              {o.paid ? <><Check size={11} className="inline mr-1" /> Paid</> : 'Unpaid'}
                            </button>
                            <span className="justify-self-start text-[10.5px] font-extrabold uppercase px-2 py-[5px] rounded-[7px] border border-[rgba(219,87,149,.25)] text-rose-600 bg-[rgba(219,87,149,.07)]">Completed POS sale</span>
                            <button onClick={() => deleteOrder(o.id, o.id)} title="Delete" className="w-[26px] h-[26px] rounded-[6px] border border-[rgba(0,0,0,.1)] bg-transparent text-muted cursor-pointer text-[11px] hover:text-[#e81a2b] hover:border-[rgba(255,61,77,.3)] transition-all flex items-center justify-center"><Trash2 size={11} /></button>
                          </div>
                        );
                      })}
                    {orders.filter(o => o.origin === 'pos_sale').length === 0 && <div className="py-10 text-center text-[13px] text-muted">No POS sales yet.</div>}
                  </div>
                </div>
              )}

              {/* ── DELIVERIES ── */}
              {posTab === 'deliveries' && (
                <div className="flex-1 p-5 overflow-y-auto">
                  <div className="flex items-center gap-3 mb-4">
                    <input value={posOrderSearch} onChange={e => setPosOrderSearch(e.target.value)} placeholder="Search delivery ref, customer, address…"
                      className="flex-1 max-w-[380px] bg-surface border border-[rgba(0,0,0,.12)] rounded-[9px] px-3 py-[9px] text-[13px] outline-none focus:border-rose-500" />
                    <span className="text-[12px] text-muted">{orders.filter(o => o.method === 'Delivery').length} delivery orders</span>
                  </div>
                  {(() => {
                    const deliveryOrders = orders
                      .filter(o => o.method === 'Delivery' && (!posOrderSearch || [o.id, o.customer, o.mobile ?? '', o.address ?? ''].some(v => v.toLowerCase().includes(posOrderSearch.toLowerCase()))))
                      .sort((a, b) => (a.stage === 3 || a.stage === 4 ? 0 : 1) - (b.stage === 3 || b.stage === 4 ? 0 : 1) || daysSinceReady(b) - daysSinceReady(a));
                    // "Out for delivery" or "Ready for delivery" — the one-tap Mark Delivered
                    // shortcut only makes sense in these; POS-sale-origin orders keep the
                    // existing read-only status badge (their stage isn't editable here at all).
                    const canMarkDelivered = (o: Order) => (o.stage === 3 || o.stage === 4) && o.origin !== 'pos_sale';
                    const markDelivered = (o: Order) => {
                      if (window.confirm(`Mark ${o.id} (${o.customer}) as delivered?`)) setOrderStage(o.id, 5);
                    };
                    return (
                      <>
                        {/* Desktop: full grid */}
                        <div className="hidden lg:block bg-surface border border-[rgba(0,0,0,.08)] rounded-[14px] overflow-x-auto">
                          <div className="grid px-4 py-3 bg-[rgba(0,0,0,.045)] border-b border-[rgba(0,0,0,.07)] text-[11px] font-extrabold tracking-[.06em] uppercase text-muted" style={{ gridTemplateColumns: '130px 1.1fr 1.5fr .75fr .75fr .85fr 1.5fr' }}>
                            <span>Ref</span><span>Customer</span><span>Address</span><span>Fee</span><span>Total</span><span>Waiting</span><span>Status</span>
                          </div>
                          {deliveryOrders.map(o => {
                            const m = STAGE_META[Math.min(o.stage, STAGE_META.length - 1)];
                            const origin = orderOriginMeta(o);
                            const waiting = o.stage === 3 || o.stage === 4 ? `${daysSinceReady(o)} day${daysSinceReady(o) === 1 ? '' : 's'}` : '—';
                            const tel = telHref(o.mobile);
                            return (
                              <div key={o.id} className="grid px-4 py-3 border-b border-[rgba(0,0,0,.07)] items-center hover:bg-[rgba(0,0,0,.04)] transition-colors" style={{ gridTemplateColumns: '130px 1.1fr 1.5fr .75fr .75fr .85fr 1.5fr' }}>
                                <div>
                                  <button onClick={() => setOrderDrawer(o)} className="text-[12px] font-bold text-rose-700 hover:underline border-none bg-transparent cursor-pointer p-0">{o.id}</button>
                                  <span className="block text-[8px] font-extrabold uppercase rounded px-1 mt-[2px] w-fit border" style={{ color: origin.tone, background: origin.bg, borderColor: origin.border }}>{origin.label}</span>
                                </div>
                                <div className="min-w-0 flex items-center gap-[6px]">
                                  <div className="min-w-0">
                                    <div className="text-[12.5px] font-semibold truncate">{o.customer}</div>
                                    <div className="text-[11px] text-muted">{o.mobile || o.email || '—'}</div>
                                  </div>
                                  {tel && (
                                    <a href={tel} title={`Call ${o.mobile}`} onClick={e => e.stopPropagation()}
                                      className="flex-none inline-flex items-center justify-center w-[26px] h-[26px] rounded-full bg-[rgba(219,87,149,.1)] text-rose-700 hover:bg-[rgba(219,87,149,.18)] transition-colors no-underline">
                                      <Phone size={12} />
                                    </a>
                                  )}
                                </div>
                                <span className="text-[11.5px] text-sub truncate">{o.address || 'No address'}</span>
                                <span className="text-[12px] tabular">MVR {(o.deliveryFee ?? 0).toLocaleString()}</span>
                                <span className="text-[12.5px] font-bold tabular">MVR {o.total.toLocaleString()}</span>
                                <span className="text-[11.5px] text-muted">{waiting}</span>
                                <div className="flex items-center gap-[8px]">
                                  {o.origin === 'pos_sale' ? (
                                    <span className="text-[10.5px] font-extrabold uppercase px-2 py-[5px] rounded-[7px] border" style={{ borderColor: m.fg, color: m.fg, background: m.bg }}>{ORDER_STAGES[o.stage]}</span>
                                  ) : (
                                    <>
                                      {canMarkDelivered(o) && (
                                        <button onClick={() => markDelivered(o)}
                                          className="inline-flex items-center gap-[5px] bg-rose-500 text-[#200612] font-extrabold text-[11px] px-[10px] py-[6px] rounded-[7px] border-none cursor-pointer whitespace-nowrap hover:brightness-105 transition-all">
                                          <CheckCircle2 size={12} /> Mark Delivered
                                        </button>
                                      )}
                                      <select value={o.stage} onChange={e => setOrderStage(o.id, +e.target.value)}
                                        className="bg-well border rounded-[7px] px-[8px] py-[6px] font-archivo font-bold text-[11.5px] outline-none cursor-pointer"
                                        style={{ borderColor: m.fg, color: m.fg }}>
                                        {stageOptionsFor(o).map(st => <option key={st.value} value={st.value}>{st.label}</option>)}
                                      </select>
                                    </>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                          {deliveryOrders.length === 0 && <div className="py-10 text-center text-[13px] text-muted">No delivery orders yet.</div>}
                        </div>

                        {/* Mobile: runner-focused cards — customer, call, address and the
                            Mark Delivered shortcut come first; everything else is secondary. */}
                        <div className="lg:hidden flex flex-col gap-[12px]">
                          {deliveryOrders.map(o => {
                            const m = STAGE_META[Math.min(o.stage, STAGE_META.length - 1)];
                            const origin = orderOriginMeta(o);
                            const waiting = o.stage === 3 || o.stage === 4 ? `${daysSinceReady(o)} day${daysSinceReady(o) === 1 ? '' : 's'}` : '—';
                            const tel = telHref(o.mobile);
                            return (
                              <div key={o.id} className="bg-surface border border-[rgba(0,0,0,.08)] rounded-[14px] p-4">
                                <div className="flex items-start justify-between gap-2 mb-3">
                                  <div className="min-w-0">
                                    <div className="text-[16px] font-bold truncate">{o.customer}</div>
                                    <button onClick={() => setOrderDrawer(o)} className="text-[11.5px] font-bold text-rose-700 hover:underline border-none bg-transparent cursor-pointer p-0">{o.id}</button>
                                    <span className="ml-[6px] text-[8px] font-extrabold uppercase rounded px-1 border" style={{ color: origin.tone, background: origin.bg, borderColor: origin.border }}>{origin.label}</span>
                                  </div>
                                  {tel && (
                                    <a href={tel} title={`Call ${o.mobile}`}
                                      className="flex-none inline-flex items-center justify-center w-[46px] h-[46px] rounded-full bg-rose-500 text-[#200612] no-underline shadow-rose-sm">
                                      <Phone size={19} />
                                    </a>
                                  )}
                                </div>
                                <div className="text-[14px] text-body leading-[1.4] mb-3">{o.address || 'No address on file'}</div>
                                <div className="flex items-center justify-between text-[12.5px] mb-3">
                                  <span className="font-bold tabular">MVR {o.total.toLocaleString()} <span className="font-normal text-muted">total</span></span>
                                  <span className="text-muted">Waiting {waiting}</span>
                                </div>
                                {o.origin === 'pos_sale' ? (
                                  <span className="inline-block text-[10.5px] font-extrabold uppercase px-2 py-[5px] rounded-[7px] border" style={{ borderColor: m.fg, color: m.fg, background: m.bg }}>{ORDER_STAGES[o.stage]}</span>
                                ) : (
                                  <>
                                    {canMarkDelivered(o) && (
                                      <button onClick={() => markDelivered(o)}
                                        className="w-full inline-flex items-center justify-center gap-[7px] bg-rose-500 text-[#200612] font-extrabold text-[14px] py-[13px] rounded-[10px] border-none cursor-pointer shadow-rose-sm hover:brightness-105 transition-all mb-2">
                                        <CheckCircle2 size={16} /> Mark Delivered
                                      </button>
                                    )}
                                    <select value={o.stage} onChange={e => setOrderStage(o.id, +e.target.value)}
                                      className="w-full bg-well border rounded-[7px] px-[8px] py-[8px] font-archivo font-bold text-[11.5px] outline-none cursor-pointer"
                                      style={{ borderColor: m.fg, color: m.fg }}>
                                      {stageOptionsFor(o).map(st => <option key={st.value} value={st.value}>{st.label}</option>)}
                                    </select>
                                  </>
                                )}
                                <div className="text-[10.5px] text-muted mt-2">Fee: MVR {(o.deliveryFee ?? 0).toLocaleString()}</div>
                              </div>
                            );
                          })}
                          {deliveryOrders.length === 0 && <div className="py-10 text-center text-[13px] text-muted">No delivery orders yet.</div>}
                        </div>
                      </>
                    );
                  })()}
                </div>
              )}

              {/* ── RETURNS ── */}
              {posTab === 'returns' && (
                <div className="flex-1 p-5 overflow-y-auto">
                  <div className="grid grid-cols-1 lg:grid-cols-[420px_1fr] gap-5">
                    <div className="bg-surface border border-[rgba(0,0,0,.08)] rounded-[14px] p-5">
                      <div className="font-bold text-[14px] mb-4">Find Order to Return</div>
                      <div className="mb-4">
                        <label className="text-[11px] text-sub block mb-1">Order ref or customer name</label>
                        <input value={posReturnSearch} onChange={e => { setPosReturnSearch(e.target.value); setPosReturnOrder(null); }} placeholder="e.g. DC-26-12345 or customer name"
                          className="w-full bg-well border border-[rgba(0,0,0,.12)] rounded-[9px] px-3 py-[9px] text-[13px] outline-none focus:border-rose-500" />
                      </div>
                      {posReturnSearch.length >= 2 && !posReturnOrder && (
                        <div className="flex flex-col gap-[5px] max-h-[200px] overflow-y-auto mb-4">
                          {orders.filter(o => o.id.toLowerCase().includes(posReturnSearch.toLowerCase()) || o.customer.toLowerCase().includes(posReturnSearch.toLowerCase())).slice(0, 8).map(o => (
                            <button key={o.id} onClick={() => { setPosReturnOrder(o); setPosReturnSearch(o.id); }}
                              className="flex items-center gap-3 p-3 bg-well border border-[rgba(0,0,0,.07)] rounded-[9px] text-left cursor-pointer hover:border-[rgba(219,87,149,.3)] transition-all w-full">
                              <div className="flex-1 min-w-0">
                                <div className="text-[12.5px] font-bold text-rose-700">{o.id}</div>
                                <div className="text-[11.5px] text-sub">{o.customer} · MVR {o.total.toLocaleString()} · {o.date}</div>
                              </div>
                              <span className="text-[10px] font-extrabold uppercase px-2 py-1 rounded-[5px]" style={{ color: STAGE_META[Math.min(o.stage, STAGE_META.length - 1)].fg, background: STAGE_META[Math.min(o.stage, STAGE_META.length - 1)].bg }}>{ORDER_STAGES[o.stage] ?? 'Cancelled'}</span>
                            </button>
                          ))}
                          {orders.filter(o => o.id.toLowerCase().includes(posReturnSearch.toLowerCase()) || o.customer.toLowerCase().includes(posReturnSearch.toLowerCase())).length === 0 && (
                            <div className="text-[12.5px] text-muted py-3 text-center">No orders match.</div>
                          )}
                        </div>
                      )}
                      {posReturnOrder && (
                        <div className="bg-[rgba(255,61,77,.06)] border border-[rgba(255,61,77,.25)] rounded-[12px] p-4 mb-4">
                          <div className="flex items-start justify-between mb-2">
                            <div>
                              <div className="font-bold text-[14px] text-rose-700">{posReturnOrder.id}</div>
                              <div className="text-[12px] text-sub mt-[2px]">{posReturnOrder.customer} · {posReturnOrder.date}</div>
                            </div>
                            <button onClick={() => { setPosReturnOrder(null); setPosReturnSearch(''); }} className="border-none bg-transparent text-muted cursor-pointer text-[16px]"><X size={16} /></button>
                          </div>
                          <div className="text-[12px] text-sub mb-2">{posReturnOrder.items}</div>
                          <div className="flex items-center gap-3 flex-wrap">
                            <span className="font-bold text-[13px]">MVR {posReturnOrder.total.toLocaleString()}</span>
                            <span className="text-[10.5px] font-extrabold uppercase px-2 py-1 rounded-[5px]" style={{ color: STAGE_META[Math.min(posReturnOrder.stage, STAGE_META.length - 1)].fg, background: STAGE_META[Math.min(posReturnOrder.stage, STAGE_META.length - 1)].bg }}>{ORDER_STAGES[posReturnOrder.stage] ?? 'Cancelled'}</span>
                            <span className="text-[10.5px] font-extrabold uppercase px-2 py-1 rounded-[5px]" style={{ background: posReturnOrder.paid ? 'rgba(219,87,149,.1)' : 'rgba(255,61,77,.1)', color: posReturnOrder.paid ? '#600a32' : '#e81a2b' }}>{posReturnOrder.paid ? 'Paid' : 'Unpaid'}</span>
                          </div>
                          {posReturnOrder.stage === 6 ? (
                            <div className="mt-3 text-[12px] text-[#e81a2b] font-semibold">This order is already cancelled.</div>
                          ) : (
                            <>
                              <div className="mt-3">
                                <label className="text-[11px] text-sub block mb-1">Return reason (optional)</label>
                                <input value={posReturnNote} onChange={e => setPosReturnNote(e.target.value)} placeholder="e.g. Wrong size, customer changed mind"
                                  className="w-full bg-well border border-[rgba(0,0,0,.12)] rounded-[8px] px-3 py-[8px] text-[12.5px] outline-none focus:border-[#ff6370]" />
                              </div>
                              <button onClick={() => processReturn(posReturnOrder)} disabled={posReturnSubmitting}
                                className="w-full mt-3 border-none bg-[#ff3d4d] text-white font-extrabold text-[13.5px] py-[11px] rounded-[9px] cursor-pointer disabled:opacity-50 hover:brightness-110 transition-all">
                                {posReturnSubmitting ? 'Processing…' : <><Undo2 size={13} className="inline mr-1" /> Cancel Order / Process Return</>}
                              </button>
                            </>
                          )}
                        </div>
                      )}
                      {!posReturnOrder && posReturnSearch.length < 2 && (
                        <div className="text-[12.5px] text-muted py-4 text-center">Search for an order above to process a return.</div>
                      )}
                    </div>
                    <div>
                      <div className="font-bold text-[14px] mb-3">Recent Cancellations</div>
                      <div className="bg-surface border border-[rgba(0,0,0,.08)] rounded-[14px] overflow-hidden">
                        {orders.filter(o => o.stage === 6).length === 0 && <div className="py-10 text-center text-[13px] text-muted">No cancelled orders.</div>}
                        {orders.filter(o => o.stage === 6).slice(0, 20).map(o => (
                          <div key={o.id} className="flex items-center gap-3 px-4 py-3 border-b border-[rgba(0,0,0,.07)] last:border-0">
                            <div className="flex-1 min-w-0">
                              <div className="text-[12.5px] font-bold text-[#e81a2b]">{o.id}</div>
                              <div className="text-[11.5px] text-sub">{o.customer} · {o.date}</div>
                            </div>
                            <span className="text-[12.5px] font-bold tabular">MVR {o.total.toLocaleString()}</span>
                            <button onClick={() => setOrderDrawer(o)} className="text-[11px] text-sub border border-[rgba(0,0,0,.12)] rounded-[7px] px-3 py-[5px] bg-transparent cursor-pointer hover:text-body transition-colors">View</button>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* ── INVENTORY ── */}
              {posTab === 'inventory' && (
                <div className="flex-1 p-5">
                  <div className="flex items-center gap-3 mb-5 flex-wrap">
                    <select value={invLocId} onChange={e => { setInvLocId(e.target.value); loadInv(e.target.value); }}
                      className="bg-surface border border-[rgba(0,0,0,.12)] rounded-[9px] px-3 py-[9px] text-[13px] font-bold outline-none cursor-pointer">
                      <option value="">Select location…</option>
                      {data.locations.map(l => <option key={l.id} value={l.id}>{l.name}{l.showOnWeb ? ' (web)' : ''}</option>)}
                    </select>
                    {invLocId && (
                      <>
                        <button onClick={() => setInvReceive({ productId: '', productName: '', size: '', color: '', qty: '1' })}
                          className="bg-rose-500 text-[#200612] font-extrabold text-[13px] px-4 py-[9px] rounded-[9px] border-none cursor-pointer shadow-rose-sm">
                          + Receive Stock
                        </button>
                        {hasPermission(currentUser, 'posInventory', 'edit') && (
                          <button onClick={() => setAdjModal({ productId: '', productName: '', size: '', color: '', qty: '', reason: 'correction', note: '' })}
                            className="bg-[rgba(255,61,77,.12)] text-[#e81a2b] border border-[rgba(255,61,77,.3)] font-extrabold text-[13px] px-4 py-[9px] rounded-[9px] cursor-pointer">
                            ± Adjust Stock
                          </button>
                        )}
                      </>
                    )}
                    {invLocId && <button onClick={() => loadInv(invLocId)} className="text-[12px] text-sub border border-[rgba(0,0,0,.12)] rounded-[8px] px-3 py-[9px] bg-transparent cursor-pointer hover:text-body transition-colors"><RefreshCw size={12} className="inline mr-1" /> Refresh</button>}
                  </div>

                  {invLoading && <div className="text-center text-muted text-[13px] py-12">Loading…</div>}
                  {!invLoading && !invLocId && <div className="text-center text-muted text-[13px] py-12">Select a location to view its stock.</div>}
                  {!invLoading && invLocId && invRows.length === 0 && <div className="text-center text-muted text-[13px] py-12">No inventory rows for this location.</div>}
                  {!invLoading && invRows.length > 0 && (
                    <>
                      {/* Desktop: full table */}
                      <div className="hidden lg:block bg-surface border border-[rgba(0,0,0,.08)] rounded-[14px] overflow-auto">
                        <table className="w-full text-[12.5px]">
                          <thead>
                            <tr className="border-b border-[rgba(0,0,0,.08)]">
                              <th className="text-left px-4 py-3 text-sub font-semibold w-[44px]"></th>
                              <th className="text-left px-4 py-3 text-sub font-semibold">Product</th>
                              <th className="text-center px-4 py-3 text-sub font-semibold">Size</th>
                              <th className="text-center px-4 py-3 text-sub font-semibold">Colour</th>
                              <th className="text-left px-4 py-3 text-sub font-semibold min-w-[190px]">Physical location</th>
                              <th className="text-right px-4 py-3 text-sub font-semibold">Qty</th>
                              <th className="px-4 py-3"></th>
                            </tr>
                          </thead>
                          <tbody>
                            {invRows.map((r, i) => (
                              <tr key={i} className="border-b border-[rgba(0,0,0,.07)] last:border-0 hover:bg-[rgba(0,0,0,.04)]">
                                <td className="px-4 py-3"><span className="w-8 h-8 rounded-[7px] block" style={{ background: r.productImg }} /></td>
                                <td className="px-4 py-3 font-medium">{r.productName}</td>
                                <td className="px-4 py-3 text-center text-sub">{r.size || '—'}</td>
                                <td className="px-4 py-3 text-center text-sub">{r.color || 'Unassigned'}</td>
                                <td className="px-4 py-3">
                                  <div className="flex items-center gap-2">
                                    <input
                                      value={r.physicalLocation ?? ''}
                                      onChange={e => {
                                        const value = e.target.value;
                                        setInvRows(rows => rows.map(x => x.locationId === r.locationId && x.productId === r.productId ? { ...x, physicalLocation: value } : x));
                                      }}
                                      onBlur={e => saveInventoryPlacement(r, e.target.value)}
                                      onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur(); }}
                                      placeholder="Shelf A3 / Bin 12"
                                      className="w-full min-w-[160px] bg-well border border-[rgba(0,0,0,.12)] rounded-[8px] px-3 py-[7px] text-[12px] text-body outline-none focus:border-rose-500"
                                    />
                                    {invPlacementSaving[`${r.locationId}:${r.productId}`] && <span className="text-[10.5px] text-sub">Saving…</span>}
                                  </div>
                                </td>
                                <td className="px-4 py-3 text-right font-bold tabular" style={{ color: r.qty === 0 ? '#b80f1d' : r.qty <= 5 ? '#e81a2b' : '#705260' }}>{r.qty}</td>
                                <td className="px-4 py-3 text-right">
                                  <div className="flex items-center gap-1 justify-end">
                                    <button onClick={() => setInvReceive({ productId: r.productId, productName: r.productName, size: r.size, color: r.color, qty: '1' })}
                                      className="text-[11px] text-rose-700 border border-[rgba(219,87,149,.3)] rounded-[6px] px-2 py-1 bg-transparent cursor-pointer hover:bg-[rgba(219,87,149,.06)] transition-colors">
                                      + Receive
                                    </button>
                                    {hasPermission(currentUser, 'posInventory', 'edit') && (
                                      <button onClick={() => setAdjModal({ productId: r.productId, productName: r.productName, size: r.size, color: r.color, qty: '', reason: 'correction', note: '' })}
                                        className="text-[11px] text-[#e81a2b] border border-[rgba(255,61,77,.3)] rounded-[6px] px-2 py-1 bg-transparent cursor-pointer hover:bg-[rgba(255,61,77,.06)] transition-colors">
                                        ± Adjust
                                      </button>
                                    )}
                                  </div>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>

                      {/* Mobile: stacked cards */}
                      <div className="lg:hidden flex flex-col gap-[10px]">
                        {invRows.map((r, i) => (
                          <div key={i} className="bg-surface border border-[rgba(0,0,0,.08)] rounded-[12px] p-4">
                            <div className="flex items-center gap-3 mb-3">
                              <span className="w-9 h-9 rounded-[7px] flex-none" style={{ background: r.productImg }} />
                              <div className="flex-1 min-w-0">
                                <div className="text-[13px] font-semibold truncate">{r.productName}</div>
                                <div className="text-[11.5px] text-muted">{[r.size, r.color || 'Unassigned'].filter(Boolean).join(' · ')}</div>
                              </div>
                              <span className="text-[14px] font-bold tabular flex-none" style={{ color: r.qty === 0 ? '#b80f1d' : r.qty <= 5 ? '#e81a2b' : '#705260' }}>{r.qty}</span>
                            </div>
                            <div className="flex items-center gap-2 mb-3">
                              <input
                                value={r.physicalLocation ?? ''}
                                onChange={e => {
                                  const value = e.target.value;
                                  setInvRows(rows => rows.map(x => x.locationId === r.locationId && x.productId === r.productId ? { ...x, physicalLocation: value } : x));
                                }}
                                onBlur={e => saveInventoryPlacement(r, e.target.value)}
                                onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur(); }}
                                placeholder="Shelf A3 / Bin 12"
                                className="w-full bg-well border border-[rgba(0,0,0,.12)] rounded-[8px] px-3 py-[9px] text-[12.5px] text-body outline-none focus:border-rose-500"
                              />
                              {invPlacementSaving[`${r.locationId}:${r.productId}`] && <span className="text-[10.5px] text-sub flex-none">Saving…</span>}
                            </div>
                            <div className="flex items-center gap-2">
                              <button onClick={() => setInvReceive({ productId: r.productId, productName: r.productName, size: r.size, color: r.color, qty: '1' })}
                                className="flex-1 text-[12px] text-rose-700 border border-[rgba(219,87,149,.3)] rounded-[7px] px-2 py-[8px] bg-transparent cursor-pointer hover:bg-[rgba(219,87,149,.06)] transition-colors">
                                + Receive
                              </button>
                              {hasPermission(currentUser, 'posInventory', 'edit') && (
                                <button onClick={() => setAdjModal({ productId: r.productId, productName: r.productName, size: r.size, color: r.color, qty: '', reason: 'correction', note: '' })}
                                  className="flex-1 text-[12px] text-[#e81a2b] border border-[rgba(255,61,77,.3)] rounded-[7px] px-2 py-[8px] bg-transparent cursor-pointer hover:bg-[rgba(255,61,77,.06)] transition-colors">
                                  ± Adjust
                                </button>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              )}

              {/* ── TRANSFERS ── */}
              {posTab === 'transfers' && (
                <div className="flex-1 p-5">
                  <div className="grid grid-cols-1 lg:grid-cols-[480px_1fr] gap-5">
                    <div>
                      <div className="bg-surface border border-[rgba(0,0,0,.08)] rounded-[14px] p-5 mb-4">
                        <div className="font-bold text-[14px] mb-4">New Transfer</div>
                        <div className="flex flex-col gap-3">
                          {[['From', 'fromId'], ['To', 'toId']].map(([lbl, key]) => (
                            <div key={key}>
                              <label className="text-[11px] text-sub block mb-1">{lbl} location</label>
                              <select value={(xfrForm as Record<string, string>)[key]} onChange={async e => {
                                const newVal = e.target.value;
                                setXfrForm(f => ({ ...f, [key]: newVal }));
                                if (key === 'fromId' && newVal) {
                                  try { const { inventory } = await adminApi.listInventory(newVal); setXfrFromInv(inventory); } catch { setXfrFromInv([]); }
                                } else if (key === 'fromId') { setXfrFromInv([]); }
                              }}
                                className="w-full bg-well border border-[rgba(0,0,0,.12)] rounded-[9px] px-3 py-[9px] text-[13px] outline-none cursor-pointer">
                                <option value="">Select…</option>
                                {data.locations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
                              </select>
                            </div>
                          ))}
                          <div>
                            <label className="text-[11px] text-sub block mb-1">Product</label>
                            <select value={xfrForm.productId} onChange={e => { const p = allProducts.find(x => x.id === e.target.value); setXfrForm(f => ({ ...f, productId: e.target.value, size: p?.sizes[0] ?? '', color: p?.colors[0] ?? '' })); }}
                              className="w-full bg-well border border-[rgba(0,0,0,.12)] rounded-[9px] px-3 py-[9px] text-[13px] outline-none cursor-pointer">
                              <option value="">Select…</option>
                              {allProducts.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                            </select>
                          </div>
                          {xfrForm.productId && (() => {
                            const p = allProducts.find(x => x.id === xfrForm.productId);
                            return p && p.sizes.length > 0 ? (
                              <div>
                                <label className="text-[11px] text-sub block mb-1">Size</label>
                                <select value={xfrForm.size} onChange={e => setXfrForm(f => ({ ...f, size: e.target.value }))}
                                  className="w-full bg-well border border-[rgba(0,0,0,.12)] rounded-[9px] px-3 py-[9px] text-[13px] outline-none cursor-pointer">
                                  {p.sizes.map(s => <option key={s} value={s}>{s}</option>)}
                                </select>
                              </div>
                            ) : null;
                          })()}
                          {xfrForm.productId && (() => {
                            const p = allProducts.find(x => x.id === xfrForm.productId);
                            return p && p.colors.length > 0 ? (
                              <div>
                                <label className="text-[11px] text-sub block mb-1">Colour</label>
                                <select value={xfrForm.color} onChange={e => setXfrForm(f => ({ ...f, color: e.target.value }))}
                                  className="w-full bg-well border border-[rgba(0,0,0,.12)] rounded-[9px] px-3 py-[9px] text-[13px] outline-none cursor-pointer">
                                  {p.colors.map(c => <option key={c} value={c}>{c}</option>)}
                                </select>
                              </div>
                            ) : null;
                          })()}
                          {(() => {
                            if (!xfrForm.fromId || !xfrForm.productId) return null;
                            const avail = xfrFromInv.find(r => r.productId === xfrForm.productId && r.size === (xfrForm.size || '') && r.color === (xfrForm.color || ''));
                            if (avail === undefined) return null;
                            return (
                              <div className={`text-[11.5px] font-semibold px-3 py-2 rounded-[7px] ${avail.qty === 0 ? 'text-[#e81a2b] bg-[rgba(255,61,77,.08)] border border-[rgba(255,61,77,.2)]' : 'text-rose-600 bg-[rgba(219,87,149,.06)] border border-[rgba(219,87,149,.2)]'}`}>
                                Available at source: {avail.qty} unit{avail.qty !== 1 ? 's' : ''}
                              </div>
                            );
                          })()}
                          <div>
                            <label className="text-[11px] text-sub block mb-1">Qty</label>
                            <input type="number" min="1" value={xfrForm.qty} onChange={e => setXfrForm(f => ({ ...f, qty: e.target.value }))}
                              className="w-full bg-well border border-[rgba(0,0,0,.12)] rounded-[9px] px-3 py-[9px] text-[13px] tabular outline-none focus:border-rose-500" />
                          </div>
                          <div>
                            <label className="text-[11px] text-sub block mb-1">Note <span className="text-muted font-normal">(optional)</span></label>
                            <input value={xfrForm.note} onChange={e => setXfrForm(f => ({ ...f, note: e.target.value }))} placeholder="e.g. Seasonal restock"
                              className="w-full bg-well border border-[rgba(0,0,0,.12)] rounded-[9px] px-3 py-[9px] text-[13px] outline-none focus:border-rose-500" />
                          </div>
                          <button onClick={submitTransfer} disabled={xfrSubmitting || !xfrForm.fromId || !xfrForm.toId || !xfrForm.productId}
                            className="bg-rose-500 text-[#200612] font-extrabold text-[13.5px] py-[11px] rounded-[9px] border-none cursor-pointer disabled:opacity-50 shadow-rose-sm hover:brightness-105 transition-all">
                            {xfrSubmitting ? 'Transferring…' : 'Transfer Stock →'}
                          </button>
                        </div>
                      </div>
                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-3">
                        <span className="font-bold text-[14px]">Transfer log</span>
                        <button onClick={loadTransfers} className="text-[12px] text-sub border border-[rgba(0,0,0,.12)] rounded-[8px] px-3 py-[7px] bg-transparent cursor-pointer hover:text-body transition-colors"><RefreshCw size={12} className="inline mr-1" /> Refresh</button>
                      </div>
                      {xfrLog.length === 0 && <div className="text-center text-muted text-[13px] py-10 bg-surface border border-[rgba(0,0,0,.08)] rounded-[14px]">No transfers yet. Use the form to move stock between locations.</div>}
                      {xfrLog.length > 0 && (
                        <div className="bg-surface border border-[rgba(0,0,0,.08)] rounded-[14px] overflow-auto">
                          <table className="w-full text-[12px]">
                            <thead>
                              <tr className="border-b border-[rgba(0,0,0,.08)]">
                                {['Product', 'Size', 'Colour', 'Qty', 'From', 'To', 'Actor', 'Date'].map(h => (
                                  <th key={h} className="text-left px-3 py-3 text-sub font-semibold whitespace-nowrap">{h}</th>
                                ))}
                              </tr>
                            </thead>
                            <tbody>
                              {xfrLog.map(t => (
                                <tr key={t.id} className="border-b border-[rgba(0,0,0,.07)] last:border-0">
                                  <td className="px-3 py-3 font-medium max-w-[160px] truncate">{t.productName}</td>
                                  <td className="px-3 py-3 text-sub">{t.size || '—'}</td>
                                  <td className="px-3 py-3 text-sub">{t.color || '—'}</td>
                                  <td className="px-3 py-3 font-bold tabular text-rose-600">{t.qty}</td>
                                  <td className="px-3 py-3 text-sub max-w-[100px] truncate">{t.fromName}</td>
                                  <td className="px-3 py-3 text-sub max-w-[100px] truncate">{t.toName}</td>
                                  <td className="px-3 py-3 text-muted max-w-[120px] truncate">{t.actor}</td>
                                  <td className="px-3 py-3 text-muted whitespace-nowrap">{new Date(t.date).toLocaleDateString('en-GB', { day:'2-digit', month:'short' })}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* ── COST PRICE (super-admin only) ── */}
              {posTab === 'costPrice' && currentUser?.role === 'admin' && (
                <div className="flex-1 p-5 overflow-y-auto">
                  <div className="text-[12px] text-muted mb-4">Cost price is visible only to super admins. It never appears on the storefront or to staff accounts.</div>
                  <div className="bg-surface border border-[rgba(0,0,0,.08)] rounded-[15px] overflow-x-auto">
                    <div className="grid px-[18px] py-[12px] bg-[rgba(0,0,0,.045)] border-b border-[rgba(0,0,0,.07)] text-[11px] font-extrabold tracking-[.06em] uppercase text-muted" style={{ gridTemplateColumns: '1fr .5fr .6fr .8fr 90px' }}>
                      <span>Product</span><span>Status</span><span>Price</span><span>Cost price</span><span className="text-right">Save</span>
                    </div>
                    {costPriceProducts.map(p => (
                      <CostPriceRow key={p.id} product={p} saving={!!costPriceSaving[p.id]} onSave={saveCostPrice} />
                    ))}
                    {costPriceProducts.length === 0 && <div className="py-8 text-center text-[12.5px] text-muted">No products yet.</div>}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── SETTINGS ── */}
          {tab === 'settings' && (
            <>
            <div className="max-w-[920px] pb-20">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div className="bg-surface border border-[rgba(0,0,0,.08)] rounded-[15px] p-[22px]">
                  <div className="font-archivo-narrow font-bold text-[18px] mb-4">Store details</div>
                  {(['storeName','tagline','email','adminEmail','phone','address'] as const).map(k => (
                    <FieldInput key={k} label={{ storeName:'Store name', tagline:'Tagline', email:'Email', adminEmail:'Admin alert email', phone:'Phone / WhatsApp', address:'Address' }[k]} value={String(s[k])} onChange={v => setSetting(k, v)} />
                  ))}
                  <div className="text-[11px] text-muted mt-[-10px]">Where "new order" alert emails are sent to staff — separate from the storefront contact email above.</div>
                </div>
                <div className="flex flex-col gap-4">
                  <div className="bg-surface border border-[rgba(0,0,0,.08)] rounded-[15px] p-[22px]">
                    <div className="font-archivo-narrow font-bold text-[18px] mb-4">Payment &amp; fulfilment</div>
                    {/* Bank accounts */}
                    <div className="mb-[16px]">
                      <div className="flex items-center justify-between mb-[10px]">
                        <label className="text-[11.5px] font-semibold text-sub">Bank accounts</label>
                        <button type="button" onClick={() => setSetting('bankAccounts', [...(s.bankAccounts ?? []), { name: '', accountNumber: '' }])}
                          className="border border-[rgba(219,87,149,.35)] bg-[rgba(219,87,149,.06)] text-rose-700 font-bold text-[11.5px] px-[10px] py-[5px] rounded-[7px] cursor-pointer">+ Add</button>
                      </div>
                      <div className="flex flex-col gap-[8px]">
                        {(s.bankAccounts ?? []).map((acct, i) => (
                          <div key={i} className="flex flex-col sm:flex-row gap-[8px] sm:items-center">
                            <input value={acct.name} onChange={e => { const updated = [...(s.bankAccounts ?? [])]; updated[i] = { ...updated[i], name: e.target.value }; setSetting('bankAccounts', updated); }}
                              placeholder="Bank name (e.g. BML)" className="flex-1 min-w-0 bg-well border border-[rgba(0,0,0,.12)] rounded-[8px] px-[11px] py-[8px] text-body font-archivo text-[13px] outline-none focus:border-rose-500" />
                            <input value={acct.accountNumber} onChange={e => { const updated = [...(s.bankAccounts ?? [])]; updated[i] = { ...updated[i], accountNumber: e.target.value }; setSetting('bankAccounts', updated); }}
                              placeholder="Account number" className="flex-1 min-w-0 bg-well border border-[rgba(0,0,0,.12)] rounded-[8px] px-[11px] py-[8px] text-body font-archivo text-[13px] outline-none focus:border-rose-500 tabular" />
                            <button type="button" onClick={() => { const updated = (s.bankAccounts ?? []).filter((_, j) => j !== i); setSetting('bankAccounts', updated); }}
                              className="w-[30px] h-[30px] rounded-[7px] border border-[rgba(0,0,0,.12)] bg-transparent text-sub cursor-pointer text-[12px] flex-none hover:text-[#e81a2b] hover:border-[rgba(255,61,77,.35)] transition-all"><X size={12} /></button>
                          </div>
                        ))}
                        {(s.bankAccounts ?? []).length === 0 && <div className="text-[12px] text-muted py-1">No accounts added yet.</div>}
                      </div>
                    </div>
                    <div>
                      <label className="text-[11.5px] font-semibold text-sub block mb-[6px]">Pickup</label>
                      <button onClick={() => setSetting('pickupEnabled', !s.pickupEnabled)}
                        className="w-full font-bold text-[13px] px-4 py-[10px] rounded-[9px] cursor-pointer transition-all"
                        style={{ border: s.pickupEnabled ? 'none' : '1px solid rgba(0,0,0,.16)', background: s.pickupEnabled ? '#db5795' : 'transparent', color: s.pickupEnabled ? '#200612' : '#705260' }}>
                        {s.pickupEnabled ? <><Check size={11} className="inline mr-1" /> Enabled</> : 'Disabled'}
                      </button>
                    </div>
                    <div className="text-[11.5px] text-muted leading-[1.5] mt-3">Card payments are intentionally disabled — online checkout is delivery-only, bank transfer.</div>
                  </div>
                  <div className="bg-surface border border-[rgba(0,0,0,.08)] rounded-[15px] p-[22px]">
                    <div className="font-archivo-narrow font-bold text-[18px] mb-1">Telegram staff alerts</div>
                    <div className="text-[12px] text-muted mb-4">Pings a Telegram group when a new order or status change happens — for staff, never sent to customers.</div>
                    {s.telegramConnected ? (
                      <div className="flex items-center justify-between gap-2 mb-4 text-[12.5px]">
                        <span className="text-sub">Connected as <span className="font-semibold">@{s.telegramBotUsername}</span></span>
                        <button type="button" onClick={disconnectTelegram} disabled={telegramDisconnecting}
                          className="border border-[rgba(0,0,0,.16)] text-muted font-bold text-[12px] px-[12px] py-[7px] rounded-[8px] cursor-pointer disabled:opacity-50">
                          {telegramDisconnecting ? 'Disconnecting…' : 'Disconnect'}
                        </button>
                      </div>
                    ) : (
                      <FieldInput label="Bot token (from @BotFather)" value={telegramTokenDraft} onChange={setTelegramTokenDraft} />
                    )}
                    <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-2 items-end">
                      <FieldInput label="Chat ID" value={s.telegramChatId ?? ''} onChange={v => setSetting('telegramChatId', v)} />
                      <button type="button" onClick={detectTelegramChatId} disabled={telegramDetecting || (!telegramTokenDraft.trim() && !s.telegramConnected)}
                        className="mb-[15px] border border-[rgba(219,87,149,.35)] bg-[rgba(219,87,149,.06)] text-rose-700 font-bold text-[12px] px-[12px] py-[9px] rounded-[8px] cursor-pointer disabled:opacity-50 whitespace-nowrap">
                        {telegramDetecting ? 'Detecting…' : 'Detect chat ID'}
                      </button>
                    </div>
                    {telegramChatOptions.length > 0 && (
                      <div className="flex flex-col gap-[6px] mb-3">
                        {telegramChatOptions.map(chat => (
                          <button key={chat.id} type="button"
                            onClick={() => { setSetting('telegramChatId', chat.id); setTelegramChatOptions([]); setTelegramMessage(`Picked "${chat.title}".`); }}
                            className="text-left text-[12px] font-semibold px-[12px] py-[8px] rounded-[8px] border border-[rgba(0,0,0,.1)] bg-well cursor-pointer hover:border-rose-400">
                            {chat.title} <span className="text-muted font-normal">({chat.id})</span>
                          </button>
                        ))}
                      </div>
                    )}
                    <button type="button" onClick={testTelegram} disabled={telegramTesting || !String(s.telegramChatId ?? '').trim() || (!telegramTokenDraft.trim() && !s.telegramConnected)}
                      className="w-full border border-[rgba(219,87,149,.35)] bg-[rgba(219,87,149,.06)] text-rose-700 font-bold text-[12px] px-[14px] py-[9px] rounded-[8px] cursor-pointer disabled:opacity-50 mb-3">
                      {telegramTesting ? 'Testing…' : s.telegramConnected ? 'Test & update' : 'Test & connect'}
                    </button>
                    <button onClick={() => setSetting('telegramAlertsEnabled', !s.telegramAlertsEnabled)} disabled={!s.telegramConnected}
                      className="w-full font-bold text-[13px] px-4 py-[10px] rounded-[9px] cursor-pointer transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                      style={{ border: s.telegramAlertsEnabled ? 'none' : '1px solid rgba(0,0,0,.16)', background: s.telegramAlertsEnabled ? '#db5795' : 'transparent', color: s.telegramAlertsEnabled ? '#200612' : '#705260' }}>
                      {s.telegramAlertsEnabled ? <><Check size={11} className="inline mr-1" /> Alerts enabled</> : 'Alerts disabled'}
                    </button>
                    {s.telegramLastTestAt && (
                      <div className="text-[11.5px] text-muted leading-[1.5] mt-3">Last tested {new Date(s.telegramLastTestAt).toLocaleString()}</div>
                    )}
                    {telegramMessage && <div className="text-[11.5px] text-muted leading-[1.5] mt-3">{telegramMessage}</div>}
                  </div>
                  <div className="bg-surface border border-[rgba(0,0,0,.08)] rounded-[15px] p-[22px]">
                    <div className="font-archivo-narrow font-bold text-[18px] mb-1">Email (Resend)</div>
                    <div className="text-[12px] text-muted mb-4">Sends order emails to customers.</div>
                    {s.emailConnected ? (
                      <div className="flex items-center justify-between gap-2 mb-4 text-[12.5px]">
                        <span className="text-sub">Connected — sending as <span className="font-semibold">{s.emailFromUser}@…</span></span>
                        <button type="button" onClick={disconnectEmail} disabled={emailDisconnecting}
                          className="border border-[rgba(0,0,0,.16)] text-muted font-bold text-[12px] px-[12px] py-[7px] rounded-[8px] cursor-pointer disabled:opacity-50">
                          {emailDisconnecting ? 'Disconnecting…' : 'Disconnect'}
                        </button>
                      </div>
                    ) : (
                      <FieldInput label="Resend API key" value={resendApiKeyDraft} onChange={setResendApiKeyDraft} />
                    )}
                    <FieldInput label="Send from (username @ your sending domain)" value={s.emailFromUser ?? ''} onChange={v => setSetting('emailFromUser', v)} />
                    <div className="text-[11px] text-muted mt-[-10px] mb-3">Emails send as <code>{(s.emailFromUser || 'username')}@&lt;domain&gt;</code> — the domain is fixed via the <code>EMAIL_SENDING_DOMAIN</code> environment variable (requires DNS + Resend domain verification, so it isn&apos;t editable here).</div>
                    <FieldInput label="From display name" value={s.emailFromName ?? ''} onChange={v => setSetting('emailFromName', v)} />
                    <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-2 items-end">
                      <FieldInput label="Send test email to" value={emailTestRecipient} onChange={setEmailTestRecipient} placeholder="you@example.com" />
                      <button type="button" onClick={testEmail}
                        disabled={emailTesting || !String(s.emailFromUser ?? '').trim() || !emailTestRecipient.trim() || (!resendApiKeyDraft.trim() && !s.emailConnected)}
                        className="mb-[15px] border border-[rgba(219,87,149,.35)] bg-[rgba(219,87,149,.06)] text-rose-700 font-bold text-[12px] px-[12px] py-[9px] rounded-[8px] cursor-pointer disabled:opacity-50 whitespace-nowrap">
                        {emailTesting ? 'Testing…' : s.emailConnected ? 'Test & update' : 'Test & connect'}
                      </button>
                    </div>
                    <button onClick={() => setSetting('emailAlertsEnabled', !s.emailAlertsEnabled)} disabled={!s.emailConnected}
                      className="w-full font-bold text-[13px] px-4 py-[10px] rounded-[9px] cursor-pointer transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                      style={{ border: s.emailAlertsEnabled ? 'none' : '1px solid rgba(0,0,0,.16)', background: s.emailAlertsEnabled ? '#db5795' : 'transparent', color: s.emailAlertsEnabled ? '#200612' : '#705260' }}>
                      {s.emailAlertsEnabled ? <><Check size={11} className="inline mr-1" /> Emails enabled</> : 'Emails disabled'}
                    </button>
                    {s.emailLastTestAt && (
                      <div className="text-[11.5px] text-muted leading-[1.5] mt-3">Last tested {new Date(s.emailLastTestAt).toLocaleString()}</div>
                    )}
                    {emailMessage && <div className="text-[11.5px] text-muted leading-[1.5] mt-3">{emailMessage}</div>}
                    <div className="text-[11px] text-muted leading-[1.5] mt-3">Get your API key from the Resend dashboard → API Keys. The sending domain and whether email is active at all (<code>EMAIL_SENDING_DOMAIN</code>, <code>EMAIL_DRIVER</code>) are set via Vercel environment variables — everything else here is editable without redeploying.</div>
                  </div>
                  <div className="bg-surface border border-[rgba(0,0,0,.08)] rounded-[15px] p-[22px]">
                    <div className="font-archivo-narrow font-bold text-[18px] mb-1">SMS Gateway (MsgOwl)</div>
                    <div className="text-[12px] text-muted mb-4">Sends order text messages to customers, when a mobile number is on file.</div>
                    {s.smsConnected ? (
                      <div className="flex items-center justify-between gap-2 mb-4 text-[12.5px]">
                        <span className="text-sub">Connected as <span className="font-semibold">{s.msgowlSenderId}</span></span>
                        <button type="button" onClick={disconnectSms} disabled={smsDisconnecting}
                          className="border border-[rgba(0,0,0,.16)] text-muted font-bold text-[12px] px-[12px] py-[7px] rounded-[8px] cursor-pointer disabled:opacity-50">
                          {smsDisconnecting ? 'Disconnecting…' : 'Disconnect'}
                        </button>
                      </div>
                    ) : (
                      <FieldInput label="MsgOwl API key" value={msgowlKeyDraft} onChange={setMsgowlKeyDraft} />
                    )}
                    <FieldInput label="Sender ID" value={s.msgowlSenderId ?? ''} onChange={v => setSetting('msgowlSenderId', v)} />
                    <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-2 items-end">
                      <FieldInput label="Send test SMS to" value={smsTestRecipient} onChange={setSmsTestRecipient} placeholder="+960 …" />
                      <button type="button" onClick={testSms}
                        disabled={smsTesting || !String(s.msgowlSenderId ?? '').trim() || !smsTestRecipient.trim() || (!msgowlKeyDraft.trim() && !s.smsConnected)}
                        className="mb-[15px] border border-[rgba(219,87,149,.35)] bg-[rgba(219,87,149,.06)] text-rose-700 font-bold text-[12px] px-[12px] py-[9px] rounded-[8px] cursor-pointer disabled:opacity-50 whitespace-nowrap">
                        {smsTesting ? 'Testing…' : s.smsConnected ? 'Test & update' : 'Test & connect'}
                      </button>
                    </div>
                    <button onClick={() => setSetting('smsAlertsEnabled', !s.smsAlertsEnabled)} disabled={!s.smsConnected}
                      className="w-full font-bold text-[13px] px-4 py-[10px] rounded-[9px] cursor-pointer transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                      style={{ border: s.smsAlertsEnabled ? 'none' : '1px solid rgba(0,0,0,.16)', background: s.smsAlertsEnabled ? '#db5795' : 'transparent', color: s.smsAlertsEnabled ? '#200612' : '#705260' }}>
                      {s.smsAlertsEnabled ? <><Check size={11} className="inline mr-1" /> SMS enabled</> : 'SMS disabled'}
                    </button>
                    {s.smsLastTestAt && (
                      <div className="text-[11.5px] text-muted leading-[1.5] mt-3">Last tested {new Date(s.smsLastTestAt).toLocaleString()}</div>
                    )}
                    {smsMessage && <div className="text-[11.5px] text-muted leading-[1.5] mt-3">{smsMessage}</div>}
                    <div className="text-[11px] text-muted leading-[1.5] mt-3">Get your API key from the MsgOwl dashboard. Sender ID is the alphanumeric/short ID registered with MsgOwl that recipients see as the sender.</div>
                  </div>
                  <div className="bg-surface border border-[rgba(0,0,0,.08)] rounded-[15px] p-[22px]">
                    <div className="font-archivo-narrow font-bold text-[18px] mb-1">Notification preferences</div>
                    <div className="text-[12px] text-muted mb-4">Choose which channels customers get notified through for each order event.</div>
                    <div className="grid grid-cols-[1fr_50px_50px] gap-x-2 gap-y-[6px] items-center text-[10.5px] font-semibold text-muted uppercase tracking-wide pb-1 border-b border-[rgba(0,0,0,.08)] mb-1">
                      <span>Event</span><span className="text-center">Email</span><span className="text-center">SMS</span>
                    </div>
                    {([['Order events', ORDER_NOTIFICATION_EVENTS]] as const).map(([group, events]) => (
                      <div key={group}>
                        <div className="text-[10.5px] font-semibold text-muted mt-2 mb-1">{group}</div>
                        {events.map(ev => {
                          const pref = notificationPrefs.find(p => p.event === ev) ?? { event: ev, emailEnabled: true, smsEnabled: true };
                          return (
                            <div key={ev} className="grid grid-cols-[1fr_50px_50px] gap-x-2 items-center py-[5px] text-[12.5px]">
                              <span className="text-sub">{NOTIFICATION_EVENT_LABELS[ev] ?? ev}</span>
                              <span className="text-center"><input type="checkbox" checked={pref.emailEnabled} onChange={e => toggleChannelPref(ev, 'emailEnabled', e.target.checked)} /></span>
                              <span className="text-center"><input type="checkbox" checked={pref.smsEnabled} onChange={e => toggleChannelPref(ev, 'smsEnabled', e.target.checked)} /></span>
                            </div>
                          );
                        })}
                      </div>
                    ))}
                  </div>
                  <div className="bg-surface border border-[rgba(0,0,0,.08)] rounded-[15px] p-[22px]">
                    <div className="font-archivo-narrow font-bold text-[18px] mb-4">Homepage hero</div>
                    <FieldInput label="Hero headline" value={s.heroTitle} onChange={v => setSetting('heroTitle', v)} />
                    <div>
                      <label className="text-[11.5px] font-semibold text-sub block mb-[6px]">Hero subtitle</label>
                      <textarea value={s.heroSub} onChange={e => setSetting('heroSub', e.target.value)}
                        className="w-full h-16 resize-none bg-well border border-[rgba(0,0,0,.12)] rounded-[9px] px-[13px] py-[10px] text-body font-archivo text-[13.5px] outline-none focus:border-rose-500" />
                    </div>
                    <div className="mt-4">
                      <label className="text-[11.5px] font-semibold text-sub block mb-[6px]">Hero carousel images</label>
                      <div className="flex flex-wrap gap-3">
                        {(s.heroImages ?? []).map((url, i) => (
                          <div key={url + i} className="relative w-[96px] h-[64px] rounded-[10px] flex-none bg-[#f5f1f3] group"
                            style={{ backgroundImage: `url(${url})`, backgroundSize: 'cover', backgroundPosition: 'center' }}>
                            <button type="button" onClick={() => removeHeroCarouselImage(i)}
                              title="Remove"
                              className="absolute -top-2 -right-2 w-[20px] h-[20px] rounded-full bg-[#200612] text-white text-[12px] leading-[20px] text-center cursor-pointer border border-white/40">
                              ×
                            </button>
                            <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 flex gap-[3px]">
                              <button type="button" onClick={() => moveHeroCarouselImage(i, -1)} disabled={i === 0}
                                title="Move earlier"
                                className="w-[18px] h-[18px] rounded-full bg-[#200612] text-white text-[10px] leading-[18px] text-center cursor-pointer border border-white/40 disabled:opacity-30">
                                ‹
                              </button>
                              <button type="button" onClick={() => moveHeroCarouselImage(i, 1)} disabled={i === (s.heroImages ?? []).length - 1}
                                title="Move later"
                                className="w-[18px] h-[18px] rounded-full bg-[#200612] text-white text-[10px] leading-[18px] text-center cursor-pointer border border-white/40 disabled:opacity-30">
                                ›
                              </button>
                            </div>
                          </div>
                        ))}
                        <input ref={heroCarouselImgInputRef} type="file" accept="image/*" className="hidden"
                          onChange={e => { const f = e.target.files?.[0]; if (f) uploadHeroCarouselImage(f); e.target.value = ''; }} />
                        <button type="button" onClick={() => heroCarouselImgInputRef.current?.click()}
                          disabled={heroCarouselImgUploading || (s.heroImages ?? []).length >= 8}
                          className="w-[96px] h-[64px] rounded-[10px] flex-none border border-dashed border-[rgba(219,87,149,.4)] bg-[rgba(219,87,149,.06)] text-rose-700 font-bold text-[11px] cursor-pointer disabled:opacity-50">
                          {heroCarouselImgUploading ? 'Uploading…' : '+ Add image'}
                        </button>
                      </div>
                      <div className="text-[11px] text-muted mt-[6px]">5-6 images recommended, up to 8. Shown on the homepage as an auto-rotating carousel; falls back to the single hero image below when empty.</div>
                    </div>
                    <div className="mt-4">
                      <label className="text-[11.5px] font-semibold text-sub block mb-[6px]">Hero image (fallback)</label>
                      <div className="flex items-start gap-3">
                        <div className="w-[96px] h-[64px] rounded-[10px] flex-none bg-[#f5f1f3]"
                          style={{ backgroundImage: s.heroImage ? `url(${s.heroImage})` : undefined, backgroundSize: 'cover', backgroundPosition: 'center' }} />
                        <div>
                          <input ref={heroImgInputRef} type="file" accept="image/*" className="hidden"
                            onChange={e => { const f = e.target.files?.[0]; if (f) uploadHeroImage(f); }} />
                          <button type="button" onClick={() => heroImgInputRef.current?.click()} disabled={heroImgUploading}
                            className="block border border-[rgba(219,87,149,.35)] bg-[rgba(219,87,149,.06)] text-rose-700 font-bold text-[12px] px-[14px] py-[8px] rounded-[9px] cursor-pointer disabled:opacity-50 mb-[6px]">
                            {heroImgUploading ? 'Uploading…' : '↑ Upload hero image'}
                          </button>
                          {s.heroImage && (
                            <button type="button" onClick={() => setSetting('heroImage', '')}
                              className="block text-[11px] text-muted underline cursor-pointer bg-transparent border-none p-0 mb-[4px]">
                              Remove — use gradient instead
                            </button>
                          )}
                          <div className="text-[11px] text-muted">PNG, JPG or WebP. Used only when the carousel above is empty; falls back to gradient when empty too.</div>
                        </div>
                      </div>
                    </div>
                    <div className="mt-4">
                      <label className="text-[11.5px] font-semibold text-sub block mb-[6px]">Studio image</label>
                      <div className="flex items-start gap-3">
                        <div className="w-[96px] h-[64px] rounded-[10px] flex-none bg-[#f5f1f3]"
                          style={{ backgroundImage: s.workshopImage ? `url(${s.workshopImage})` : undefined, backgroundSize: 'cover', backgroundPosition: 'center' }} />
                        <div>
                          <input ref={workshopImgInputRef} type="file" accept="image/*" className="hidden"
                            onChange={e => { const f = e.target.files?.[0]; if (f) uploadWorkshopImage(f); }} />
                          <button type="button" onClick={() => workshopImgInputRef.current?.click()} disabled={workshopImgUploading}
                            className="block border border-[rgba(219,87,149,.35)] bg-[rgba(219,87,149,.06)] text-rose-700 font-bold text-[12px] px-[14px] py-[8px] rounded-[9px] cursor-pointer disabled:opacity-50 mb-[6px]">
                            {workshopImgUploading ? 'Uploading…' : '↑ Upload studio image'}
                          </button>
                          {s.workshopImage && (
                            <button type="button" onClick={() => setSetting('workshopImage', '')}
                              className="block text-[11px] text-muted underline cursor-pointer bg-transparent border-none p-0 mb-[4px]">
                              Remove — use gradient instead
                            </button>
                          )}
                          <div className="text-[11px] text-muted">PNG, JPG or WebP. Shown in the brand story section on the homepage.</div>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="bg-surface border border-[rgba(0,0,0,.08)] rounded-[15px] p-[22px]">
                    <div className="font-archivo-narrow font-bold text-[18px] mb-1">Homepage category cards</div>
                    <div className="text-[12px] text-muted mb-4">Background photo for each of the 4 category cards on the homepage. Leave any of these empty to keep that card's current plain design.</div>
                    {CATEGORY_IMAGE_FIELDS.map((f, i) => (
                      <div key={f.key} className={i > 0 ? 'mt-4' : undefined}>
                        <label className="text-[11.5px] font-semibold text-sub block mb-[6px]">{f.label}</label>
                        <div className="flex items-start gap-3">
                          <div className="w-[96px] h-[64px] rounded-[10px] flex-none bg-[#f5f1f3]"
                            style={{ backgroundImage: s[f.key] ? `url(${s[f.key]})` : undefined, backgroundSize: 'cover', backgroundPosition: 'center' }} />
                          <div>
                            <input ref={el => { categoryImgInputRefs.current[f.key] = el; }} type="file" accept="image/*" className="hidden"
                              onChange={e => { const file = e.target.files?.[0]; if (file) uploadCategoryImage(f.key, file); e.target.value = ''; }} />
                            <button type="button" onClick={() => categoryImgInputRefs.current[f.key]?.click()} disabled={!!categoryImgUploading[f.key]}
                              className="block border border-[rgba(219,87,149,.35)] bg-[rgba(219,87,149,.06)] text-rose-700 font-bold text-[12px] px-[14px] py-[8px] rounded-[9px] cursor-pointer disabled:opacity-50 mb-[6px]">
                              {categoryImgUploading[f.key] ? 'Uploading…' : `↑ Upload ${f.label} image`}
                            </button>
                            {s[f.key] && (
                              <button type="button" onClick={() => setSetting(f.key, '')}
                                className="block text-[11px] text-muted underline cursor-pointer bg-transparent border-none p-0 mb-[4px]">
                                Remove — use plain card instead
                              </button>
                            )}
                            <div className="text-[11px] text-muted">PNG, JPG or WebP. Shown as the background of its category card on the homepage; falls back to the plain card when empty.</div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="bg-surface border border-[rgba(0,0,0,.08)] rounded-[15px] p-[22px]">
                    <div className="font-archivo-narrow font-bold text-[18px] mb-1">PDF &amp; Tax settings</div>
                    <div className="text-[12px] text-muted mb-4">Used on Invoice and Payment Receipt PDFs.</div>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-3">
                      <FieldInput label="Tax ID" value={s.taxId ?? ''} onChange={v => setSetting('taxId', v)} />
                      <FieldInput label="Tax rate (%)" value={String(s.taxRate ?? 0)} onChange={v => setSetting('taxRate', parseFloat(v) || 0)} />
                      <FieldInput label="Tax label" value={s.taxLabel ?? 'GST'} onChange={v => setSetting('taxLabel', v)} />
                    </div>
                    <div>
                      <label className="text-[11.5px] font-semibold text-sub block mb-[6px]">Terms &amp; Conditions</label>
                      <textarea value={s.termsConditions ?? ''} onChange={e => setSetting('termsConditions', e.target.value)}
                        placeholder="Enter your full T&C here — included at the bottom of every Invoice and Quotation PDF."
                        className="w-full h-36 resize-y bg-well border border-[rgba(0,0,0,.12)] rounded-[9px] px-[13px] py-[10px] text-body font-archivo text-[13px] outline-none focus:border-rose-500 leading-relaxed" />
                    </div>
                  </div>
                </div>
              </div>
              <div className="mt-5">
                <button type="button" onClick={() => setStorefrontCopyOpen(o => !o)}
                  className="w-full flex items-center justify-between gap-4 bg-surface border border-[rgba(0,0,0,.08)] rounded-[15px] px-[18px] py-[16px] cursor-pointer text-left">
                  <div>
                    <div className="font-archivo-narrow font-bold text-[18px]">Storefront Copy</div>
                    <div className="text-[12px] text-muted leading-[1.45] mt-[3px]">
                      CTAs and other customer-facing text — hero, cart, checkout, product pages. {STOREFRONT_COPY_GROUPS.length} groups, click to edit.
                    </div>
                  </div>
                  <ChevronDown size={18} className="flex-none text-muted transition-transform" style={{ transform: storefrontCopyOpen ? 'rotate(180deg)' : 'none' }} />
                </button>
                {storefrontCopyOpen && (
                  <div className="mt-4">
                    <div className="text-[12.5px] text-muted leading-[1.5] mb-4">
                      Customer-facing storefront phrases only. Shorter copy is safer on product cards, mobile headers and sticky action bars.
                    </div>
                    <div className="grid grid-cols-1 gap-4">
                      {STOREFRONT_COPY_GROUPS.map(group => (
                        <section key={group.section} className="bg-surface border border-[rgba(0,0,0,.08)] rounded-[15px] p-[18px]">
                          <div className="flex items-start justify-between gap-4 mb-4">
                            <div>
                              <div className="font-archivo-narrow font-bold text-[18px]">{group.title}</div>
                              <div className="text-[12px] text-muted leading-[1.45] mt-1">{group.description}</div>
                            </div>
                          </div>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4">
                            {group.fields.map(field => {
                              const value = String((storefrontCopy[group.section] as Record<string, string>)[field.key] ?? '');
                              const multiline = field.maxLength >= 90;
                              return (
                                <div key={`${group.section}.${field.key}`} className={multiline ? 'md:col-span-2 mb-[13px]' : ''}>
                                  {multiline ? (
                                    <>
                                      <label className="text-[11.5px] font-semibold text-sub block mb-[6px]">{field.label}</label>
                                      <textarea
                                        value={value}
                                        maxLength={field.maxLength}
                                        onChange={e => setStorefrontCopyField(group.section, field.key, e.target.value)}
                                        className="w-full h-[76px] resize-y bg-well border border-[rgba(0,0,0,.12)] rounded-[9px] px-[13px] py-[10px] text-body font-archivo text-[13px] outline-none focus:border-rose-500 leading-relaxed"
                                      />
                                      <div className="text-[10.5px] text-muted mt-[5px] text-right tabular">{value.length}/{field.maxLength}</div>
                                    </>
                                  ) : (
                                    <FieldInput
                                      label={field.label}
                                      value={value}
                                      maxLength={field.maxLength}
                                      onChange={v => setStorefrontCopyField(group.section, field.key, v)}
                                    />
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </section>
                      ))}
                    </div>
                  </div>
                )}
              </div>
              {/* ── Locations ── */}
              {hasPermission(currentUser, 'settingsLocations', 'read') && (
                <div className="mt-8">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <div className="font-archivo-narrow font-bold text-[20px]">Inventory locations</div>
                      <div className="text-[12px] text-muted mt-[3px]">Locations that hold stock. "Show on web" means products with stock here appear in the storefront.</div>
                    </div>
                    {hasPermission(currentUser, 'settingsLocations', 'edit') && (
                      <button onClick={() => setLocModal({ id: null, draft: { name: '', showOnWeb: false, isWebDefault: false, sortOrder: String(data.locations.length) }, error: '' })}
                        className="border-none bg-rose-500 text-[#200612] font-extrabold text-[13px] px-[18px] py-[10px] rounded-[10px] cursor-pointer shadow-rose-sm">+ Add location</button>
                    )}
                  </div>
                  <div className="bg-surface border border-[rgba(0,0,0,.08)] rounded-[15px] overflow-x-auto">
                    {data.locations.length === 0 && <div className="py-8 text-center text-[12.5px] text-muted">No locations yet.</div>}
                    {data.locations.map(loc => (
                      <div key={loc.id} className="flex items-center gap-3 px-5 py-[13px] border-b border-[rgba(0,0,0,.07)] last:border-0">
                        <div className="flex-1 min-w-0">
                          <div className="text-[13px] font-semibold">{loc.name}</div>
                          <div className="text-[11px] text-muted mt-[2px]">Sort {loc.sortOrder}</div>
                        </div>
                        <div className="flex items-center gap-2">
                          {loc.showOnWeb && <span className="text-[9.5px] font-extrabold uppercase text-rose-600 bg-[rgba(219,87,149,.1)] border border-[rgba(219,87,149,.2)] px-2 py-[3px] rounded-full">Web visible</span>}
                          {loc.isWebDefault && <span className="text-[9.5px] font-extrabold uppercase text-[#705260] bg-[rgba(0,0,0,.08)] border border-[rgba(0,0,0,.14)] px-2 py-[3px] rounded-full">Web default</span>}
                        </div>
                        {hasPermission(currentUser, 'settingsLocations', 'edit') && (
                          <div className="flex gap-[7px]">
                            <button onClick={() => setLocModal({ id: loc.id, draft: { name: loc.name, showOnWeb: loc.showOnWeb, isWebDefault: loc.isWebDefault, sortOrder: String(loc.sortOrder) }, error: '' })}
                              className="w-[28px] h-[28px] rounded-[7px] border border-[rgba(0,0,0,.12)] bg-transparent text-sub cursor-pointer text-[12px] hover:text-rose-700 hover:border-[rgba(219,87,149,.4)] transition-all"><Pencil size={12} /></button>
                            <button onClick={() => deleteLocationById(loc.id, loc.name)}
                              className="w-[28px] h-[28px] rounded-[7px] border border-[rgba(0,0,0,.12)] bg-transparent text-sub cursor-pointer text-[12px] hover:text-[#e81a2b] hover:border-[rgba(255,61,77,.35)] transition-all"><X size={12} /></button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* ── Delivery areas ── */}
              {hasPermission(currentUser, 'settingsGeneral', 'read') && (
                <div className="mt-8">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <div className="font-archivo-narrow font-bold text-[20px]">Delivery areas</div>
                      <div className="text-[12px] text-muted mt-[3px]">Customers pick one of these at checkout; each has its own delivery rate.</div>
                    </div>
                    {hasPermission(currentUser, 'settingsGeneral', 'edit') && (
                      <button onClick={() => setDeliveryAreaModal({ id: null, draft: { name: '', rate: '', active: true, sortOrder: String(deliveryAreas.length) }, error: '' })}
                        className="border-none bg-rose-500 text-[#200612] font-extrabold text-[13px] px-[18px] py-[10px] rounded-[10px] cursor-pointer shadow-rose-sm">+ Add area</button>
                    )}
                  </div>
                  <div className="bg-surface border border-[rgba(0,0,0,.08)] rounded-[15px] overflow-x-auto">
                    {deliveryAreas.length === 0 && <div className="py-8 text-center text-[12.5px] text-muted">No delivery areas yet.</div>}
                    {deliveryAreas.map(area => (
                      <div key={area.id} className="flex items-center gap-3 px-5 py-[13px] border-b border-[rgba(0,0,0,.07)] last:border-0">
                        <div className="flex-1 min-w-0">
                          <div className="text-[13px] font-semibold">{area.name}</div>
                          <div className="text-[11px] text-muted mt-[2px]">MVR {area.rate.toLocaleString()} · Sort {area.sortOrder}</div>
                        </div>
                        <div className="flex items-center gap-2">
                          {!area.active && <span className="text-[9.5px] font-extrabold uppercase text-[#705260] bg-[rgba(0,0,0,.08)] border border-[rgba(0,0,0,.14)] px-2 py-[3px] rounded-full">Inactive</span>}
                        </div>
                        {hasPermission(currentUser, 'settingsGeneral', 'edit') && (
                          <div className="flex gap-[7px]">
                            <button onClick={() => setDeliveryAreaModal({ id: area.id, draft: { name: area.name, rate: String(area.rate), active: area.active, sortOrder: String(area.sortOrder) }, error: '' })}
                              className="w-[28px] h-[28px] rounded-[7px] border border-[rgba(0,0,0,.12)] bg-transparent text-sub cursor-pointer text-[12px] hover:text-rose-700 hover:border-[rgba(219,87,149,.4)] transition-all"><Pencil size={12} /></button>
                            <button onClick={() => deleteDeliveryAreaById(area.id, area.name)}
                              className="w-[28px] h-[28px] rounded-[7px] border border-[rgba(0,0,0,.12)] bg-transparent text-sub cursor-pointer text-[12px] hover:text-[#e81a2b] hover:border-[rgba(255,61,77,.35)] transition-all"><X size={12} /></button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* ── User management ── */}
              {hasPermission(currentUser, 'settingsUsers', 'read') && (
                <div className="mt-8">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <div className="font-archivo-narrow font-bold text-[20px]">Team accounts</div>
                      <div className="text-[12px] text-muted mt-[3px]">Admins have full access. Staff get per-module access you set individually.</div>
                    </div>
                    {hasPermission(currentUser, 'settingsUsers', 'edit') && (
                      <button onClick={() => openUserModal()} className="border-none bg-rose-500 text-[#200612] font-extrabold text-[13px] px-[18px] py-[10px] rounded-[10px] cursor-pointer shadow-rose-sm">+ Add user</button>
                    )}
                  </div>
                  <div className="bg-surface border border-[rgba(0,0,0,.08)] rounded-[15px] overflow-x-auto [&>div]:min-w-[480px]">
                    <div className="grid px-[18px] py-[12px] bg-[rgba(0,0,0,.045)] border-b border-[rgba(0,0,0,.07)] text-[11px] font-extrabold tracking-[.06em] uppercase text-muted" style={{ gridTemplateColumns: '1fr .7fr .8fr 64px' }}>
                      <span>Email</span><span>Role</span><span>Added</span><span className="text-right">Actions</span>
                    </div>
                    {users.map(u => (
                      <div key={u.id} className="grid px-[18px] py-[12px] border-b border-[rgba(0,0,0,.07)] items-center hover:bg-[rgba(0,0,0,.045)] transition-colors" style={{ gridTemplateColumns: '1fr .7fr .8fr 64px' }}>
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="w-6 h-6 rounded-full bg-[linear-gradient(135deg,#600a32,#36021a)] inline-flex items-center justify-center text-[10px] font-extrabold text-rose-700 flex-none">{(u.email[0] ?? '?').toUpperCase()}</span>
                          <span className="text-[13px] truncate">{u.email}</span>
                          {u.email === currentUser?.email && <span className="text-[9px] font-extrabold text-[#200612] bg-rose-500 px-[6px] py-[1px] rounded-full flex-none">You</span>}
                        </div>
                        <span className="text-[12px] font-semibold" style={{ color: u.role === 'admin' ? '#600a32' : '#705260' }}>{ROLE_LABEL[u.role]}</span>
                        <span className="text-[11.5px] text-muted">{new Date(u.createdAt).toLocaleDateString('en-GB', { day:'2-digit', month:'short', year:'numeric' })}</span>
                        <div className="flex gap-[7px] justify-end">
                          {hasPermission(currentUser, 'settingsUsers', 'edit') && (
                            <button onClick={() => openUserModal(u)} className="w-[28px] h-[28px] rounded-[7px] border border-[rgba(0,0,0,.12)] bg-transparent text-sub cursor-pointer text-[12px] hover:text-rose-700 hover:border-[rgba(219,87,149,.4)] transition-all"><Pencil size={12} /></button>
                          )}
                          {u.email !== currentUser?.email && hasPermission(currentUser, 'settingsUsers', 'edit') && (
                            <button onClick={() => deleteUser(u)} className="w-[28px] h-[28px] rounded-[7px] border border-[rgba(0,0,0,.12)] bg-transparent text-sub cursor-pointer text-[12px] hover:text-[#e81a2b] hover:border-[rgba(255,61,77,.35)] transition-all"><X size={12} /></button>
                          )}
                        </div>
                      </div>
                    ))}
                    {users.length === 0 && <div className="py-8 text-center text-[12.5px] text-muted">No users yet.</div>}
                  </div>
                  <div className="mt-3 text-[11.5px] text-muted leading-[1.5]">
                    <strong className="text-sub">Admin:</strong> full access, bypasses the permission grid · <strong className="text-sub">Staff:</strong> access defined per module below (none / read-only / edit).
                  </div>
                </div>
              )}
            </div>
            {/* ── Floating save bar — always mounted while on Settings ── */}
            <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[70] flex items-center gap-3">
              <button onClick={saveSettings} disabled={saving}
                className={`border-none font-extrabold text-[14px] px-[26px] py-[12px] rounded-xl transition-all disabled:cursor-not-allowed ${settingsDirty ? 'bg-rose-400 text-[#200612] cursor-pointer brightness-105 shadow-[0_10px_30px_rgba(219,87,149,.4)]' : 'bg-[rgba(0,0,0,.08)] text-[#705260] cursor-pointer hover:brightness-105'} disabled:opacity-60`}>
                {saving ? 'Saving…' : settingsDirty ? 'Save settings' : 'Saved'}
              </button>
              {settingsDirty && <span className="text-[12px] font-semibold text-[#e81a2b] bg-[#200c15] border border-[rgba(255,61,77,.35)] rounded-lg px-3 py-[7px] shadow-[0_10px_30px_rgba(0,0,0,.35)]">Unsaved changes</span>}
            </div>
            </>
          )}
        </div>
      </main>

      {/* ── EDIT MODAL ── */}
      {modal && (
        <div className="fixed inset-0 z-[80] bg-[rgba(4,8,7,.78)] backdrop-blur-md flex items-center justify-center p-6" onClick={() => setModal(null)}>
          <div role="dialog" aria-modal="true" aria-labelledby="admin-modal-title" className="w-[540px] max-w-full max-h-[90vh] overflow-auto bg-surface border border-[rgba(219,87,149,.25)] rounded-[20px] p-6" onClick={e => e.stopPropagation()}>
            <div className="flex items-start justify-between gap-[14px] mb-[18px]">
              <div>
                <h3 id="admin-modal-title" className="font-archivo-narrow font-bold text-[23px]">{modal.id ? 'Edit' : 'New'} {modal.kind.replace(/s$/, '')}</h3>
              </div>
              <button onClick={() => setModal(null)} className="border-none bg-transparent text-muted text-[20px] cursor-pointer"><X size={20} /></button>
            </div>

            <div className="grid grid-cols-2 gap-[14px]">
              {/* Product fields */}
              {modal.kind === 'product' && (
                <>
                  <div className="col-span-2"><label className="text-[11.5px] font-semibold text-sub block mb-[6px]">Product name</label><input value={modal.draft.name ?? ''} onChange={e => setDraftField('name', e.target.value)} className="w-full bg-well border border-[rgba(0,0,0,.12)] rounded-[9px] px-[13px] py-[10px] text-body font-archivo text-[13.5px] outline-none focus:border-rose-500" /></div>
                  <div><label className="text-[11.5px] font-semibold text-sub block mb-[6px]">Collection</label><select value={modal.draft.collection ?? ''} onChange={e => setDraftField('collection', e.target.value)} className="w-full bg-well border border-[rgba(0,0,0,.12)] rounded-[9px] px-[13px] py-[10px] text-body font-archivo text-[13.5px] outline-none cursor-pointer">{colOpts.map(o => <option key={o.v} value={o.v}>{o.label}</option>)}</select></div>
                  <div><label className="text-[11.5px] font-semibold text-sub block mb-[6px]">Category</label><select value={modal.draft.category ?? ''} onChange={e => setDraftField('category', e.target.value)} className="w-full bg-well border border-[rgba(0,0,0,.12)] rounded-[9px] px-[13px] py-[10px] text-body font-archivo text-[13.5px] outline-none cursor-pointer">{data.categories.filter(c => !modal.draft.collection || c.collection === modal.draft.collection).map(c => <option key={c.id} value={c.name}>{c.name}</option>)}</select></div>
                  <div className="col-span-2"><label className="text-[11.5px] font-semibold text-sub block mb-[6px]">Subtitle</label><input value={modal.draft.sub ?? ''} onChange={e => setDraftField('sub', e.target.value)} className="w-full bg-well border border-[rgba(0,0,0,.12)] rounded-[9px] px-[13px] py-[10px] text-body font-archivo text-[13.5px] outline-none focus:border-rose-500" /></div>
                  <div><label className="text-[11.5px] font-semibold text-sub block mb-[6px]">Price (MVR)</label><input value={modal.draft.price ?? ''} onChange={e => setDraftField('price', e.target.value)} className="w-full bg-well border border-[rgba(0,0,0,.12)] rounded-[9px] px-[13px] py-[10px] text-body font-archivo text-[13.5px] outline-none focus:border-rose-500 tabular" /></div>
                  <div><label className="text-[11.5px] font-semibold text-sub block mb-[6px]">Compare-at (optional)</label><input value={modal.draft.was ?? ''} onChange={e => setDraftField('was', e.target.value)} className="w-full bg-well border border-[rgba(0,0,0,.12)] rounded-[9px] px-[13px] py-[10px] text-body font-archivo text-[13.5px] outline-none focus:border-rose-500 tabular" /></div>
                  {!isEditingProduct && (
                    <div><label className="text-[11.5px] font-semibold text-sub block mb-[6px]">Location <span className="text-muted font-normal">· where initial stock is added</span></label>
                      <select value={modal.draft.locationId ?? ''} onChange={e => setDraftField('locationId', e.target.value)} className="w-full bg-well border border-[rgba(0,0,0,.12)] rounded-[9px] px-[13px] py-[10px] text-body font-archivo text-[13.5px] outline-none cursor-pointer">
                        <option value="">Select location…</option>
                        {data.locations.map(l => <option key={l.id} value={l.id}>{l.name}{l.showOnWeb ? ' (web)' : ''}</option>)}
                      </select>
                    </div>
                  )}
                  {currentUser?.role === 'admin' && (
                    <div><label className="text-[11.5px] font-semibold text-sub block mb-[6px]">Cost price (MVR) <span className="text-muted font-normal">— super admin only</span></label><input value={modal.draft.costPrice ?? ''} onChange={e => setDraftField('costPrice', e.target.value)} className="w-full bg-well border border-[rgba(0,0,0,.12)] rounded-[9px] px-[13px] py-[10px] text-body font-archivo text-[13.5px] outline-none focus:border-rose-500 tabular" />
                      {(parseInt(String(modal.draft.costPrice ?? 0)) || 0) > (parseInt(String(modal.draft.price ?? 0)) || 0) && (
                        <div className="text-[10.5px] text-amber-400 mt-[5px]">Cost price is higher than the sale price — this product will sell at a loss.</div>
                      )}
                    </div>
                  )}
                  <div><label className="text-[11.5px] font-semibold text-sub block mb-[6px]">Stock <span className="text-muted font-normal">· sum of qty per colour/size below</span></label>
                    <div className="w-full bg-well border border-[rgba(0,0,0,.08)] rounded-[9px] px-[13px] py-[10px] text-muted font-archivo text-[13.5px] tabular select-none">
                      {sumColorSizeStock((modal.draft.colorSizeStock ?? {}) as Record<string, Record<string, number>>)}
                    </div>
                  </div>
                  <div><label className="text-[11.5px] font-semibold text-sub block mb-[6px]">Status</label><select value={modal.draft.status ?? 'active'} onChange={e => setDraftField('status', e.target.value)} className="w-full bg-well border border-[rgba(0,0,0,.12)] rounded-[9px] px-[13px] py-[10px] text-body font-archivo text-[13.5px] outline-none cursor-pointer">{['active','soldout','draft'].map(v => <option key={v} value={v}>{v}</option>)}</select></div>
                  <div><label className="text-[11.5px] font-semibold text-sub block mb-[6px]">Badge</label><select value={modal.draft.badge ?? ''} onChange={e => setDraftField('badge', e.target.value)} className="w-full bg-well border border-[rgba(0,0,0,.12)] rounded-[9px] px-[13px] py-[10px] text-body font-archivo text-[13.5px] outline-none cursor-pointer">{['','New','Sale','Pre-order'].map(v => <option key={v} value={v}>{v || 'None'}</option>)}</select></div>
                  <div className="col-span-2">
                    <label className="text-[11.5px] font-semibold text-sub block mb-[6px]">Product image</label>
                    {/* Preview + upload */}
                    <div className="flex items-start gap-3 mb-[10px]">
                      <div className="w-[64px] h-[64px] rounded-[10px] flex-none" style={{ background: modal.draft.img || '#f5f1f3', backgroundSize: 'cover', backgroundPosition: 'center' }} />
                      <div>
                        <input ref={imgInputRef} type="file" accept="image/*" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) uploadProductImage(f); }} />
                        <button type="button" onClick={() => imgInputRef.current?.click()} disabled={imgUploading}
                          className="block border border-[rgba(219,87,149,.35)] bg-[rgba(219,87,149,.06)] text-rose-700 font-bold text-[12px] px-[14px] py-[8px] rounded-[9px] cursor-pointer disabled:opacity-50 mb-[6px]">
                          {imgUploading ? 'Uploading…' : '↑ Upload photo'}
                        </button>
                        <div className="text-[11px] text-muted">PNG, JPG or WebP. Replaces gradient.</div>
                      </div>
                    </div>
                    {/* Gradient swatches + no-gradient solid */}
                    <div className="text-[11px] text-muted mb-[6px]">Or choose a gradient background:</div>
                    <div className="flex flex-wrap gap-2">
                      {/* No-gradient solid dark option */}
                      <span title="No gradient" onClick={() => setDraftField('img', '#f5f1f3')}
                        className="w-[38px] h-[38px] rounded-[9px] cursor-pointer border-2 transition-all flex items-center justify-center text-[14px] text-muted"
                        style={{ background: '#f5f1f3', boxShadow: modal.draft.img === '#f5f1f3' ? '0 0 0 2px #ffffff,0 0 0 4px #db5795' : '0 0 0 1px rgba(0,0,0,.14)', borderColor: 'transparent' }}><X size={14} /></span>
                      {GRADIENTS.map((g, i) => (
                        <span key={i} onClick={() => setDraftField('img', g)} className="w-[38px] h-[38px] rounded-[9px] cursor-pointer transition-all"
                          style={{ background: g, boxShadow: modal.draft.img === g ? '0 0 0 2px #ffffff,0 0 0 4px #db5795' : '0 0 0 1px rgba(0,0,0,.14)' }} />
                      ))}
                    </div>
                  </div>
                  {/* Colours */}
                  <div className="col-span-2">
                    <label className="text-[11.5px] font-semibold text-sub block mb-[6px]">Colours <span className="text-muted font-normal">· pick a swatch or type a custom name</span></label>
                    <div className="flex gap-[8px] flex-wrap mb-[10px]">
                      {(Array.isArray(modal.draft.colors) ? modal.draft.colors as string[] : []).map((c: string) => (
                        <span key={c} className="inline-flex items-center gap-[6px] font-semibold text-[12px] pl-[6px] pr-[11px] h-[32px] rounded-[8px] bg-[rgba(219,87,149,.1)] border border-[rgba(219,87,149,.35)] text-[#150d11]">
                          <input type="color" title={`Pick an exact colour for "${c}"`}
                            value={productColorHex(modal.draft.colorHex as Record<string, string> | undefined, c)}
                            onChange={e => setDraftField('colorHex', { ...(modal.draft.colorHex as Record<string, string> ?? {}), [c]: e.target.value })}
                            className="w-[20px] h-[20px] rounded-full flex-none border border-[rgba(0,0,0,.12)] p-0 cursor-pointer [&::-webkit-color-swatch-wrapper]:p-0 [&::-webkit-color-swatch]:rounded-full [&::-webkit-color-swatch]:border-none" />
                          {c}
                          <button type="button" onClick={() => {
                            const origStock = (modal.draft.colorSizeStockOriginal ?? {}) as Record<string, Record<string, number>>;
                            const hasStock = Object.values(origStock[c] ?? {}).some(q => q > 0);
                            if (hasStock && !window.confirm(`"${c}" still has stock in Inventory. Removing it here only hides it from the storefront — the stock itself stays put and can be moved or zeroed via Inventory → Adjust/Transfer. Remove anyway?`)) return;
                            setDraftField('colors', (modal.draft.colors as string[]).filter((x: string) => x !== c));
                          }} className="border-none bg-transparent text-muted text-[14px] cursor-pointer leading-none hover:text-[#e81a2b]">×</button>
                        </span>
                      ))}
                    </div>
                    <div className="flex gap-[8px] flex-wrap mb-[10px]">
                      {Object.entries(COLOR_MAP).map(([name, hex]) => {
                        const cur = Array.isArray(modal.draft.colors) ? modal.draft.colors as string[] : [];
                        const on = cur.includes(name);
                        return (
                          <button key={name} type="button"
                            onClick={() => setDraftField('colors', on ? cur.filter((x: string) => x !== name) : [...cur, name])}
                            className="inline-flex items-center gap-[6px] font-semibold text-[12px] px-[10px] h-[32px] rounded-[8px] border cursor-pointer transition-all"
                            style={{ background: on ? 'rgba(219,87,149,.1)' : 'transparent', borderColor: on ? 'rgba(219,87,149,.45)' : 'rgba(0,0,0,.14)' }}>
                            <span className="w-[14px] h-[14px] rounded-full flex-none border border-[rgba(0,0,0,.12)]" style={{ background: hex }} />
                            {name}
                          </button>
                        );
                      })}
                    </div>
                    <div className="flex gap-[7px]">
                      <input
                        value={colorInput}
                        onChange={e => setColorInput(e.target.value)}
                        onKeyDown={e => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            const v = colorInput.trim();
                            if (!v) return;
                            const cur = Array.isArray(modal.draft.colors) ? modal.draft.colors as string[] : [];
                            if (!cur.includes(v)) setDraftField('colors', [...cur, v]);
                            setColorInput('');
                          }
                        }}
                        placeholder="Or type a custom colour name and press Enter"
                        className="flex-1 bg-well border border-[rgba(0,0,0,.12)] rounded-[9px] px-[12px] py-[8px] text-body font-archivo text-[13px] outline-none focus:border-rose-500"
                      />
                      <button type="button" onClick={() => {
                        const v = colorInput.trim();
                        if (!v) return;
                        const cur = Array.isArray(modal.draft.colors) ? modal.draft.colors as string[] : [];
                        if (!cur.includes(v)) setDraftField('colors', [...cur, v]);
                        setColorInput('');
                      }} className="border border-[rgba(219,87,149,.4)] bg-transparent text-rose-700 font-bold text-[13px] px-[14px] rounded-[9px] cursor-pointer hover:bg-[rgba(219,87,149,.08)] transition-colors">+ Add</button>
                    </div>
                  </div>
                  {/* Colour × size stock grid — fully editable at creation; at edit time, only
                      colour/size combos with no existing Inventory row (e.g. a colour just added)
                      are editable, seeding fresh stock. Combos that already carry Inventory stay
                      read-only here — change those via Inventory → Receive/Adjust/Transfer. */}
                  <div className="col-span-2">
                    <label className="text-[11.5px] font-semibold text-sub block mb-[6px]">
                      Stock per colour & size{' '}
                      {isEditingProduct
                        ? <span className="text-muted font-normal">· only new colours/sizes are editable here — manage existing stock via Inventory → Receive/Adjust/Transfer</span>
                        : <span className="text-muted font-normal">· set qty for each combination; 0 removes it</span>}
                    </label>
                    {(() => {
                      const csStock = (modal.draft.colorSizeStock ?? {}) as Record<string, Record<string, number>>;
                      const origStock = (modal.draft.colorSizeStockOriginal ?? {}) as Record<string, Record<string, number>>;
                      const rowColors = Array.isArray(modal.draft.colors) && modal.draft.colors.length > 0 ? modal.draft.colors as string[] : [''];
                      const cols = [...PRODUCT_SIZES, ''];
                      const hasNewCombo = isEditingProduct && rowColors.some(color => cols.some(size => origStock[color]?.[size] === undefined));
                      return (
                        <>
                          {hasNewCombo && (
                            <div className="flex items-center gap-[8px] mb-[8px]">
                              <span className="text-[11.5px] text-sub">New stock goes to:</span>
                              <select value={(modal.draft.newStockLocationId as string) ?? data.locations[0]?.id ?? ''}
                                onChange={e => setDraftField('newStockLocationId', e.target.value)}
                                className="bg-well border border-[rgba(0,0,0,.12)] rounded-[8px] px-[10px] py-[6px] text-[12px] font-semibold outline-none cursor-pointer">
                                {data.locations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
                              </select>
                            </div>
                          )}
                          <div className="overflow-auto border border-[rgba(0,0,0,.1)] rounded-[10px]">
                            <table className="w-full border-collapse text-[12px]">
                              <thead>
                                <tr>
                                  <th className="text-left font-semibold text-sub px-[10px] py-[8px] border-b border-[rgba(0,0,0,.1)]">Colour</th>
                                  {cols.map(size => (
                                    <th key={size || '__none'} className="text-center font-semibold text-sub px-[6px] py-[8px] border-b border-l border-[rgba(0,0,0,.1)] whitespace-nowrap">
                                      {size || 'No size'}
                                    </th>
                                  ))}
                                </tr>
                              </thead>
                              <tbody>
                                {rowColors.map(color => (
                                  <tr key={color || '__none'}>
                                    <td className="px-[10px] py-[6px] font-semibold border-b border-[rgba(0,0,0,.08)] whitespace-nowrap">{color || 'All colours'}</td>
                                    {cols.map(size => {
                                      const qty = csStock[color]?.[size] ?? 0;
                                      const isNew = isEditingProduct && origStock[color]?.[size] === undefined;
                                      const locked = isEditingProduct && !isNew;
                                      return (
                                        <td key={size || '__none'} className="border-b border-l border-[rgba(0,0,0,.08)] p-0">
                                          <div className="flex items-center justify-center gap-[4px] py-[4px]">
                                            {locked ? (
                                              <span className="w-[30px] text-center font-bold tabular select-none" style={{ color: qty > 0 ? '#600a32' : '#b29fa8' }}>{qty}</span>
                                            ) : (
                                              <>
                                                <button type="button" onClick={() => setColorSizeQty(color, size, -1)} disabled={qty === 0}
                                                  className="border-none bg-transparent text-rose-700 w-[18px] h-[22px] text-[14px] cursor-pointer disabled:opacity-30 disabled:cursor-default leading-none">−</button>
                                                <input
                                                  type="number" min="0" inputMode="numeric"
                                                  value={qty === 0 ? '' : qty}
                                                  placeholder="0"
                                                  onChange={e => setColorSizeQtyValue(color, size, e.target.value === '' ? 0 : parseInt(e.target.value) || 0)}
                                                  className="w-[30px] text-center font-bold tabular select-none bg-transparent border-none outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                                  style={{ color: qty > 0 ? '#600a32' : '#b29fa8' }}
                                                />
                                                <button type="button" onClick={() => setColorSizeQty(color, size, 1)}
                                                  className="border-none bg-transparent text-rose-700 w-[18px] h-[22px] text-[14px] cursor-pointer leading-none">+</button>
                                              </>
                                            )}
                                          </div>
                                        </td>
                                      );
                                    })}
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </>
                      );
                    })()}
                  </div>
                  {/* Colour variant images (optional, falls back to main product image) */}
                  {Array.isArray(modal.draft.colors) && (modal.draft.colors as string[]).length > 0 && (
                    <div className="col-span-2">
                      <label className="text-[11.5px] font-semibold text-sub block mb-[6px]">
                        Images per colour <span className="text-muted font-normal">(optional — falls back to main product image)</span>
                      </label>
                      <div className="flex flex-wrap gap-[10px]">
                        {(modal.draft.colors as string[]).map(colorLabel => {
                          const existingImg = (modal.draft.colorImages as Record<string, string> | undefined)?.[colorLabel];
                          const isUploading = !!colorImgUploading[colorLabel];
                          return (
                            <div key={colorLabel} className="flex items-center gap-[8px] bg-well border border-[rgba(0,0,0,.1)] rounded-[10px] px-[10px] py-[8px]">
                              <span className="w-[30px] h-[30px] rounded-[7px] flex-none border border-[rgba(0,0,0,.1)]" style={{ background: existingImg || productColorHex(modal.draft.colorHex as Record<string, string> | undefined, colorLabel) }} />
                              <span className="text-[12px] font-semibold">{colorLabel}</span>
                              <label className="inline-flex items-center border border-[rgba(219,87,149,.35)] bg-[rgba(219,87,149,.06)] text-rose-700 font-bold text-[11.5px] px-[10px] py-[6px] rounded-[7px] cursor-pointer hover:brightness-105 transition-all">
                                <input type="file" accept="image/*" className="hidden"
                                  onChange={e => { const f = e.target.files?.[0]; if (f) { uploadColorImage(colorLabel, f); e.target.value = ''; } }} />
                                {isUploading ? 'Uploading…' : existingImg ? '↑ Replace' : '↑ Upload'}
                              </label>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                  {/* Product page text sections (optional, freeform) */}
                  <div className="col-span-2">
                    <div className="flex items-center justify-between mb-[6px]">
                      <label className="text-[11.5px] font-semibold text-sub">Product page text <span className="text-muted font-normal">(optional — shown as accordion sections on the product page)</span></label>
                      <button type="button" onClick={addDraftSection}
                        className="border border-[rgba(219,87,149,.4)] bg-transparent text-rose-700 font-bold text-[12px] px-[12px] py-[6px] rounded-[8px] cursor-pointer hover:bg-[rgba(219,87,149,.08)] transition-colors">
                        + Add section
                      </button>
                    </div>
                    {(!Array.isArray(modal.draft.descriptionSections) || (modal.draft.descriptionSections as ProductSection[]).length === 0) ? (
                      <div className="text-[12px] text-muted">No custom text yet — the product page will show default template copy until you add sections here.</div>
                    ) : (
                      <div className="flex flex-col gap-[10px]">
                        {(modal.draft.descriptionSections as ProductSection[]).map((sec, i) => (
                          <div key={sec.id} className="flex flex-col gap-[8px] bg-well border border-[rgba(0,0,0,.08)] rounded-[10px] px-[12px] py-[10px]">
                            <div className="flex items-center gap-[8px]">
                              <input value={sec.title} onChange={e => updateDraftSection(i, { title: e.target.value })}
                                placeholder="Section title, e.g. Description"
                                className="flex-1 bg-[rgba(0,0,0,.07)] border border-[rgba(0,0,0,.12)] rounded-[8px] px-[11px] py-[7px] text-body font-archivo text-[13px] outline-none focus:border-rose-500" />
                              <button type="button" onClick={() => moveDraftSection(i, -1)} disabled={i === 0}
                                className="border-none bg-transparent text-rose-700 text-[14px] w-[22px] h-[22px] cursor-pointer disabled:opacity-30 disabled:cursor-default leading-none">↑</button>
                              <button type="button" onClick={() => moveDraftSection(i, 1)} disabled={i === (modal.draft.descriptionSections as ProductSection[]).length - 1}
                                className="border-none bg-transparent text-rose-700 text-[14px] w-[22px] h-[22px] cursor-pointer disabled:opacity-30 disabled:cursor-default leading-none">↓</button>
                              <button type="button" onClick={() => removeDraftSection(i)}
                                className="border-none bg-transparent text-muted text-[14px] w-[22px] h-[22px] cursor-pointer hover:text-[#e81a2b] transition-colors leading-none"><X size={14} /></button>
                            </div>
                            <textarea value={sec.body} onChange={e => updateDraftSection(i, { body: e.target.value })}
                              placeholder="Section body text"
                              className="w-full h-[72px] resize-y bg-[rgba(0,0,0,.07)] border border-[rgba(0,0,0,.12)] rounded-[8px] px-[11px] py-[8px] text-body font-archivo text-[13px] outline-none focus:border-rose-500 leading-relaxed" />
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  {/* Show in web store toggle */}
                  <div className="col-span-2">
                    <label className="text-[11.5px] font-semibold text-sub block mb-[8px]">Show in web store</label>
                    <button type="button" onClick={() => setDraftField('showInWebStore', modal.draft.showInWebStore === false ? true : false)}
                      className="inline-flex items-center gap-[10px] px-[14px] py-[10px] rounded-[10px] cursor-pointer transition-all border"
                      style={{ background: modal.draft.showInWebStore !== false ? 'rgba(219,87,149,.07)' : 'rgba(255,61,77,.06)', borderColor: modal.draft.showInWebStore !== false ? 'rgba(219,87,149,.45)' : 'rgba(255,61,77,.4)' }}>
                      <span className="w-[34px] h-[19px] rounded-full relative flex-none transition-colors" style={{ background: modal.draft.showInWebStore !== false ? '#db5795' : 'rgba(0,0,0,.18)' }}>
                        <span className="absolute top-[2.5px] w-[14px] h-[14px] rounded-full bg-white transition-all shadow-sm" style={{ left: modal.draft.showInWebStore !== false ? '17px' : '2.5px' }} />
                      </span>
                      <span className="font-semibold text-[12.5px]" style={{ color: modal.draft.showInWebStore !== false ? '#705260' : '#e81a2b' }}>
                        {modal.draft.showInWebStore !== false ? 'Visible in web store — customers can find and order this product' : 'POS only — hidden from the web store, available via POS'}
                      </span>
                    </button>
                  </div>
                </>
              )}
              {/* Collection field */}
              {modal.kind === 'collection' && (
                <>
                  <div className="col-span-2"><label className="text-[11.5px] font-semibold text-sub block mb-[6px]">Collection name</label><input value={modal.draft.label ?? ''} onChange={e => setDraftField('label', e.target.value)} placeholder="e.g. Training Gear" className="w-full bg-well border border-[rgba(0,0,0,.12)] rounded-[9px] px-[13px] py-[10px] text-body font-archivo text-[13.5px] outline-none focus:border-rose-500" /></div>
                  <div className="col-span-2">
                    <label className="text-[11.5px] font-semibold text-sub block mb-[6px]">Size chart</label>
                    <select value={modal.draft.sizeChartId ?? ''} onChange={e => setDraftField('sizeChartId', e.target.value || null)} className="w-full bg-well border border-[rgba(0,0,0,.12)] rounded-[9px] px-[13px] py-[10px] text-body font-archivo text-[13.5px] outline-none cursor-pointer">
                      <option value="">Use store default{defaultSizeChart ? ` (${defaultSizeChart.name})` : ''}</option>
                      {sizeCharts.map(c => <option key={c.id} value={c.id}>{c.isDefault ? `★ ${c.name}` : c.name}</option>)}
                    </select>
                  </div>
                </>
              )}
              {/* Category fields */}
              {modal.kind === 'category' && (
                <>
                  <div className="col-span-2"><label className="text-[11.5px] font-semibold text-sub block mb-[6px]">Category name</label><input value={modal.draft.name ?? ''} onChange={e => setDraftField('name', e.target.value)} className="w-full bg-well border border-[rgba(0,0,0,.12)] rounded-[9px] px-[13px] py-[10px] text-body font-archivo text-[13.5px] outline-none focus:border-rose-500" /></div>
                  <div className="col-span-2"><label className="text-[11.5px] font-semibold text-sub block mb-[6px]">Collection</label><select value={modal.draft.collection ?? ''} onChange={e => setDraftField('collection', e.target.value)} className="w-full bg-well border border-[rgba(0,0,0,.12)] rounded-[9px] px-[13px] py-[10px] text-body font-archivo text-[13.5px] outline-none cursor-pointer">{colOpts.map(o => <option key={o.v} value={o.v}>{o.label}</option>)}</select></div>
                </>
              )}
            </div>

            {modal.error && <div className="text-[12px] text-[#e81a2b] mt-[14px]">{modal.error}</div>}

            <div className="flex gap-[11px] mt-[22px]">
              <button onClick={saveModal} disabled={saving} className="flex-1 border-none bg-rose-500 text-[#200612] font-extrabold text-[14px] py-[13px] rounded-xl cursor-pointer shadow-rose-sm hover:brightness-105 transition-all disabled:opacity-60 disabled:cursor-not-allowed">
                {saving ? 'Saving…' : modal.id ? 'Save changes' : 'Add ' + modal.kind.replace(/s$/, '')}
              </button>
              <button onClick={() => setModal(null)} className="border border-[rgba(0,0,0,.16)] bg-transparent text-body font-bold text-[14px] px-[22px] py-[13px] rounded-xl cursor-pointer">Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* ── POS: VARIANT PICKER MODAL ── */}
      {posAddItem && (
        <div className="fixed inset-0 z-[88] bg-[rgba(4,8,7,.82)] backdrop-blur-md flex items-end sm:items-center justify-center p-4" onClick={() => setPosAddItem(null)}>
          <div className="w-full sm:w-[420px] max-h-[90vh] overflow-y-auto bg-surface border border-[rgba(219,87,149,.22)] rounded-[18px] p-5" onClick={e => e.stopPropagation()}>
            <div className="flex items-center gap-3 mb-4">
              <span className="w-11 h-11 rounded-[9px] flex-none" style={{ background: posAddItem.img }} />
              <div>
                <div className="font-bold text-[15px]">{posAddItem.name}</div>
                <div className="text-[11.5px] text-muted">{posAddItem.category}</div>
              </div>
              <button onClick={() => setPosAddItem(null)} className="ml-auto border-none bg-transparent text-muted text-[20px] cursor-pointer"><X size={20} /></button>
            </div>

            {posAddItem.sizes.length > 0 && (
              <div className="mb-4">
                <label className="text-[11.5px] font-semibold text-sub block mb-[8px]">Size</label>
                <div className="flex flex-wrap gap-2">
                  {posAddItem.sizes.map(s => {
                    const outOfStock = !!posLocId && inventoryStockForVariant(posInvRows, posAddItem.id, posAddColor, s) === 0;
                    return (
                      <button key={s} onClick={() => setPosAddSize(s)} disabled={outOfStock}
                        className="px-3 py-[7px] rounded-[8px] text-[12.5px] font-bold border transition-all cursor-pointer disabled:opacity-35 disabled:cursor-not-allowed"
                        style={{ background: posAddSize === s ? '#db5795' : 'transparent', color: posAddSize === s ? '#200612' : '#705260', borderColor: posAddSize === s ? '#db5795' : 'rgba(0,0,0,.16)' }}>
                        {s}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
            {posAddItem.colors.length > 0 && (
              <div className="mb-4">
                <label className="text-[11.5px] font-semibold text-sub block mb-[8px]">Color</label>
                <div className="flex flex-wrap gap-2">
                  {posAddItem.colors.map(c => (
                    <button key={c} onClick={() => {
                      setPosAddColor(c);
                      if (posLocId && inventoryStockForVariant(posInvRows, posAddItem.id, c, posAddSize) === 0) {
                        setPosAddSize(firstAvailableSize(posInvRows, posAddItem, c));
                      }
                    }} className="inline-flex items-center gap-[6px] px-3 py-[7px] rounded-[8px] text-[12.5px] font-bold border transition-all cursor-pointer"
                      style={{ background: posAddColor === c ? '#db5795' : 'transparent', color: posAddColor === c ? '#200612' : '#705260', borderColor: posAddColor === c ? '#db5795' : 'rgba(0,0,0,.16)' }}>
                      <span className="w-[11px] h-[11px] rounded-full flex-none border border-[rgba(0,0,0,.15)]" style={{ background: productColorHex(posAddItem.colorHex, c) }} />
                      {c}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="mb-4">
              <label className="text-[11.5px] font-semibold text-sub block mb-[8px]">Qty</label>
              <div className="flex items-center gap-3">
                <button onClick={() => setPosAddQty(q => Math.max(1, q - 1))} className="w-9 h-9 bg-[rgba(0,0,0,.08)] border border-[rgba(0,0,0,.12)] rounded-[8px] text-[16px] cursor-pointer">−</button>
                <span className="font-bold text-[16px] tabular w-8 text-center">{posAddQty}</span>
                <button
                  onClick={() => setPosAddQty(q => {
                    if (!posLocId) return q + 1;
                    const available = inventoryStockForVariant(posInvRows, posAddItem.id, posAddColor, posAddSize);
                    return Math.min(available, q + 1);
                  })}
                  disabled={!!posLocId && posAddQty >= inventoryStockForVariant(posInvRows, posAddItem.id, posAddColor, posAddSize)}
                  className="w-9 h-9 bg-[rgba(0,0,0,.08)] border border-[rgba(0,0,0,.12)] rounded-[8px] text-[16px] cursor-pointer disabled:opacity-35 disabled:cursor-not-allowed"
                >+</button>
              </div>
              {posLocId && (
                <div className={`mt-2 text-[11.5px] font-semibold px-3 py-2 rounded-[8px] border ${inventoryStockForVariant(posInvRows, posAddItem.id, posAddColor, posAddSize) === 0 ? 'text-[#e81a2b] bg-[rgba(255,61,77,.08)] border-[rgba(255,61,77,.22)]' : 'text-rose-600 bg-[rgba(219,87,149,.06)] border-[rgba(219,87,149,.2)]'}`}>
                  {posInvLoading ? 'Checking stock…' : (() => {
                    const available = inventoryStockForVariant(posInvRows, posAddItem.id, posAddColor, posAddSize);
                    const shelf = inventoryPhysicalLocation(posInvRows, posAddItem.id);
                    return `Available: ${available} · ${shelf ? `Shelf ${shelf}` : 'Shelf not set'}`;
                  })()}
                </div>
              )}
              {!posLocId && (
                <div className="mt-2 text-[11.5px] font-semibold px-3 py-2 rounded-[8px] text-[#e81a2b] bg-[rgba(255,61,77,.08)] border border-[rgba(255,61,77,.22)]">
                  Select a location to check stock.
                </div>
              )}
            </div>

            <div className="text-[12.5px] text-sub mb-4">
              Unit price: <span className="font-bold text-body">MVR {posAddItem.price.toLocaleString()}</span>
            </div>

            <button
              onClick={addToCart}
              disabled={!posLocId || inventoryStockForVariant(posInvRows, posAddItem.id, posAddColor, posAddSize) <= 0 || posAddQty > inventoryStockForVariant(posInvRows, posAddItem.id, posAddColor, posAddSize)}
              className="w-full bg-rose-500 text-[#200612] font-extrabold text-[14px] py-[13px] rounded-[10px] border-none cursor-pointer disabled:opacity-50 shadow-rose-sm">
              Add to Ticket
            </button>
          </div>
        </div>
      )}

      {/* ── POS: RECEIVE STOCK MODAL ── */}
      {invReceive && (
        <div className="fixed inset-0 z-[88] bg-[rgba(4,8,7,.82)] backdrop-blur-md flex items-center justify-center p-6" onClick={() => setInvReceive(null)}>
          <div className="w-[380px] max-w-full bg-surface border border-[rgba(219,87,149,.22)] rounded-[18px] p-6" onClick={e => e.stopPropagation()}>
            <div className="flex items-start justify-between mb-5">
              <div>
                <div className="font-bold text-[17px]">Receive Stock</div>
                <div className="text-[12px] text-muted mt-1">{data.locations.find(l => l.id === invLocId)?.name ?? 'Location'}</div>
              </div>
              <button onClick={() => setInvReceive(null)} className="border-none bg-transparent text-muted text-[20px] cursor-pointer mt-1"><X size={20} /></button>
            </div>
            <div className="flex flex-col gap-3">
              <div>
                <label className="text-[11.5px] font-semibold text-sub block mb-[6px]">Product</label>
                <select value={invReceive.productId} onChange={e => { const p = allProducts.find(x => x.id === e.target.value); setInvReceive(r => r ? { ...r, productId: e.target.value, productName: p?.name ?? '', size: p?.sizes[0] ?? '', color: p?.colors[0] ?? '' } : r); }}
                  className="w-full bg-well border border-[rgba(0,0,0,.12)] rounded-[9px] px-3 py-[10px] text-[13px] outline-none cursor-pointer">
                  <option value="">Select product…</option>
                  {allProducts.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
              {invReceive.productId && (() => {
                const p = allProducts.find(x => x.id === invReceive.productId);
                return p && p.sizes.length > 0 ? (
                  <div>
                    <label className="text-[11.5px] font-semibold text-sub block mb-[6px]">Size</label>
                    <select value={invReceive.size} onChange={e => setInvReceive(r => r ? { ...r, size: e.target.value } : r)}
                      className="w-full bg-well border border-[rgba(0,0,0,.12)] rounded-[9px] px-3 py-[10px] text-[13px] outline-none cursor-pointer">
                      {p.sizes.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                ) : null;
              })()}
              {invReceive.productId && (() => {
                const p = allProducts.find(x => x.id === invReceive.productId);
                return p && p.colors.length > 0 ? (
                  <div>
                    <label className="text-[11.5px] font-semibold text-sub block mb-[6px]">Colour</label>
                    <select value={invReceive.color} onChange={e => setInvReceive(r => r ? { ...r, color: e.target.value } : r)}
                      className="w-full bg-well border border-[rgba(0,0,0,.12)] rounded-[9px] px-3 py-[10px] text-[13px] outline-none cursor-pointer">
                      {p.colors.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                ) : null;
              })()}
              <div>
                <label className="text-[11.5px] font-semibold text-sub block mb-[6px]">Qty to add</label>
                <input type="number" min="1" value={invReceive.qty} onChange={e => setInvReceive(r => r ? { ...r, qty: e.target.value } : r)} autoFocus
                  className="w-full bg-well border border-[rgba(0,0,0,.12)] rounded-[9px] px-3 py-[10px] text-[14px] tabular outline-none focus:border-rose-500" />
              </div>
            </div>
            <div className="flex gap-[10px] mt-5">
              <button onClick={submitReceiveStock} disabled={invReceiving || !invReceive.productId || !(parseInt(invReceive.qty) > 0)}
                className="flex-1 bg-rose-500 text-[#200612] font-extrabold text-[14px] py-[12px] rounded-[10px] border-none cursor-pointer disabled:opacity-50 shadow-rose-sm">
                {invReceiving ? 'Adding…' : `Add ${invReceive.qty || 0} units`}
              </button>
              <button onClick={() => setInvReceive(null)} className="border border-[rgba(0,0,0,.16)] bg-transparent text-body font-bold px-4 py-[12px] rounded-[10px] cursor-pointer">Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* ── ADJUST STOCK MODAL ── */}
      {adjModal && (
        <div className="fixed inset-0 z-[88] bg-[rgba(4,8,7,.82)] backdrop-blur-md flex items-center justify-center p-6" onClick={() => setAdjModal(null)}>
          <div className="w-[400px] max-w-full bg-surface border border-[rgba(255,61,77,.3)] rounded-[18px] p-6" onClick={e => e.stopPropagation()}>
            <div className="flex items-start justify-between mb-5">
              <div>
                <div className="font-bold text-[17px]">Adjust Stock</div>
                <div className="text-[12px] text-muted mt-1">{data.locations.find(l => l.id === invLocId)?.name ?? 'Location'} — corrections, write-offs, found</div>
              </div>
              <button onClick={() => setAdjModal(null)} className="border-none bg-transparent text-muted text-[20px] cursor-pointer mt-1"><X size={20} /></button>
            </div>
            <div className="flex flex-col gap-3">
              <div>
                <label className="text-[11.5px] font-semibold text-sub block mb-[6px]">Product</label>
                <select value={adjModal.productId} onChange={e => { const p = allProducts.find(x => x.id === e.target.value); setAdjModal(m => m ? { ...m, productId: e.target.value, productName: p?.name ?? '', size: p?.sizes[0] ?? '', color: p?.colors[0] ?? '' } : m); }}
                  className="w-full bg-well border border-[rgba(0,0,0,.12)] rounded-[9px] px-3 py-[10px] text-[13px] outline-none cursor-pointer">
                  <option value="">Select product…</option>
                  {allProducts.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
              {adjModal.productId && (() => {
                const p = allProducts.find(x => x.id === adjModal.productId);
                return p && p.sizes.length > 0 ? (
                  <div>
                    <label className="text-[11.5px] font-semibold text-sub block mb-[6px]">Size</label>
                    <select value={adjModal.size} onChange={e => setAdjModal(m => m ? { ...m, size: e.target.value } : m)}
                      className="w-full bg-well border border-[rgba(0,0,0,.12)] rounded-[9px] px-3 py-[10px] text-[13px] outline-none cursor-pointer">
                      {p.sizes.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                ) : null;
              })()}
              {adjModal.productId && (() => {
                const p = allProducts.find(x => x.id === adjModal.productId);
                return p && p.colors.length > 0 ? (
                  <div>
                    <label className="text-[11.5px] font-semibold text-sub block mb-[6px]">Colour</label>
                    <select value={adjModal.color} onChange={e => setAdjModal(m => m ? { ...m, color: e.target.value } : m)}
                      className="w-full bg-well border border-[rgba(0,0,0,.12)] rounded-[9px] px-3 py-[10px] text-[13px] outline-none cursor-pointer">
                      {p.colors.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                ) : null;
              })()}
              <div>
                <label className="text-[11.5px] font-semibold text-sub block mb-[6px]">Qty change <span className="text-muted font-normal">(+ to add, − to remove)</span></label>
                <input type="number" value={adjModal.qty} onChange={e => setAdjModal(m => m ? { ...m, qty: e.target.value } : m)} placeholder="e.g. -3 or +5"
                  className="w-full bg-well border border-[rgba(0,0,0,.12)] rounded-[9px] px-3 py-[10px] text-[14px] tabular outline-none focus:border-rose-500" autoFocus />
              </div>
              <div>
                <label className="text-[11.5px] font-semibold text-sub block mb-[6px]">Reason</label>
                <div className="grid grid-cols-2 gap-2">
                  {(['correction', 'found', 'damage', 'write_off'] as const).map(r => (
                    <button key={r} type="button" onClick={() => setAdjModal(m => m ? { ...m, reason: r } : m)}
                      className="text-[12px] font-semibold px-3 py-[8px] rounded-[8px] border capitalize cursor-pointer transition-all"
                      style={{ background: adjModal.reason === r ? 'rgba(219,87,149,.08)' : 'transparent', borderColor: adjModal.reason === r ? 'rgba(219,87,149,.4)' : 'rgba(0,0,0,.12)', color: adjModal.reason === r ? '#705260' : '#705260' }}>
                      {r.replace('_', ' ')}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-[11.5px] font-semibold text-sub block mb-[6px]">Note <span className="text-muted font-normal">(optional)</span></label>
                <input value={adjModal.note} onChange={e => setAdjModal(m => m ? { ...m, note: e.target.value } : m)} placeholder="Internal note…"
                  className="w-full bg-well border border-[rgba(0,0,0,.12)] rounded-[9px] px-3 py-[10px] text-[13px] outline-none focus:border-rose-500" />
              </div>
            </div>
            <div className="flex gap-[10px] mt-5">
              <button onClick={submitAdjustStock} disabled={adjSubmitting || !adjModal.productId || !adjModal.qty || parseInt(adjModal.qty) === 0}
                className="flex-1 bg-[#ff3d4d] text-white font-extrabold text-[14px] py-[12px] rounded-[10px] border-none cursor-pointer disabled:opacity-50">
                {adjSubmitting ? 'Adjusting…' : `Apply ${parseInt(adjModal.qty) > 0 ? '+' : ''}${adjModal.qty || 0} units`}
              </button>
              <button onClick={() => setAdjModal(null)} className="border border-[rgba(0,0,0,.16)] bg-transparent text-body font-bold px-4 py-[12px] rounded-[10px] cursor-pointer">Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* ── LOCATION MODAL ── */}
      {locModal && (
        <div className="fixed inset-0 z-[88] bg-[rgba(4,8,7,.82)] backdrop-blur-md flex items-center justify-center p-6" onClick={() => setLocModal(null)}>
          <div className="w-[380px] max-w-full bg-surface border border-[rgba(219,87,149,.22)] rounded-[18px] p-6" onClick={e => e.stopPropagation()}>
            <div className="flex items-start justify-between mb-5">
              <h3 className="font-archivo-narrow font-bold text-[20px]">{locModal.id ? 'Edit' : 'New'} location</h3>
              <button onClick={() => setLocModal(null)} className="border-none bg-transparent text-muted text-[20px] cursor-pointer"><X size={20} /></button>
            </div>
            <div className="flex flex-col gap-3">
              <div>
                <label className="text-[11.5px] font-semibold text-sub block mb-[6px]">Name</label>
                <input value={locModal.draft.name} onChange={e => setLocModal(m => m ? { ...m, draft: { ...m.draft, name: e.target.value }, error: '' } : m)} placeholder="e.g. Malé Branch"
                  className="w-full bg-well border border-[rgba(0,0,0,.12)] rounded-[9px] px-3 py-[10px] text-[13.5px] outline-none focus:border-rose-500" autoFocus />
              </div>
              <div>
                <label className="text-[11.5px] font-semibold text-sub block mb-[6px]">Sort order</label>
                <input type="number" value={locModal.draft.sortOrder} onChange={e => setLocModal(m => m ? { ...m, draft: { ...m.draft, sortOrder: e.target.value } } : m)}
                  className="w-full bg-well border border-[rgba(0,0,0,.12)] rounded-[9px] px-3 py-[10px] text-[13.5px] tabular outline-none focus:border-rose-500" />
              </div>
              <div className="flex flex-col gap-2">
                {([['showOnWeb', 'Show on web', 'Products with stock here appear on the storefront'], ['isWebDefault', 'Web default', 'Online orders deplete stock from this location']] as [keyof typeof locModal.draft, string, string][]).map(([k, lbl, desc]) => (
                  <button key={k} onClick={() => setLocModal(m => m ? { ...m, draft: { ...m.draft, [k]: !m.draft[k] } } : m)}
                    className="flex items-start gap-3 p-3 rounded-[9px] border text-left transition-all cursor-pointer"
                    style={{ background: locModal.draft[k] ? 'rgba(219,87,149,.06)' : 'transparent', borderColor: locModal.draft[k] ? 'rgba(219,87,149,.3)' : 'rgba(0,0,0,.1)' }}>
                    <span className="w-4 h-4 rounded-[4px] mt-[1px] flex-none inline-flex items-center justify-center text-[10px] font-black"
                      style={{ background: locModal.draft[k] ? '#db5795' : 'rgba(0,0,0,.08)', color: locModal.draft[k] ? '#200612' : 'transparent', border: locModal.draft[k] ? 'none' : '1px solid rgba(0,0,0,.2)' }}><Check size={14} /></span>
                    <div><div className="text-[13px] font-semibold">{lbl}</div><div className="text-[11px] text-muted mt-[2px]">{desc}</div></div>
                  </button>
                ))}
              </div>
            </div>
            {locModal.error && <div className="text-[12px] text-[#e81a2b] mt-3">{locModal.error}</div>}
            <div className="flex gap-[10px] mt-5">
              <button onClick={saveLocation} disabled={saving}
                className="flex-1 bg-rose-500 text-[#200612] font-extrabold text-[14px] py-[12px] rounded-[10px] border-none cursor-pointer disabled:opacity-60 shadow-rose-sm">
                {saving ? 'Saving…' : locModal.id ? 'Save changes' : 'Create location'}
              </button>
              <button onClick={() => setLocModal(null)} className="border border-[rgba(0,0,0,.16)] bg-transparent text-body font-bold px-4 py-[12px] rounded-[10px] cursor-pointer">Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* ── DELIVERY AREA MODAL ── */}
      {deliveryAreaModal && (
        <div className="fixed inset-0 z-[88] bg-[rgba(4,8,7,.82)] backdrop-blur-md flex items-center justify-center p-6" onClick={() => setDeliveryAreaModal(null)}>
          <div className="w-[380px] max-w-full bg-surface border border-[rgba(219,87,149,.22)] rounded-[18px] p-6" onClick={e => e.stopPropagation()}>
            <div className="flex items-start justify-between mb-5">
              <h3 className="font-archivo-narrow font-bold text-[20px]">{deliveryAreaModal.id ? 'Edit' : 'New'} delivery area</h3>
              <button onClick={() => setDeliveryAreaModal(null)} className="border-none bg-transparent text-muted text-[20px] cursor-pointer"><X size={20} /></button>
            </div>
            <div className="flex flex-col gap-3">
              <div>
                <label className="text-[11.5px] font-semibold text-sub block mb-[6px]">Name</label>
                <input value={deliveryAreaModal.draft.name} onChange={e => setDeliveryAreaModal(m => m ? { ...m, draft: { ...m.draft, name: e.target.value }, error: '' } : m)} placeholder="e.g. Hulhumalé"
                  className="w-full bg-well border border-[rgba(0,0,0,.12)] rounded-[9px] px-3 py-[10px] text-[13.5px] outline-none focus:border-rose-500" autoFocus />
              </div>
              <div>
                <label className="text-[11.5px] font-semibold text-sub block mb-[6px]">Rate (MVR)</label>
                <input type="number" value={deliveryAreaModal.draft.rate} onChange={e => setDeliveryAreaModal(m => m ? { ...m, draft: { ...m.draft, rate: e.target.value }, error: '' } : m)}
                  className="w-full bg-well border border-[rgba(0,0,0,.12)] rounded-[9px] px-3 py-[10px] text-[13.5px] tabular outline-none focus:border-rose-500" />
              </div>
              <div>
                <label className="text-[11.5px] font-semibold text-sub block mb-[6px]">Sort order</label>
                <input type="number" value={deliveryAreaModal.draft.sortOrder} onChange={e => setDeliveryAreaModal(m => m ? { ...m, draft: { ...m.draft, sortOrder: e.target.value } } : m)}
                  className="w-full bg-well border border-[rgba(0,0,0,.12)] rounded-[9px] px-3 py-[10px] text-[13.5px] tabular outline-none focus:border-rose-500" />
              </div>
              <button onClick={() => setDeliveryAreaModal(m => m ? { ...m, draft: { ...m.draft, active: !m.draft.active } } : m)}
                className="flex items-start gap-3 p-3 rounded-[9px] border text-left transition-all cursor-pointer"
                style={{ background: deliveryAreaModal.draft.active ? 'rgba(219,87,149,.06)' : 'transparent', borderColor: deliveryAreaModal.draft.active ? 'rgba(219,87,149,.3)' : 'rgba(0,0,0,.1)' }}>
                <span className="w-4 h-4 rounded-[4px] mt-[1px] flex-none inline-flex items-center justify-center text-[10px] font-black"
                  style={{ background: deliveryAreaModal.draft.active ? '#db5795' : 'rgba(0,0,0,.08)', color: deliveryAreaModal.draft.active ? '#200612' : 'transparent', border: deliveryAreaModal.draft.active ? 'none' : '1px solid rgba(0,0,0,.2)' }}><Check size={14} /></span>
                <div><div className="text-[13px] font-semibold">Active</div><div className="text-[11px] text-muted mt-[2px]">Offered to customers at checkout when active</div></div>
              </button>
            </div>
            {deliveryAreaModal.error && <div className="text-[12px] text-[#e81a2b] mt-3">{deliveryAreaModal.error}</div>}
            <div className="flex gap-[10px] mt-5">
              <button onClick={saveDeliveryArea} disabled={saving}
                className="flex-1 bg-rose-500 text-[#200612] font-extrabold text-[14px] py-[12px] rounded-[10px] border-none cursor-pointer disabled:opacity-60 shadow-rose-sm">
                {saving ? 'Saving…' : deliveryAreaModal.id ? 'Save changes' : 'Create area'}
              </button>
              <button onClick={() => setDeliveryAreaModal(null)} className="border border-[rgba(0,0,0,.16)] bg-transparent text-body font-bold px-4 py-[12px] rounded-[10px] cursor-pointer">Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* ── CONFIRM DELETE ── */}
      {confirm && (
        <div className="fixed inset-0 z-[85] bg-[rgba(4,8,7,.8)] backdrop-blur-md flex items-center justify-center p-6" onClick={() => setConfirm(null)}>
          <div role="alertdialog" aria-modal="true" aria-labelledby="admin-confirm-title" className="w-[380px] max-w-full bg-surface border border-[rgba(255,61,77,.35)] rounded-[18px] p-6 text-center" onClick={e => e.stopPropagation()}>
            <div className="w-[52px] h-[52px] rounded-[13px] bg-[rgba(255,61,77,.12)] text-[#ff3d4d] inline-flex items-center justify-center text-[24px] mb-[14px]" aria-hidden="true"><Trash2 size={24} /></div>
            <div id="admin-confirm-title" className="font-bold text-[17px]">Delete {confirm.name}?</div>
            <div className="text-[13px] text-[#705260] mt-[7px] leading-[1.5]">This permanently removes it from the store.</div>
            {confirm.detail && <div className="text-[12.5px] text-[#e81a2b] mt-[10px] bg-[rgba(255,61,77,.08)] border border-[rgba(255,61,77,.2)] rounded-[9px] px-3 py-[9px] leading-[1.5]">{confirm.detail}</div>}
            <div className="flex gap-[11px] mt-5">
              <button onClick={doDelete} disabled={saving} className="flex-1 border-none bg-[#ff3d4d] text-white font-extrabold text-[13.5px] py-3 rounded-[10px] cursor-pointer disabled:opacity-60">{saving ? 'Deleting…' : 'Delete'}</button>
              <button onClick={() => setConfirm(null)} className="flex-1 border border-[rgba(0,0,0,.16)] bg-transparent text-body font-bold text-[13.5px] py-3 rounded-[10px] cursor-pointer">Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* ── PROMO MODAL ── */}
      {promoModal && (
        <div className="fixed inset-0 z-[80] bg-[rgba(4,8,7,.78)] backdrop-blur-md flex items-center justify-center p-6" onClick={() => setPromoModal(null)}>
          <div role="dialog" aria-modal="true" aria-labelledby="promo-modal-title" className="w-[560px] max-w-full max-h-[90vh] overflow-auto bg-surface border border-[rgba(219,87,149,.25)] rounded-[20px] p-6" onClick={e => e.stopPropagation()}>
            <div className="flex items-start justify-between gap-[14px] mb-[18px]">
              <h3 id="promo-modal-title" className="font-archivo-narrow font-bold text-[23px]">{promoModal.id ? 'Edit' : 'New'} promo / referral code</h3>
              <button onClick={() => setPromoModal(null)} className="border-none bg-transparent text-muted text-[20px] cursor-pointer"><X size={20} /></button>
            </div>

            <div className="grid grid-cols-2 gap-[14px]">
              <div><label className="text-[11.5px] font-semibold text-sub block mb-[6px]">Code</label><input value={promoModal.draft.code ?? ''} onChange={e => setPromoField('code', e.target.value.toUpperCase())} placeholder="SUMMER10" className="w-full bg-well border border-[rgba(0,0,0,.12)] rounded-[9px] px-[13px] py-[10px] text-body font-archivo font-bold text-[13.5px] uppercase tracking-[.04em] outline-none focus:border-rose-500" /></div>
              <div>
                <label className="text-[11.5px] font-semibold text-sub block mb-[6px]">Active</label>
                <button onClick={() => setPromoField('active', !promoModal.draft.active)} className="w-full font-bold text-[13px] px-4 py-[10px] rounded-[9px] cursor-pointer transition-all" style={{ border: promoModal.draft.active ? 'none' : '1px solid rgba(0,0,0,.16)', background: promoModal.draft.active ? '#db5795' : 'transparent', color: promoModal.draft.active ? '#200612' : '#705260' }}>{promoModal.draft.active ? <><Check size={12} className="inline mr-1" /> Active</> : 'Inactive'}</button>
              </div>
              <div className="col-span-2"><label className="text-[11.5px] font-semibold text-sub block mb-[6px]">Description <span className="text-muted font-normal">(optional, internal)</span></label><input value={promoModal.draft.description ?? ''} onChange={e => setPromoField('description', e.target.value)} className="w-full bg-well border border-[rgba(0,0,0,.12)] rounded-[9px] px-[13px] py-[10px] text-body font-archivo text-[13.5px] outline-none focus:border-rose-500" /></div>

              <div><label className="text-[11.5px] font-semibold text-sub block mb-[6px]">Discount type</label><select value={promoModal.draft.discountType} onChange={e => setPromoField('discountType', e.target.value)} className="w-full bg-well border border-[rgba(0,0,0,.12)] rounded-[9px] px-[13px] py-[10px] text-body font-archivo text-[13.5px] outline-none cursor-pointer"><option value="percent">Percentage (%)</option><option value="fixed">Fixed (MVR)</option></select></div>
              <div><label className="text-[11.5px] font-semibold text-sub block mb-[6px]">{promoModal.draft.discountType === 'percent' ? 'Percent off (1–100)' : 'Amount off (MVR)'}</label><input value={promoModal.draft.discountValue ?? ''} onChange={e => setPromoField('discountValue', e.target.value)} className="w-full bg-well border border-[rgba(0,0,0,.12)] rounded-[9px] px-[13px] py-[10px] text-body font-archivo text-[13.5px] outline-none focus:border-rose-500 tabular" /></div>

              <div><label className="text-[11.5px] font-semibold text-sub block mb-[6px]">Applies to</label><select value={promoModal.draft.scope} onChange={e => setPromoField('scope', e.target.value)} className="w-full bg-well border border-[rgba(0,0,0,.12)] rounded-[9px] px-[13px] py-[10px] text-body font-archivo text-[13.5px] outline-none cursor-pointer"><option value="all">Everything</option><option value="collection">A collection</option><option value="category">A category</option></select></div>
              <div>
                <label className="text-[11.5px] font-semibold text-sub block mb-[6px]">{promoModal.draft.scope === 'category' ? 'Category' : 'Collection'}</label>
                {promoModal.draft.scope === 'all' ? (
                  <div className="text-[12px] text-muted px-[13px] py-[11px]">Applies to the whole cart.</div>
                ) : promoModal.draft.scope === 'collection' ? (
                  <select value={promoModal.draft.scopeValue ?? ''} onChange={e => setPromoField('scopeValue', e.target.value)} className="w-full bg-well border border-[rgba(0,0,0,.12)] rounded-[9px] px-[13px] py-[10px] text-body font-archivo text-[13.5px] outline-none cursor-pointer"><option value="">Select…</option>{data.collections.map(c => <option key={c.key} value={c.key}>{c.label}</option>)}</select>
                ) : (
                  <select value={promoModal.draft.scopeValue ?? ''} onChange={e => setPromoField('scopeValue', e.target.value)} className="w-full bg-well border border-[rgba(0,0,0,.12)] rounded-[9px] px-[13px] py-[10px] text-body font-archivo text-[13.5px] outline-none cursor-pointer"><option value="">Select…</option>{data.categories.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}</select>
                )}
              </div>

              <div><label className="text-[11.5px] font-semibold text-sub block mb-[6px]">Min order (MVR)</label><input value={promoModal.draft.minSubtotal ?? ''} onChange={e => setPromoField('minSubtotal', e.target.value)} className="w-full bg-well border border-[rgba(0,0,0,.12)] rounded-[9px] px-[13px] py-[10px] text-body font-archivo text-[13.5px] outline-none focus:border-rose-500 tabular" /></div>
              <div><label className="text-[11.5px] font-semibold text-sub block mb-[6px]">Max uses <span className="text-muted font-normal">(blank = ∞)</span></label><input value={promoModal.draft.maxRedemptions ?? ''} onChange={e => setPromoField('maxRedemptions', e.target.value)} className="w-full bg-well border border-[rgba(0,0,0,.12)] rounded-[9px] px-[13px] py-[10px] text-body font-archivo text-[13.5px] outline-none focus:border-rose-500 tabular" /></div>
              <div className="col-span-2"><label className="text-[11.5px] font-semibold text-sub block mb-[6px]">Expires <span className="text-muted font-normal">(optional)</span></label><input type="date" value={promoModal.draft.expiresAt ?? ''} onChange={e => setPromoField('expiresAt', e.target.value)} className="w-full bg-well border border-[rgba(0,0,0,.12)] rounded-[9px] px-[13px] py-[10px] text-body font-archivo text-[13.5px] outline-none focus:border-rose-500" /></div>

              <div className="col-span-2 h-px bg-[rgba(0,0,0,.08)] mt-1" />
              <div className="col-span-2 text-[12px] font-bold text-[#705260]">Referral / compensation</div>
              <div className="col-span-2"><label className="text-[11.5px] font-semibold text-sub block mb-[6px]">Referrer <span className="text-muted font-normal">(who is paid for redemptions)</span></label><input value={promoModal.draft.referrer ?? ''} onChange={e => setPromoField('referrer', e.target.value)} placeholder="e.g. Maafushi FC" className="w-full bg-well border border-[rgba(0,0,0,.12)] rounded-[9px] px-[13px] py-[10px] text-body font-archivo text-[13.5px] outline-none focus:border-rose-500" /></div>
              <div><label className="text-[11.5px] font-semibold text-sub block mb-[6px]">Commission</label><select value={promoModal.draft.commissionType} onChange={e => setPromoField('commissionType', e.target.value)} className="w-full bg-well border border-[rgba(0,0,0,.12)] rounded-[9px] px-[13px] py-[10px] text-body font-archivo text-[13.5px] outline-none cursor-pointer"><option value="none">None</option><option value="percent_of_order">% of order</option><option value="percent_of_discount">% of discount</option><option value="fixed">Fixed per use</option></select></div>
              <div><label className="text-[11.5px] font-semibold text-sub block mb-[6px]">{promoModal.draft.commissionType === 'fixed' ? 'Amount (MVR)' : 'Percent (%)'}</label><input value={promoModal.draft.commissionValue ?? ''} onChange={e => setPromoField('commissionValue', e.target.value)} disabled={promoModal.draft.commissionType === 'none'} className="w-full bg-well border border-[rgba(0,0,0,.12)] rounded-[9px] px-[13px] py-[10px] text-body font-archivo text-[13.5px] outline-none focus:border-rose-500 tabular disabled:opacity-50" /></div>
            </div>

            {promoModal.error && <div className="text-[12px] text-[#e81a2b] mt-[14px]">{promoModal.error}</div>}

            <div className="flex gap-[11px] mt-[22px]">
              <button onClick={savePromo} disabled={saving} className="flex-1 border-none bg-rose-500 text-[#200612] font-extrabold text-[14px] py-[13px] rounded-xl cursor-pointer shadow-rose-sm hover:brightness-105 transition-all disabled:opacity-60">{saving ? 'Saving…' : promoModal.id ? 'Save changes' : 'Create code'}</button>
              <button onClick={() => setPromoModal(null)} className="border border-[rgba(0,0,0,.16)] bg-transparent text-body font-bold text-[14px] px-[22px] py-[13px] rounded-xl cursor-pointer">Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* ── SLIP VIEWER MODAL ── */}
      {slipModal && (
        <div className="fixed inset-0 z-[90] bg-[rgba(4,8,7,.88)] backdrop-blur-md flex items-center justify-center p-4" onClick={() => { setSlipModal(null); setSlipLoadFailed(false); }}>
          <div className="relative max-w-[90vw] max-h-[90vh] flex flex-col items-center gap-3" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between w-full">
              <span className="text-[12px] font-bold text-[#705260]">Payment slip</span>
              <div className="flex items-center gap-2">
                {!slipModal.expired && (
                  <a href={slipModal.url} download target="_blank" rel="noopener noreferrer"
                    className="text-[12px] font-bold text-rose-700 border border-[rgba(219,87,149,.3)] px-3 py-[6px] rounded-[8px] no-underline hover:brightness-125 transition-all">
                    ↓ Download
                  </a>
                )}
                <button onClick={() => { setSlipModal(null); setSlipLoadFailed(false); }} className="w-8 h-8 rounded-[9px] border border-[rgba(0,0,0,.14)] bg-[rgba(0,0,0,.07)] text-sub cursor-pointer text-[16px] hover:text-body transition-colors"><X size={16} /></button>
              </div>
            </div>
            {slipModal.expired || slipLoadFailed ? (
              <div className="w-[60vw] max-w-[420px] py-16 px-6 rounded-[12px] border border-[rgba(0,0,0,.1)] bg-[rgba(0,0,0,.03)] text-center">
                <p className="text-[13px] font-semibold text-body mb-1">This payment slip is no longer available</p>
                <p className="text-[12px] text-muted">Payment slips are automatically deleted 90 days after upload.</p>
              </div>
            ) : slipModal.url.toLowerCase().endsWith('.pdf') ? (
              <iframe src={slipModal.url} onError={() => setSlipLoadFailed(true)} className="w-[80vw] h-[80vh] rounded-[12px] border border-[rgba(0,0,0,.1)]" />
            ) : (
              <img src={slipModal.url} alt="Payment slip" onError={() => setSlipLoadFailed(true)} className="max-w-[85vw] max-h-[80vh] rounded-[12px] border border-[rgba(0,0,0,.1)] object-contain" />
            )}
          </div>
        </div>
      )}

      {/* ── MARK PAID MODAL ── */}
      {markPaidModal && (
        <div className="fixed inset-0 z-[90] bg-[rgba(4,8,7,.8)] backdrop-blur-md flex items-center justify-center p-4" onClick={() => setMarkPaidModal(null)}>
          <div className="w-[420px] max-w-full bg-surface border border-[rgba(219,87,149,.22)] rounded-[20px] p-6" onClick={e => e.stopPropagation()}>
            <div className="flex items-start justify-between mb-5">
              <div><div className="font-bold text-[18px]">Mark as paid</div><div className="text-[12px] text-muted mt-1">Record how the MVR {markPaidModal.total.toLocaleString()} was received.</div></div>
              <button onClick={() => setMarkPaidModal(null)} className="border-none bg-transparent text-muted text-[22px] cursor-pointer"><X size={22} /></button>
            </div>
            <div className="grid grid-cols-1 gap-3">
              {([['paidCash','Cash'],['paidCard','Card'],['paidTransfer','Bank Transfer']] as [keyof typeof markPaidDraft, string][]).map(([k, lbl]) => (
                <div key={k}>
                  <label className="text-[11.5px] font-semibold text-sub block mb-[5px]">{lbl} (MVR)</label>
                  <input type="number" min="0" value={markPaidDraft[k]} onChange={e => setMarkPaidDraft(d => ({ ...d, [k]: e.target.value }))}
                    className="w-full bg-well border border-[rgba(0,0,0,.12)] rounded-[9px] px-3 py-[9px] text-[13.5px] tabular outline-none focus:border-rose-500" />
                </div>
              ))}
            </div>
            {markPaidError && <div className="text-[12px] text-[#e81a2b] mt-3">{markPaidError}</div>}
            <div className="flex gap-3 mt-5">
              <button onClick={confirmMarkPaid} disabled={markPaidSaving} className="flex-1 border-none bg-rose-500 text-[#200612] font-extrabold text-[14px] py-[12px] rounded-xl cursor-pointer disabled:opacity-50">{markPaidSaving ? 'Saving…' : 'Confirm paid'}</button>
              <button onClick={() => setMarkPaidModal(null)} className="border border-[rgba(0,0,0,.16)] bg-transparent text-body font-bold text-[14px] px-[20px] py-[12px] rounded-xl cursor-pointer">Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* ── USER MODAL ── */}
      {userModal && (
        <div className="fixed inset-0 z-[80] bg-[rgba(4,8,7,.78)] backdrop-blur-md flex items-center justify-center p-6" onClick={() => setUserModal(null)}>
          <div role="dialog" aria-modal="true" className="w-[600px] max-w-full max-h-[88vh] flex flex-col bg-surface border border-[rgba(219,87,149,.25)] rounded-[20px] p-6" onClick={e => e.stopPropagation()}>
            <div className="flex items-start justify-between gap-3 mb-[18px] flex-none">
              <h3 className="font-archivo-narrow font-bold text-[22px]">{userModal.id ? 'Edit user' : 'New user'}</h3>
              <button onClick={() => setUserModal(null)} className="border-none bg-transparent text-muted text-[20px] cursor-pointer"><X size={20} /></button>
            </div>
            <div className="flex-1 overflow-y-auto flex flex-col gap-[14px] pr-1">
              <div>
                <label className="text-[11.5px] font-semibold text-sub block mb-[6px]">Email</label>
                <input value={userModal.draft.email ?? ''} onChange={e => setUserField('email', e.target.value)} disabled={!!userModal.id} placeholder="user@dresscollectionmv.com"
                  className="w-full bg-well border border-[rgba(0,0,0,.12)] rounded-[9px] px-[13px] py-[10px] text-body font-archivo text-[13.5px] outline-none focus:border-rose-500 disabled:opacity-50" />
              </div>
              <div>
                <label className="text-[11.5px] font-semibold text-sub block mb-[6px]">Account type</label>
                <div className="grid grid-cols-2 gap-2">
                  {(['staff', 'admin'] as const).filter(r => r === 'staff' || currentUser?.role === 'admin' || userModal.draft.role === 'admin').map(r => {
                    const on = userModal.draft.role === r;
                    return (
                      <button key={r} onClick={() => setUserField('role', r)}
                        className="rounded-[9px] px-3 py-[10px] text-[12.5px] font-extrabold border cursor-pointer transition-colors text-left"
                        style={{ background: on ? 'rgba(219,87,149,.08)' : 'transparent', color: on ? '#600a32' : '#705260', borderColor: on ? 'rgba(219,87,149,.45)' : 'rgba(0,0,0,.12)' }}>
                        {r === 'admin' ? 'Admin — full access' : 'Staff — set access below'}
                      </button>
                    );
                  })}
                </div>
              </div>
              {userModal.draft.role === 'staff' && (
                <div>
                  <label className="text-[11.5px] font-semibold text-sub block mb-[6px]">Module access</label>
                  <div className="border border-[rgba(0,0,0,.1)] rounded-[10px] overflow-hidden">
                    {(['Core', 'Point of Sale', 'Settings'] as const).map(group => (
                      <div key={group}>
                        <div className="px-3 py-[7px] bg-[rgba(0,0,0,.05)] text-[10.5px] font-extrabold uppercase tracking-[.06em] text-muted border-b border-[rgba(0,0,0,.08)]">{group}</div>
                        {MODULES.filter(m => m.group === group).map(m => {
                          const level: 'none' | 'read' | 'edit' = (userModal.draft.permissions?.[m.key]) ?? 'none';
                          return (
                            <div key={m.key} className="flex items-center justify-between gap-3 px-3 py-[7px] border-b border-[rgba(0,0,0,.07)] last:border-0">
                              <span className="text-[12.5px] text-sub">{m.label}</span>
                              <div className="flex gap-[4px] flex-none">
                                {(['none', 'read', 'edit'] as const).map(opt => {
                                  const on = level === opt;
                                  return (
                                    <button key={opt} onClick={() => setUserPermission(m.key, opt)}
                                      className="text-[10.5px] font-bold px-[9px] py-[4px] rounded-[6px] cursor-pointer capitalize transition-all"
                                      style={{ border: on ? 'none' : '1px solid rgba(0,0,0,.1)', background: on ? (opt === 'edit' ? '#db5795' : opt === 'read' ? 'rgba(0,0,0,.16)' : 'transparent') : 'transparent', color: on ? (opt === 'edit' ? '#200612' : '#150d11') : '#907481' }}>
                                      {opt === 'none' ? '—' : opt}
                                    </button>
                                  );
                                })}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ))}
                  </div>
                </div>
              )}
              <div>
                <label className="text-[11.5px] font-semibold text-sub block mb-[6px]">{userModal.id ? 'New password' : 'Password'} {userModal.id && <span className="text-muted font-normal">(leave blank to keep current)</span>}</label>
                <input type="password" value={userModal.draft.password ?? ''} onChange={e => setUserField('password', e.target.value)} placeholder={userModal.id ? 'New password…' : 'Min 8 characters'}
                  className="w-full bg-well border border-[rgba(0,0,0,.12)] rounded-[9px] px-[13px] py-[10px] text-body font-archivo text-[13.5px] outline-none focus:border-rose-500" />
              </div>
            </div>
            {userModal.error && <div className="text-[12px] text-[#e81a2b] mt-[14px] flex-none">{userModal.error}</div>}
            <div className="flex gap-[11px] mt-[22px] flex-none">
              <button onClick={saveUser} disabled={saving} className="flex-1 border-none bg-rose-500 text-[#200612] font-extrabold text-[14px] py-[13px] rounded-xl cursor-pointer disabled:opacity-60">{saving ? 'Saving…' : userModal.id ? 'Save changes' : 'Create user'}</button>
              <button onClick={() => setUserModal(null)} className="border border-[rgba(0,0,0,.16)] bg-transparent text-body font-bold text-[14px] px-[22px] py-[13px] rounded-xl cursor-pointer">Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* ── ORDER DETAIL DRAWER ── */}
      {orderDrawer && (
        <div className="fixed inset-0 z-[85] flex animate-fade-in" onClick={() => setOrderDrawer(null)}>
          <div className="flex-1 bg-[rgba(4,8,7,.6)] backdrop-blur-sm" />
          <div className="w-full max-w-[520px] bg-surface border-l border-[rgba(0,0,0,.1)] flex flex-col h-full overflow-y-auto animate-slide-right" onClick={e => e.stopPropagation()}>
            {(() => {
              const origin = orderOriginMeta(orderDrawer);
              return (
            <div className="flex items-start justify-between p-5 border-b border-[rgba(0,0,0,.08)] flex-none">
              <div>
                <div className="font-bold text-[18px] text-rose-700">{orderDrawer.id}</div>
                <div className="text-[12px] text-muted mt-[3px]">{[orderDrawer.date, orderDrawer.method, orderDrawer.locationName].filter(Boolean).join(' · ')}</div>
                <div className="flex items-center gap-2 mt-2">
                  <span className="text-[9px] font-extrabold uppercase border px-[7px] py-[2px] rounded-full" style={{ color: origin.tone, background: origin.bg, borderColor: origin.border }}>{origin.label}</span>
                  {orderDrawer.quoteRef && <span className="text-[9px] font-extrabold text-[#8a6205] bg-[rgba(245,200,66,.1)] border border-[rgba(245,200,66,.25)] px-[7px] py-[2px] rounded-full">from {orderDrawer.quoteRef}</span>}
                  <span className="text-[9px] font-extrabold uppercase px-[7px] py-[2px] rounded-full" style={{ color: STAGE_META[Math.min(orderDrawer.stage, STAGE_META.length - 1)].fg, background: STAGE_META[Math.min(orderDrawer.stage, STAGE_META.length - 1)].bg }}>{ORDER_STAGES[orderDrawer.stage] ?? 'Unknown'}</span>
                  <span className="text-[9px] font-extrabold uppercase px-[7px] py-[2px] rounded-full" style={{ background: orderDrawer.paid ? 'rgba(219,87,149,.1)' : 'rgba(255,61,77,.1)', color: orderDrawer.paid ? '#600a32' : '#e81a2b' }}>{orderDrawer.paid ? 'Paid' : 'Unpaid'}</span>
                </div>
              </div>
              <button onClick={() => setOrderDrawer(null)} className="border-none bg-transparent text-muted text-[22px] cursor-pointer flex-none"><X size={22} /></button>
            </div>
              );
            })()}

            <div className="p-5 flex flex-col gap-5 flex-1">
              {/* Customer */}
              <div>
                <div className="text-[11px] font-extrabold uppercase tracking-[.07em] text-muted mb-3">Customer</div>
                <div className="bg-well border border-[rgba(0,0,0,.07)] rounded-[12px] p-4 grid grid-cols-2 gap-3">
                  <div><div className="text-[10.5px] text-muted mb-[3px]">Name</div><div className="text-[13px] font-semibold">{orderDrawer.customer}</div></div>
                  <div><div className="text-[10.5px] text-muted mb-[3px]">Email</div><div className="text-[13px] font-semibold break-all">{orderDrawer.email || '—'}</div></div>
                  {orderDrawer.mobile && <div><div className="text-[10.5px] text-muted mb-[3px]">Mobile</div><div className="text-[13px] font-semibold">{orderDrawer.mobile}</div></div>}
                  {orderDrawer.address && <div className="col-span-2"><div className="text-[10.5px] text-muted mb-[3px]">Address</div><div className="text-[13px]">{orderDrawer.address}</div></div>}
                  {orderDrawer.notes && <div className="col-span-2"><div className="text-[10.5px] text-muted mb-[3px]">Notes</div><div className="text-[12.5px] text-sub leading-[1.5]">{orderDrawer.notes}</div></div>}
                </div>
              </div>

              {/* Items */}
              <div>
                <div className="text-[11px] font-extrabold uppercase tracking-[.07em] text-muted mb-3">Items</div>
                {orderDrawer.lineItems && orderDrawer.lineItems.length > 0 ? (
                  <div className="bg-well border border-[rgba(0,0,0,.07)] rounded-[12px] overflow-hidden">
                    {orderDrawer.lineItems.map((li) => (
                      <div key={li.id} className="flex items-center gap-3 px-4 py-3 border-b border-[rgba(0,0,0,.07)] last:border-0">
                        <span className="w-8 h-8 rounded-[7px] flex-none" style={{ background: li.img }} />
                        <div className="flex-1 min-w-0">
                          <div className="text-[12.5px] font-semibold">{li.name}</div>
                              <div className="text-[11px] text-muted">{[li.size, li.color].filter(Boolean).join(' · ') || li.meta || '—'}</div>
                        </div>
                        <div className="text-right flex-none">
                          <div className="text-[12.5px] font-bold tabular">MVR {(li.price * li.qty).toLocaleString()}</div>
                          <div className="text-[11px] text-muted">×{li.qty} @ {li.price.toLocaleString()}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="bg-well border border-[rgba(0,0,0,.07)] rounded-[12px] p-4 text-[12.5px] text-sub">{orderDrawer.items}</div>
                )}
              </div>

              {/* Payment */}
              <div>
                <div className="text-[11px] font-extrabold uppercase tracking-[.07em] text-muted mb-3">Payment</div>
                <div className="bg-well border border-[rgba(0,0,0,.07)] rounded-[12px] p-4">
                  {(orderDrawer.discount ?? 0) > 0 && (
                    <>
                      <div className="flex justify-between text-[12.5px] mb-2"><span className="text-sub">Subtotal</span><span className="tabular">MVR {(orderDrawer.subtotal ?? orderDrawer.total + (orderDrawer.discount ?? 0)).toLocaleString()}</span></div>
                      {(orderDrawer.deliveryFee ?? 0) > 0 && <div className="flex justify-between text-[12.5px] mb-2"><span className="text-sub">Delivery{orderDrawer.deliveryAreaName ? ` · ${orderDrawer.deliveryAreaName}` : ''}</span><span className="tabular">MVR {(orderDrawer.deliveryFee ?? 0).toLocaleString()}</span></div>}
                      <div className="flex justify-between text-[12.5px] mb-2"><span className="text-[#e81a2b]">Discount</span><span className="tabular text-[#e81a2b]">−MVR {(orderDrawer.discount ?? 0).toLocaleString()}</span></div>
                    </>
                  )}
                  {(orderDrawer.discount ?? 0) === 0 && (orderDrawer.deliveryFee ?? 0) > 0 && (
                    <>
                      <div className="flex justify-between text-[12.5px] mb-2"><span className="text-sub">Subtotal</span><span className="tabular">MVR {(orderDrawer.subtotal ?? orderDrawer.total - (orderDrawer.deliveryFee ?? 0)).toLocaleString()}</span></div>
                      <div className="flex justify-between text-[12.5px] mb-2"><span className="text-sub">Delivery{orderDrawer.deliveryAreaName ? ` · ${orderDrawer.deliveryAreaName}` : ''}</span><span className="tabular">MVR {(orderDrawer.deliveryFee ?? 0).toLocaleString()}</span></div>
                    </>
                  )}
                  <div className="flex justify-between font-bold mb-3"><span>Total</span><span className="tabular text-rose-600">MVR {orderDrawer.total.toLocaleString()}</span></div>
                  <div className="h-px bg-[rgba(0,0,0,.08)] mb-3" />
                  {orderDrawer.paidCash > 0 && <div className="flex justify-between text-[12px] text-sub mb-1"><span>Cash</span><span className="tabular">MVR {orderDrawer.paidCash.toLocaleString()}</span></div>}
                  {orderDrawer.paidCard > 0 && <div className="flex justify-between text-[12px] text-sub mb-1"><span>Card</span><span className="tabular">MVR {orderDrawer.paidCard.toLocaleString()}</span></div>}
                  {orderDrawer.paidTransfer > 0 && <div className="flex justify-between text-[12px] text-sub mb-1"><span>Bank transfer</span><span className="tabular">MVR {orderDrawer.paidTransfer.toLocaleString()}</span></div>}
                  {(orderDrawer.paidCash === 0 && orderDrawer.paidCard === 0 && orderDrawer.paidTransfer === 0) && <div className="text-[12px] text-muted">No payment recorded.</div>}
                  {orderDrawer.discountNote && <div className="mt-2 text-[11.5px] text-muted">Discount note: {orderDrawer.discountNote}</div>}
                </div>
              </div>

              {/* Links */}
              <div className="flex items-center gap-3 flex-wrap">
                {orderDrawer.pdfUrl && <a href={orderDrawer.pdfUrl} target="_blank" rel="noopener noreferrer" className="text-[12px] font-bold text-rose-700 border border-[rgba(219,87,149,.3)] bg-[rgba(219,87,149,.06)] px-4 py-[8px] rounded-[9px] no-underline hover:brightness-125 transition-all">↓ Invoice PDF</a>}
                {paymentSlip(orderDrawer) && (
                  <button onClick={() => setSlipModal({ url: paymentSlip(orderDrawer)!.url, expired: paymentSlip(orderDrawer)!.expired })}
                    title={paymentSlip(orderDrawer)!.expired ? 'Payment slip expired (auto-deleted after 90 days)' : undefined}
                    className={`text-[12px] font-bold border px-4 py-[8px] rounded-[9px] bg-transparent cursor-pointer transition-colors ${paymentSlip(orderDrawer)!.expired ? 'border-[rgba(0,0,0,.1)] text-[rgba(0,0,0,.3)]' : 'border-[rgba(0,0,0,.14)] text-sub hover:text-body'}`}>
                    Payment slip
                  </button>
                )}
                {paymentReceipt(orderDrawer) && (
                  <a href={paymentReceipt(orderDrawer)!.url} target="_blank" rel="noopener noreferrer" className="text-[12px] font-bold text-rose-700 border border-[rgba(219,87,149,.3)] bg-[rgba(219,87,149,.06)] px-4 py-[8px] rounded-[9px] no-underline hover:brightness-125 transition-all">↓ Receipt PDF</a>
                )}
                {orderDrawer.paid && !paymentReceipt(orderDrawer) && (
                  <button onClick={() => generateOrderReceipt(orderDrawer.id)} className="text-[12px] font-bold text-rose-700 border border-[rgba(219,87,149,.3)] bg-transparent px-4 py-[8px] rounded-[9px] cursor-pointer hover:bg-[rgba(219,87,149,.06)] transition-all">Generate receipt</button>
                )}
              </div>

              {/* Actions */}
              <div className="flex items-center gap-3 pt-2 border-t border-[rgba(0,0,0,.07)]">
                <button onClick={() => togglePaid(orderDrawer.id)}
                  className="font-bold text-[12px] px-4 py-[9px] rounded-[8px] cursor-pointer border transition-colors"
                  style={{ background: orderDrawer.paid ? '#db5795' : 'rgba(255,61,77,.12)', color: orderDrawer.paid ? '#200612' : '#ff6370', border: orderDrawer.paid ? 'none' : '1px solid rgba(255,61,77,.35)' }}>
                  {orderDrawer.paid ? <><Check size={12} className="inline mr-1" /> Mark Unpaid</> : 'Mark Paid'}
                </button>
                {orderDrawer.origin === 'pos_sale' ? (
                  <span className="text-[11px] font-extrabold uppercase px-3 py-[9px] rounded-[8px] border border-[rgba(219,87,149,.25)] text-rose-600 bg-[rgba(219,87,149,.07)]">Completed POS sale</span>
                ) : (
                  <select value={orderDrawer.stage} onChange={e => setOrderStage(orderDrawer.id, +e.target.value)}
                    className="bg-well border rounded-[8px] px-3 py-[9px] font-bold text-[12px] outline-none cursor-pointer"
                    style={{ borderColor: STAGE_META[Math.min(orderDrawer.stage, STAGE_META.length - 1)].fg, color: STAGE_META[Math.min(orderDrawer.stage, STAGE_META.length - 1)].fg }}>
                    {stageOptionsFor(orderDrawer).map(st => <option key={st.value} value={st.value}>{st.label}</option>)}
                  </select>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── MANUAL ORDER MODAL ── */}
      {manualOrderModal && (
        <div className="fixed inset-0 z-[86] bg-[rgba(4,8,7,.8)] backdrop-blur-md flex items-center justify-center p-4" onClick={() => setManualOrderModal(false)}>
          <div className="w-[540px] max-w-full max-h-[92vh] overflow-y-auto bg-surface border border-[rgba(219,87,149,.22)] rounded-[20px] p-6" onClick={e => e.stopPropagation()}>
            <div className="flex items-start justify-between mb-5">
              <div><div className="font-bold text-[20px]">Manual Order</div><div className="text-[12px] text-muted mt-1">Create a product-backed order from store inventory.</div></div>
              <button onClick={() => setManualOrderModal(false)} className="border-none bg-transparent text-muted text-[22px] cursor-pointer"><X size={22} /></button>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {[['customer','Customer *','text',2],['mobile','Mobile *','tel',1],['email','Email','email',1]].map(([k,lbl,t,span]) => (
                <div key={k} className={`col-span-${span}`}>
                  <label className="text-[11.5px] font-semibold text-sub block mb-[5px]">{String(lbl)}</label>
                  <input type={String(t)} value={(manualOrderDraft as any)[k]} onChange={e => setManualOrderDraft(d => ({ ...d, [k]: e.target.value }))}
                    className="w-full bg-well border border-[rgba(0,0,0,.12)] rounded-[9px] px-3 py-[9px] text-[13.5px] outline-none focus:border-rose-500" />
                </div>
              ))}
              <div className="col-span-2">
                <label className="text-[11.5px] font-semibold text-sub block mb-[5px]">Stock location *</label>
                <select value={manualOrderDraft.locationId} onChange={e => { setManualOrderDraft(d => ({ ...d, locationId: e.target.value })); setManualOrderLines([]); setManualOrderProductId(''); }}
                  className="w-full bg-well border border-[rgba(0,0,0,.12)] rounded-[9px] px-3 py-[9px] text-[13.5px] outline-none cursor-pointer">
                  <option value="">Select location…</option>
                  {data.locations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
                </select>
              </div>
              <div className="col-span-2 bg-well border border-[rgba(0,0,0,.08)] rounded-[12px] p-3">
                <div className="text-[11px] font-extrabold uppercase tracking-[.07em] text-muted mb-3">Add product</div>
                <div className="grid grid-cols-2 gap-2">
                  <select value={manualOrderProductId} onChange={e => setManualOrderProductId(e.target.value)}
                    disabled={!manualOrderDraft.locationId}
                    className="col-span-2 bg-surface border border-[rgba(0,0,0,.12)] rounded-[8px] px-3 py-[8px] text-[12.5px] outline-none cursor-pointer disabled:opacity-50">
                    <option value="">Choose product…</option>
                    {allProducts.filter(p => p.status === 'active').map(p => <option key={p.id} value={p.id}>{p.name} · {formatMVR(p.price)}</option>)}
                  </select>
                  {manualOrderProduct && manualOrderProduct.colors.length > 0 && (
                    <select value={manualOrderColor} onChange={e => { setManualOrderColor(e.target.value); setManualOrderSize(firstAvailableSize(manualOrderInvRows, manualOrderProduct, e.target.value)); }}
                      className="bg-surface border border-[rgba(0,0,0,.12)] rounded-[8px] px-3 py-[8px] text-[12.5px] outline-none cursor-pointer">
                      {manualOrderProduct.colors.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  )}
                  {manualOrderProduct && manualOrderProduct.sizes.length > 0 && (
                    <select value={manualOrderSize} onChange={e => setManualOrderSize(e.target.value)}
                      className="bg-surface border border-[rgba(0,0,0,.12)] rounded-[8px] px-3 py-[8px] text-[12.5px] outline-none cursor-pointer">
                      {manualOrderProduct.sizes.map(s => {
                        const available = inventoryStockForVariant(manualOrderInvRows, manualOrderProduct.id, manualOrderColor, s);
                        return <option key={s} value={s} disabled={available <= 0}>{s}{available <= 0 ? ' (sold out)' : ` (${available})`}</option>;
                      })}
                    </select>
                  )}
                  <div className="flex items-center gap-2">
                    <input type="number" min="1" value={manualOrderQty} onChange={e => setManualOrderQty(Math.max(1, parseInt(e.target.value) || 1))}
                      className="w-20 bg-surface border border-[rgba(0,0,0,.12)] rounded-[8px] px-3 py-[8px] text-[12.5px] tabular outline-none focus:border-rose-500" />
                    <span className="text-[11px] text-muted">Available: {manualOrderProduct ? manualOrderAvailable : 0}</span>
                  </div>
                  <button type="button" onClick={addManualOrderLine} disabled={!manualOrderProduct || manualOrderAvailable <= 0 || manualOrderQty > manualOrderAvailable}
                    className="border-none bg-rose-500 text-[#200612] font-extrabold text-[12px] px-3 py-[8px] rounded-[8px] cursor-pointer disabled:opacity-50">Add product</button>
                </div>
              </div>
              <div className="col-span-2 flex flex-col gap-2">
                {manualOrderLines.map((item, i) => (
                  <div key={`${item.sku}-${i}`} className="flex items-center gap-3 bg-well border border-[rgba(0,0,0,.07)] rounded-[10px] p-3">
                    <span className="w-9 h-9 rounded-[7px] flex-none" style={{ background: item.img }} />
                    <div className="flex-1 min-w-0">
                      <div className="text-[12.5px] font-semibold truncate">{item.name}</div>
                      <div className="text-[11px] text-muted truncate">{[item.size, item.color].filter(Boolean).join(' · ') || item.meta}</div>
                    </div>
                    <span className="text-[12px] font-bold tabular">×{item.qty}</span>
                    <span className="text-[12px] font-bold tabular text-rose-600">{formatMVR(item.unitPrice * item.qty)}</span>
                    <button type="button" onClick={() => setManualOrderLines(lines => lines.filter((_, idx) => idx !== i))}
                      className="w-7 h-7 rounded-[7px] border border-[rgba(0,0,0,.1)] bg-transparent text-muted cursor-pointer hover:text-[#e81a2b]">×</button>
                  </div>
                ))}
                {manualOrderLines.length === 0 && <div className="text-[12px] text-muted text-center bg-well border border-[rgba(0,0,0,.08)] rounded-[10px] py-4">No products added yet.</div>}
              </div>
              <div>
                <label className="text-[11.5px] font-semibold text-sub block mb-[5px]">Discount (MVR)</label>
                <input type="number" min="0" value={manualOrderDraft.discount} onChange={e => setManualOrderDraft(d => ({ ...d, discount: e.target.value }))}
                  className="w-full bg-well border border-[rgba(0,0,0,.12)] rounded-[9px] px-3 py-[9px] text-[13.5px] tabular outline-none focus:border-rose-500" />
              </div>
              <div>
                <label className="text-[11.5px] font-semibold text-sub block mb-[5px]">Method</label>
                <select value={manualOrderDraft.method} onChange={e => setManualOrderDraft(d => ({ ...d, method: e.target.value as 'Pickup' | 'Delivery' }))}
                  className="w-full bg-well border border-[rgba(0,0,0,.12)] rounded-[9px] px-3 py-[9px] text-[13.5px] outline-none cursor-pointer">
                  <option value="Pickup">Pickup</option>
                  <option value="Delivery">Delivery</option>
                </select>
              </div>
              {manualOrderDraft.method === 'Delivery' && (
                <div className="col-span-2">
                  <label className="text-[11.5px] font-semibold text-sub block mb-[5px]">Delivery area</label>
                  <select value={manualOrderDraft.deliveryAreaId} onChange={e => setManualOrderDraft(d => ({ ...d, deliveryAreaId: e.target.value }))}
                    className="w-full bg-well border border-[rgba(0,0,0,.12)] rounded-[9px] px-3 py-[9px] text-[13.5px] outline-none cursor-pointer mb-2">
                    <option value="">Select area…</option>
                    {data.deliveryAreas.map(a => <option key={a.id} value={a.id}>{a.name} — {formatMVR(a.rate)}</option>)}
                  </select>
                  <label className="text-[11.5px] font-semibold text-sub block mb-[5px]">Delivery address</label>
                  <textarea value={manualOrderDraft.address} onChange={e => setManualOrderDraft(d => ({ ...d, address: e.target.value }))}
                    className="w-full h-[58px] resize-none bg-well border border-[rgba(0,0,0,.12)] rounded-[9px] px-3 py-[9px] text-[13.5px] outline-none focus:border-rose-500" />
                  <div className="text-[11px] text-muted mt-1">Delivery fee added to payment total: MVR {manualOrderDeliveryFee.toLocaleString()}</div>
                </div>
              )}
              <div>
                <label className="text-[11.5px] font-semibold text-sub block mb-[5px]">Discount note</label>
                <input value={manualOrderDraft.discountNote} onChange={e => setManualOrderDraft(d => ({ ...d, discountNote: e.target.value }))} placeholder="e.g. Loyalty discount"
                  className="w-full bg-well border border-[rgba(0,0,0,.12)] rounded-[9px] px-3 py-[9px] text-[13.5px] outline-none focus:border-rose-500" />
              </div>
              <div className="col-span-2 h-px bg-[rgba(0,0,0,.07)] my-1" />
              <div className="col-span-2 bg-well border border-[rgba(0,0,0,.07)] rounded-[10px] p-3 text-[12px]">
                <div className="flex justify-between mb-1"><span className="text-sub">Items subtotal</span><span className="tabular">{formatMVR(manualOrderSubtotal)}</span></div>
                {manualOrderDeliveryFee > 0 && <div className="flex justify-between mb-1"><span className="text-sub">Delivery</span><span className="tabular">{formatMVR(manualOrderDeliveryFee)}</span></div>}
                {manualOrderDiscount > 0 && <div className="flex justify-between mb-1"><span className="text-[#e81a2b]">Discount</span><span className="tabular text-[#e81a2b]">-{formatMVR(manualOrderDiscount)}</span></div>}
                <div className="flex justify-between font-bold"><span>Total</span><span className="tabular text-rose-600">{formatMVR(manualOrderTotal)}</span></div>
              </div>
              <div className="col-span-2 text-[12px] font-bold text-[#705260] mb-1">
                Payment received — total due {formatMVR(manualOrderTotal)}
                {manualOrderPaidTotal > 0 && <span className={manualOrderPaidTotal > manualOrderTotal ? 'text-[#e81a2b]' : manualOrderPaidTotal === manualOrderTotal ? 'text-rose-600' : 'text-[#8a6205]'}> · entered {formatMVR(manualOrderPaidTotal)}</span>}
              </div>
              {([['paidCash','Cash'],['paidCard','Card'],['paidTransfer','Bank Transfer']] as [keyof typeof manualOrderDraft, string][]).map(([k, lbl]) => (
                <div key={k}>
                  <label className="text-[11.5px] font-semibold text-sub block mb-[5px]">{lbl} (MVR)</label>
                  <input type="number" min="0" value={(manualOrderDraft as any)[k]} onChange={e => setManualOrderDraft(d => ({ ...d, [k]: e.target.value }))}
                    className="w-full bg-well border border-[rgba(0,0,0,.12)] rounded-[9px] px-3 py-[9px] text-[13.5px] tabular outline-none focus:border-rose-500" />
                </div>
              ))}
              <div className="col-span-2">
                <label className="text-[11.5px] font-semibold text-sub block mb-[5px]">Notes (optional)</label>
                <input value={manualOrderDraft.notes} onChange={e => setManualOrderDraft(d => ({ ...d, notes: e.target.value }))}
                  className="w-full bg-well border border-[rgba(0,0,0,.12)] rounded-[9px] px-3 py-[9px] text-[13.5px] outline-none focus:border-rose-500" />
              </div>
            </div>
            {manualOrderError && <div className="text-[12px] text-[#e81a2b] mt-3">{manualOrderError}</div>}
            <div className="flex gap-3 mt-5">
              <button onClick={submitManualOrder} disabled={manualOrderSaving} className="flex-1 border-none bg-rose-500 text-[#200612] font-extrabold text-[14px] py-[12px] rounded-xl cursor-pointer disabled:opacity-50">{manualOrderSaving ? 'Creating…' : 'Create Order'}</button>
              <button onClick={() => setManualOrderModal(false)} className="border border-[rgba(0,0,0,.16)] bg-transparent text-body font-bold text-[14px] px-[20px] py-[12px] rounded-xl cursor-pointer">Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* ── TOAST ── */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-[90] flex items-center gap-3 bg-[#200c15] border border-[rgba(219,87,149,.35)] rounded-xl px-[17px] py-[13px] shadow-[0_14px_44px_rgba(0,0,0,.55)] animate-fade-up">
          <span className="w-6 h-6 rounded-full bg-rose-500 text-[#200612] inline-flex items-center justify-center text-[14px] font-black"><Check size={14} /></span>
          <span className="text-[13px] font-semibold text-[#ffe9f3]">{toast}</span>
        </div>
      )}
    </div>
  );
}
