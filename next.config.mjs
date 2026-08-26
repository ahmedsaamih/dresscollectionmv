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
  // tesseract.js spawns its Node worker via `path.join(__dirname, ...)` computed inside its own
  // package — webpack (this project's `next build --webpack`) bundles route code into a single
  // chunk and rewrites `__dirname` to reflect that bundle's location instead of the package's
  // real one, so the computed worker-script path is wrong at runtime ("Cannot find module
  // '/var/task/.next/worker-script/node/index.js'", confirmed via a live Vercel deployment's
  // runtime logs). Excluding it from bundling leaves its own require()/__dirname logic intact,
  // resolved normally against the real node_modules at runtime.
  serverExternalPackages: ['tesseract.js', 'tesseract.js-core', 'wasm-feature-detect'],
  // The two slip-receiving routes run Tesseract.js server-side (lib/slip-ocr.ts). Even as an
  // external package, its worker-thread script path and self-hosted trained-data file are still
  // runtime-constructed strings, not `require()`/`import` — Next's build-time file tracer can't
  // follow those, so everything they need (core/wasm files, wasm-feature-detect, the trained
  // data) has to be listed explicitly or it silently goes missing from the deployed bundle.
  // Confirmed by inspecting the actual .next/server/**/*.nft.json trace after a build.
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
              // style-src also needs 'unsafe-inline' for the same reason —
              // several client components apply inline style attributes at
              // runtime (e.g. dynamic product colours), which would
              // otherwise be blocked without per-request nonce wiring.
              "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; object-src 'none'; base-uri 'self'; " +
              // Vercel Blob (*.public.blob.vercel-storage.com) is kept
              // unconditionally alongside R2 — it's still production's
              // active image backend until STORAGE_DRIVER is deliberately
              // switched to `r2`, so dropping it here would break every
              // existing product/hero/workshop image on deploy.
              `img-src 'self' data: blob: https://*.public.blob.vercel-storage.com${r2Hostname ? ` https://${r2Hostname}` : ''}; ` +
              `connect-src 'self' blob:${r2Hostname ? ` https://${r2Hostname}` : ''}; ` +
              `frame-src 'self' https://*.public.blob.vercel-storage.com${r2Hostname ? ` https://${r2Hostname}` : ''}; ` +
              "frame-ancestors 'none'",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
