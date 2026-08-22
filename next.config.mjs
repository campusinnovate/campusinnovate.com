/** @type {import('next').NextConfig} */
const isGitHubPages = process.env.GITHUB_ACTIONS === 'true';

const nextConfig = {
  ...(isGitHubPages ? {
    output: 'export',
    trailingSlash: true,
  } : {}),
  images: {
    unoptimized: isGitHubPages,
    domains: [
      'api.microlink.io', // Microlink Image Preview
    ],
    remotePatterns: [
      {
        hostname: 'images.unsplash.com',
      },
      {
        hostname: 'assets.aceternity.com',
      },
      {
        hostname: 'unsplash.com',
      },
      {
        hostname: 'www.clipartmax.com',
      },
    ],
  },
   experimental: {
    missingSuspenseWithCSRBailout: false,
  },
};

export default nextConfig;
