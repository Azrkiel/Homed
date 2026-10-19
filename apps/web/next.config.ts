import type { NextConfig } from 'next';

const config: NextConfig = {
  transpilePackages: ['@homed/core', '@homed/data', '@homed/db'],
  // Paid placement never changes the score; there is no ads or tracking config here on purpose.
  poweredByHeader: false,
  // Application documents are up to 5 MB (encrypted at rest); Next's default server-action cap is 1 MB.
  experimental: { serverActions: { bodySizeLimit: '6mb' } },
};

export default config;
