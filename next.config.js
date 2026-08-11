/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  images: { unoptimized: true },
  allowedDevOrigins: ['10.33.31.90:4552', '10.33.31.90', 'localhost:4552'],
  poweredByHeader: false,
  devIndicators: false,
};

module.exports = nextConfig;
