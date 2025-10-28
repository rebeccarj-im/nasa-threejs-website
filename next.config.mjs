/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'images-assets.nasa.gov' }, // Image Library 资源
      { protocol: 'https', hostname: 'images-api.nasa.gov' },    // 缩略图等（偶尔）
      { protocol: 'https', hostname: 'epic.gsfc.nasa.gov' },     // EPIC（若用）
      { protocol: 'https', hostname: 'apod.nasa.gov' }           // 兼容历史/APOD
    ],
  },
};
export default nextConfig;
