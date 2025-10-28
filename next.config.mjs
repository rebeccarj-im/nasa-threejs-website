// next.config.mjs
/** @type {import('next').NextConfig} */
const nextConfig = {
  // Temporarily skip ESLint during `next build` to avoid legacy option errors.
  // When you migrate to ESLint v9 flat config, set this back to false.
  eslint: {
    ignoreDuringBuilds: true,
  },

  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'images-assets.nasa.gov' },
      { protocol: 'https', hostname: 'images-api.nasa.gov' },
      { protocol: 'https', hostname: 'epic.gsfc.nasa.gov' },
      { protocol: 'https', hostname: 'apod.nasa.gov' },
      // Additional domains commonly used by NASA or placeholders:
      { protocol: 'https', hostname: 'images.nasa.gov' },
      { protocol: 'https', hostname: 'picsum.photos' },
    ],
  },
};

export default nextConfig;
