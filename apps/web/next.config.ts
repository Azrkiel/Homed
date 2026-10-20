import { join } from 'node:path';
import type { NextConfig } from 'next';

// Invite links carry secrets in their path, so other origins get only our origin as the Referer (never
// the path). OpenStreetMap's tile servers require a Referer, so "same-origin"/"no-referrer" would get every
// map tile blocked. Never let another site frame Homed (clickjacking on apply / landlord actions).
const SECURITY_HEADERS = [
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
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
  // Docker/Fly build (HOMED_STANDALONE=1): self-contained server; trace files from the monorepo root.
  // The build runs in apps/web, so the root is two levels up.
  ...(process.env.HOMED_STANDALONE === '1' ? { output: 'standalone' as const, outputFileTracingRoot: join(process.cwd(), '..', '..') } : {}),
  async headers() {
    return [{ source: '/:path*', headers: SECURITY_HEADERS }];
  },
};

export default config;
