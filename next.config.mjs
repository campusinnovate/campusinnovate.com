/** @type {import('next').NextConfig} */
const isGitHubPages = process.env.GITHUB_ACTIONS === 'true';
const isDesktopBuild = process.env.DESKTOP_BUILD === 'true';

const nextConfig = {
  ...(isGitHubPages ? {
    output: 'export',
    trailingSlash: true,
  } : isDesktopBuild ? { output: 'standalone' } : {}),
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
