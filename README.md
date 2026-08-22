# Dress Collection — Storefront

> **Tech stack:** Next.js (App Router) · TypeScript · Tailwind CSS · Prisma (PostgreSQL) · shadcn/ui (Radix primitives) · GSAP

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

### Google Drive artwork uploads

Customer uploads (payment slips, etc.) can optionally be routed to a Google Drive folder. This uses **OAuth user delegation** (not a service account) — uploads are made as a real Google account you authorize, since service accounts have no storage quota of their own and can't write files into a personal (non-Workspace) Drive folder.

1. In [Google Cloud Console](https://console.cloud.google.com/apis/credentials), create an **OAuth client ID** of type "Web application".
2. Add an authorized redirect URI: `<APP_URL>/api/admin/settings/google-drive/oauth/callback` (e.g. `http://localhost:3000/api/admin/settings/google-drive/oauth/callback` in dev).
3. Set these in deployment secrets:
   ```bash
   GOOGLE_OAUTH_CLIENT_ID="xxxx.apps.googleusercontent.com"
   GOOGLE_OAUTH_CLIENT_SECRET="xxxx"
   ```
4. In Admin → Settings → Google Drive uploads, click **Connect Google Drive** and approve access with the Google account that owns the destination folder.
5. Paste the destination folder's URL or ID and use the **Test** button to verify it's writable.

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
  utils.ts                 formatMVR, genRef, COLOR_MAP, ORDER_STAGES, etc.

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
Checkout produces an **order reference** (`DC-YY-NNNNN`). Customers pay by bank transfer only — no payment gateway is wired, no card details are ever collected. The admin panel marks orders as paid once a transfer is verified.

### Delivery only
Dress Collection has no physical storefront. `settings.pickupEnabled` is `false` and the checkout flow only offers delivery, priced per delivery area.

### Admin panel — `/admin`
Full CRUD for: Collections, Categories, Products, Inventory, Orders, Promo codes, Reviews, Settings. The admin panel also retains a legacy Builder/Quote back office (kept for internal flexibility) even though the customer-facing storefront no longer exposes a custom-order flow.

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
| Order | `DC-YY-NNNNN` | `DC-26-48213` |
| Quote (admin-only) | `QT-YY-NNNNN` | `QT-26-10293` |

Generated server-side, sequentially, via `nextRef('DC' | 'QT')` in `lib/ref.ts`.

---

## Build & lint

```bash
npm run build     # production build
npm run lint      # ESLint
```
