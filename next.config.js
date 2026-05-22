/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  images: { unoptimized: true },
  allowedDevOrigins: ['10.33.31.90'],
  poweredByHeader: false,
  devIndicators: false,
};

module.exports = nextConfig;
