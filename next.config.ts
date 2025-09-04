import type { NextConfig } from 'next';
import createNextIntlPlugin from 'next-intl/plugin';

// Verwijs expliciet naar jouw request-config (staat in src/i18n/request.ts)
const withNextIntl = createNextIntlPlugin('./i18n/request.ts');

const isProd = process.env.NODE_ENV === 'production';

const nextConfig: NextConfig = {
  async headers() {
    // Apply security headers to all routes. CSP is report-only to avoid accidental breakage.
    const common = [
      { key: 'X-Frame-Options', value: 'DENY' },
      { key: 'X-Content-Type-Options', value: 'nosniff' },
      { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
      { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
      {
        key: 'Permissions-Policy',
        value: ['camera=()', 'microphone=()', 'geolocation=()', 'interest-cohort=()'].join(', '),
      },
      {
        key: 'Content-Security-Policy-Report-Only',
        value: [
          "default-src 'self'",
          "img-src 'self' data: blob:",
          "font-src 'self'",
          "style-src 'self' 'unsafe-inline'",
          // Next.js may inject inline scripts for hydration; keep report-only to gather signals first
          "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
          "connect-src 'self'",
          'base-uri \"none\"',
          'frame-ancestors \"none\"',
        ].join('; '),
      },
    ];
    const hsts = isProd
      ? [
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=63072000; includeSubDomains; preload',
          },
        ]
      : [];
    return [{ source: '/:path*', headers: [...common, ...hsts] }];
  },
};

export default withNextIntl(nextConfig);
