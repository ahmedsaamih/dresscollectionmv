# Dress Collection — Storefront

> **Tech stack:** Next.js (App Router) · TypeScript · Tailwind CSS · Prisma (PostgreSQL) · GSAP

Dress Collection is an online-only womenswear boutique — no physical store, delivery across the Maldives. Customers browse New Arrivals, Casual Dresses, Party & Occasion and Accessories, add to cart, and check out with guest checkout (manual bank-transfer payment). A full CMS admin panel manages catalog, inventory, orders and settings.

---

## Quick start

```bash
npm install
cp .env.example .env        # fill in DATABASE_URL and friends
npm run db:migrate          # apply the Prisma schema
npm run db:seed             # seed demo catalog + an admin user
npm run dev
# → http://localhost:3000
```

> Requires **Node 22+**.

---

## Project structure

```
app/                    Next.js App Router pages
  page.tsx              Home
  ready-made/            New Arrivals catalog
  casual-wear/           Casual Dresses catalog
  accessories/           Accessories catalog
  [collection]/          Generic catalog page for any other collection (e.g. Party & Occasion)
  product/[id]/           Product detail (dynamic)
  cart/                  Cart
  checkout/              Manual-payment (bank transfer) checkout — delivery only
  status/                Order status tracker (no login)
  about/ contact/ faq/ size-guide/ shipping/ terms/ privacy/
  admin/                 Full CMS admin panel
  api/                   Route handlers (storefront + /api/admin/*)

components/
  Header.tsx             Sticky nav, live cart badge, search
  Footer.tsx             Data-driven footer
  Toast.tsx               Add-to-cart micro-interaction

contexts/
  CartContext.tsx         Global cart state
  StoreContext.tsx        Global store/catalog state (backed by /api/store)

lib/
  types.ts                All TypeScript interfaces
  store.ts                 Client-side seed/fallback data (mirrors prisma/seed.ts)
  utils.ts                 formatMVR, COLOR_MAP, ORDER_STAGES, etc.
  ref.ts                   createOrderWithRef — generates order reference codes

prisma/
  schema.prisma            Database schema
  seed.ts                   Demo data seed script

public/
  logo-icon.png             Square brand mark (header/footer/favicon source)
  logo-full.png             Full logo lockup with wordmark
```

---

## Key design decisions

### No card payments
Checkout produces an **order reference** (a random 5-character code, e.g. `K7B4X`). Customers pay by bank transfer only — no payment gateway is wired, no card details are ever collected. The admin panel marks orders as paid once a transfer is verified.

### Delivery only
Dress Collection has no physical storefront. The checkout flow only offers delivery, priced per delivery area (`DeliveryArea` rates, admin-managed). Pickup as a fulfillment method still exists for POS and admin-created manual orders.

### Admin panel — `/admin`
Full CRUD for: Collections, Categories, Products, Inventory, Orders, Promo codes, Reviews, Settings.

---

## Fonts

Archivo and Archivo Narrow are loaded via `next/font/google` in `app/layout.tsx` and exposed as CSS variables:

```css
--font-archivo
--font-archivo-narrow
```

Tailwind classes: `font-archivo`, `font-archivo-narrow`.

---

## Colour tokens (Tailwind)

| Token | Value | Usage |
|---|---|---|
| `rose-500` | `#DB5795` | Primary CTA, prices, focus |
| `rose-400` | `#E63387` | Accents |
| `rose-600` | `#8A1D50` | Muted rose |
| `rose-700` | `#600A32` | Deep rose (links) |
| `rose-800` | `#36021A` | Darkest rose |
| `charcoal-*` | — | Neutral text/surface scale |
| `page` | `#ffffff` | App background |
| `surface` | `#F9F6F7` | Cards |
| `well` | `#F9E8F0` | Inputs, inner wells |
| `body` | `#150D11` | Primary text |
| `sub` | `#705260` | Secondary text |
| `muted` | `#907481` | Tertiary text |
| `primary` | `#DB5795` | Alias for rose-500 |
| `coral-500` | `#FF3D4D` | Sale / error / destructive |

Shadow utilities: `shadow-rose-glow`, `shadow-rose-sm`, `shadow-rose-lg`.
Tabular numerals: `tabular` (maps to `font-variant-numeric: tabular-nums`).

---

## GSAP

GSAP is installed (`gsap`). The Home page (`app/page.tsx`) dynamically imports it for hero reveal / scroll entrance animation, guarded by `prefers-reduced-motion`.

---

## Reference numbers

| Type | Format | Example |
|---|---|---|
| Order | 5-character code | `K7B4X` |

Generated server-side via `createOrderWithRef()` in `lib/ref.ts` — a random code from an unambiguous charset (no `0`/`O`/`1`/`I`/`L`), with the order-creation transaction retried on the rare id collision.

---

## Build & lint

```bash
npm run build     # production build
npm run lint      # ESLint
```
