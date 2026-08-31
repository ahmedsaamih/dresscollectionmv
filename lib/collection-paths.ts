// Collection keys that have a dedicated, friendlier static route instead of
// the generic /[collection] page. Anything not listed here falls back to
// /<key> — this is the single source of truth (previously duplicated across
// app/sitemap.ts and app/product/[id]/ProductDetailClient.tsx).
export const COLLECTION_PATHS: Record<string, string> = {
  ready: '/ready-made',
  casual: '/casual-wear',
  accessories: '/accessories',
};

export const collectionHref = (key: string) => COLLECTION_PATHS[key] ?? `/${key}`;
