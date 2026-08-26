import type { MetadataRoute } from 'next';
import { SITE_URL } from '@/lib/site';

/**
 * /admin and /api are never public content. /cart, /checkout and /status are
 * session/lookup-specific pages with nothing to rank on. /search results are
 * thin, query-string-driven duplicates of the collection pages that already
 * carry their own indexable URLs. /review is a token-gated submission form
 * with no content without a valid link.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/admin', '/api', '/cart', '/checkout', '/status', '/search', '/review'],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
