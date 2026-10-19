import type { NextConfig } from 'next';

const config: NextConfig = {
  transpilePackages: ['@homed/core', '@homed/data', '@homed/db'],
  // Paid placement never changes the score; there is no ads or tracking config here on purpose.
  poweredByHeader: false,
};

export default config;
