import type { NextConfig } from 'next';

// Invite links carry secrets in their path, so never send the URL to other origins, and never let
// another site frame Homed (clickjacking on apply / landlord actions).
const SECURITY_HEADERS = [
  { key: 'Referrer-Policy', value: 'same-origin' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
];

const config: NextConfig = {
  transpilePackages: ['@homed/core', '@homed/data', '@homed/db'],
  // Paid placement never changes the score; there is no ads or tracking config here on purpose.
  poweredByHeader: false,
  // Application documents are up to 5 MB (encrypted at rest); Next's default server-action cap is 1 MB.
  experimental: { serverActions: { bodySizeLimit: '6mb' } },
  async headers() {
    return [{ source: '/:path*', headers: SECURITY_HEADERS }];
  },
};

export default config;
