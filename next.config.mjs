/** @type {import('next').NextConfig} */
const isGitHubPages = process.env.GITHUB_ACTIONS === 'true';

const nextConfig = {
  ...(isGitHubPages ? {
    output: 'export',
    trailingSlash: true,
  } : {}),
  images: {
    unoptimized: isGitHubPages,
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'api.microlink.io',
      },
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
};

export default nextConfig;
