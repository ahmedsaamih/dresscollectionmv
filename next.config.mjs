// Media storage moved off Vercel Blob to Cloudflare R2 (production image/PDF/receipt
// storage) plus Google Drive for customer design-file attachments. R2's public hostname
// is only known at runtime via R2_PUBLIC_BASE_URL, so derive it here for both the
// next/image allowlist and the CSP below.
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
  images: {
    remotePatterns: [
      // Vercel Blob — still the active storage backend in production until
      // STORAGE_DRIVER is explicitly flipped to `r2`; kept unconditionally
      // so images don't break mid-migration.
      { protocol: 'https', hostname: '*.public.blob.vercel-storage.com' },
      ...(r2Hostname ? [{ protocol: 'https', hostname: r2Hostname }] : []),
      { protocol: 'https', hostname: 'drive.google.com' },
      { protocol: 'https', hostname: 'lh3.googleusercontent.com' },
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
              // 'wasm-unsafe-eval' (not the much broader 'unsafe-eval') is
              // required for the jersey builder's 3D preview: drei's
              // useGLTF/DRACOLoader decodes compressed mesh geometry via a
              // WebAssembly module, which the browser refuses to instantiate
              // without it — independent of dev vs. prod or React's own
              // (dev-only) use of eval() for stack traces.
              "default-src 'self'; script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval'; style-src 'self' 'unsafe-inline'; object-src 'none'; base-uri 'self'; " +
              // Vercel Blob (*.public.blob.vercel-storage.com) is kept
              // unconditionally alongside R2 — it's still production's
              // active image backend until STORAGE_DRIVER is deliberately
              // switched to `r2`, so dropping it here would break every
              // existing product/hero/workshop image on deploy.
              `img-src 'self' data: blob: https://*.public.blob.vercel-storage.com${r2Hostname ? ` https://${r2Hostname}` : ''} https://drive.google.com https://lh3.googleusercontent.com; ` +
              // connect-src covers the fetches the 3D preview makes beyond
              // same-origin: the DRACOLoader decoder + wasm binary from
              // Google's CDN, drei's default "studio" environment map HDRI
              // (raw.githack.com 302-redirects to raw.githubusercontent.com,
              // and CSP re-checks connect-src against the redirected URL too
              // — both hosts are needed), and the blob: URLs three.js uses
              // internally for decoded textures/geometry. www.googleapis.com is
              // needed for the quote page's direct-to-Drive resumable upload PUTs.
              `connect-src 'self' blob: https://www.gstatic.com https://raw.githack.com https://raw.githubusercontent.com https://www.googleapis.com${r2Hostname ? ` https://${r2Hostname}` : ''}; ` +
              // worker-src: DRACOLoader spins up its decoder in a Web Worker
              // constructed from a blob: URL; without this it falls back to
              // script-src, which doesn't include blob: and the worker
              // creation is blocked.
              "worker-src 'self' blob:; " +
              `frame-src 'self' https://*.public.blob.vercel-storage.com${r2Hostname ? ` https://${r2Hostname}` : ''} https://drive.google.com https://www.openstreetmap.org; ` +
              "frame-ancestors 'none'",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
