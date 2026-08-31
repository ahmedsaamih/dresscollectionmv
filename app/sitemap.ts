import type { MetadataRoute } from 'next';
import { getCatalog } from '@/lib/catalog';
import { SITE_URL } from '@/lib/site';
import { COLLECTION_PATHS } from '@/lib/collection-paths';

// Server-rendered per request (backed by getCatalog()'s own cache) rather
// than statically generated at build time — this sandbox/build has no
// DATABASE_URL available during `next build`'s static-generation phase,
// matching every other DB-backed route in this app.
export const dynamic = 'force-dynamic';

const STATIC_ROUTES: Array<{
  path: string;
  changeFrequency: NonNullable<MetadataRoute.Sitemap[number]['changeFrequency']>;
  priority: number;
}> = [
  { path: '/', changeFrequency: 'daily', priority: 1 },
  { path: '/ready-made', changeFrequency: 'daily', priority: 0.9 },
  { path: '/casual-wear', changeFrequency: 'daily', priority: 0.9 },
  { path: '/accessories', changeFrequency: 'daily', priority: 0.9 },
  { path: '/reviews', changeFrequency: 'weekly', priority: 0.5 },
  { path: '/about', changeFrequency: 'monthly', priority: 0.5 },
  { path: '/contact', changeFrequency: 'monthly', priority: 0.5 },
  { path: '/shipping', changeFrequency: 'monthly', priority: 0.4 },
  { path: '/size-guide', changeFrequency: 'monthly', priority: 0.4 },
  { path: '/faq', changeFrequency: 'monthly', priority: 0.4 },
  { path: '/terms', changeFrequency: 'yearly', priority: 0.2 },
  { path: '/privacy', changeFrequency: 'yearly', priority: 0.2 },
];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const { products, collections } = await getCatalog();

  const staticEntries: MetadataRoute.Sitemap = STATIC_ROUTES.map((r) => ({
    url: `${SITE_URL}${r.path}`,
    changeFrequency: r.changeFrequency,
    priority: r.priority,
  }));

  const collectionEntries: MetadataRoute.Sitemap = collections
    .filter((c) => !COLLECTION_PATHS[c.key])
    .map((c) => ({
      url: `${SITE_URL}/${c.key}`,
      changeFrequency: 'daily',
      priority: 0.8,
    }));

  const productEntries: MetadataRoute.Sitemap = products.map((p) => ({
    url: `${SITE_URL}/product/${p.id}`,
    changeFrequency: 'weekly',
    priority: 0.7,
  }));

  return [...staticEntries, ...collectionEntries, ...productEntries];
}
