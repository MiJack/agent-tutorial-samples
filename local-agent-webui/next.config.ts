import type { NextConfig } from 'next';
const config: NextConfig = {
  devIndicators: false,
  turbopack: { root: process.cwd() },
  serverExternalPackages: [
    '@ai-sdk/harness',
    '@ai-sdk/harness-pi',
    '@ai-sdk/sandbox-just-bash',
    '@earendil-works/pi-coding-agent',
    '@earendil-works/pi-ai',
    'just-bash',
  ],
};
export default config;
