// Media storage moved off Vercel Blob to Cloudflare R2 (production image/PDF/receipt
// storage). R2's public hostname is only known at runtime via R2_PUBLIC_BASE_URL, so
// derive it here for both the next/image allowlist and the CSP below.
const r2Hostname = (() => {
  try {
    return process.env.R2_PUBLIC_BASE_URL ? new URL(process.env.R2_PUBLIC_BASE_URL).hostname : null;
  } catch {
    return null;
  }
})();

/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    // Works around a Vercel builder race: the build-dist-dir lock file
    // (default in Next 16.2.x) gets unlinked by a worker-thread exit
    // handler before Vercel's output tracing lstat's it, causing
    // "ENOENT: lstat '.next/lock'" to fail every deploy.
    lockDistDir: false,
  },
  // The two slip-receiving routes run Tesseract.js server-side (lib/slip-ocr.ts). In Node,
  // tesseract.js spawns its own worker_threads Worker pointing at a `path.join(__dirname, ...)`
  // script — a runtime-constructed path, not a `require()`/`import` — so Next's build-time file
  // tracer can't follow it, and everything that worker script itself requires (its core/wasm
  // files, wasm-feature-detect, ...) is invisible to the tracer too. Confirmed by inspecting
  // the actual .next/server/**/*.nft.json trace after a build: none of it was included without
  // this. Self-hosted trained-data file included for the same runtime-path reason.
  outputFileTracingIncludes: {
    '/api/checkout': [
      './public/tesseract/lang-data/**',
      './node_modules/tesseract.js/**',
      './node_modules/tesseract.js-core/**',
      './node_modules/wasm-feature-detect/**',
    ],
    '/api/orders/[id]/receipts': [
      './public/tesseract/lang-data/**',
      './node_modules/tesseract.js/**',
      './node_modules/tesseract.js-core/**',
      './node_modules/wasm-feature-detect/**',
    ],
  },
  images: {
    remotePatterns: [
      // Vercel Blob — still the active storage backend in production until
      // STORAGE_DRIVER is explicitly flipped to `r2`; kept unconditionally
      // so images don't break mid-migration.
      { protocol: 'https', hostname: '*.public.blob.vercel-storage.com' },
      ...(r2Hostname ? [{ protocol: 'https', hostname: r2Hostname }] : []),
    ],
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
          { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
          {
            key: 'Content-Security-Policy',
            value:
              // 'unsafe-inline' is required here: Next.js App Router streams
              // RSC hydration data via inline `self.__next_f.push(...)`
              // script tags on every page, and without it (or a nonce, which
              // would need per-request wiring through proxy.ts) the browser
              // blocks them outright and the app never hydrates — the whole
              // client-side app (admin menu, client-fetched content) goes
              // dead while server-rendered HTML still looks fine over curl.
              // style-src also needs 'unsafe-inline': Radix's Dialog/Toast
              // components pull in react-remove-scroll-bar, which injects a
              // <style> tag at runtime to lock body scroll. Same nonce
              // trade-off as script-src above.
              "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; object-src 'none'; base-uri 'self'; " +
              // Vercel Blob (*.public.blob.vercel-storage.com) is kept
              // unconditionally alongside R2 — it's still production's
              // active image backend until STORAGE_DRIVER is deliberately
              // switched to `r2`, so dropping it here would break every
              // existing product/hero/workshop image on deploy.
              `img-src 'self' data: blob: https://*.public.blob.vercel-storage.com${r2Hostname ? ` https://${r2Hostname}` : ''}; ` +
              `connect-src 'self' blob:${r2Hostname ? ` https://${r2Hostname}` : ''}; ` +
              `frame-src 'self' https://*.public.blob.vercel-storage.com${r2Hostname ? ` https://${r2Hostname}` : ''} https://www.openstreetmap.org; ` +
              "frame-ancestors 'none'",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
