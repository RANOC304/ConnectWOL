import type { NextConfig } from 'next';

const isDev = process.env.NODE_ENV !== 'production';

// Inline scripts are required by Next.js hydration and by the tiny theme bootstrap in the root
// layout, so script-src keeps 'unsafe-inline'. Everything else is locked to this origin: no
// third-party scripts, styles, fonts or images, and no cross-origin requests from the page.
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ''}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self'",
  "connect-src 'self'",
  "manifest-src 'self'",
  "worker-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join('; ');

const nextConfig: NextConfig = {
  output: 'standalone',
  poweredByHeader: false,
  reactStrictMode: true,
  // Native modules must be loaded with plain require() rather than bundled.
  serverExternalPackages: ['better-sqlite3', '@node-rs/argon2'],
  // SQL migrations are read from disk at start-up; make sure the standalone trace ships them.
  outputFileTracingIncludes: {
    '/*': ['./drizzle/**/*'],
  },
  async headers() {
    const common = [
      { key: 'X-Content-Type-Options', value: 'nosniff' },
      { key: 'X-Frame-Options', value: 'DENY' },
      { key: 'Referrer-Policy', value: 'same-origin' },
      { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), payment=()' },
      { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
    ];
    return [
      { source: '/:path*', headers: [...common, { key: 'Content-Security-Policy', value: csp }] },
      // The service worker must always be revalidated so updates reach installed PWAs.
      {
        source: '/sw.js',
        headers: [
          { key: 'Cache-Control', value: 'no-cache, no-store, must-revalidate' },
          { key: 'Service-Worker-Allowed', value: '/' },
        ],
      },
      { source: '/api/:path*', headers: [{ key: 'Cache-Control', value: 'no-store' }] },
    ];
  },
};

export default nextConfig;
