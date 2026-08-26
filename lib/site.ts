/**
 * Canonical absolute site URL — same env var/fallback convention already
 * used by lib/notify/templates.ts and lib/reviews.ts for building absolute
 * links. Shared here for the SEO surface (sitemap, robots, metadataBase).
 */
export const SITE_URL = (process.env.APP_URL || 'http://localhost:3000').replace(/\/+$/, '');
