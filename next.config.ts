import type { NextConfig } from 'next';

const securityHeaders = [
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Referrer-Policy', value: 'no-referrer' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
];

const config: NextConfig = {
  serverExternalPackages: ['pdfkit', 'postgres'],
  outputFileTracingIncludes: { '/api/**': ['./node_modules/dejavu-fonts-ttf/ttf/DejaVuSans*.ttf', './forms/**', './assets/**'] },
  async headers() {
    return [
      { source: '/:path*', headers: securityHeaders },
      { source: '/(f|admin|api)/:path*', headers: [{ key: 'X-Robots-Tag', value: 'noindex, nofollow' }, { key: 'Cache-Control', value: 'no-store' }] },
    ];
  },
};
export default config;
