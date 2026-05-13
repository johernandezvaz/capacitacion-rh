/** @type {import('next').NextConfig} */
const nextConfig = {
  eslintOptions: {
    ignoreDuringBuilds: true,
  },
  images: { unoptimized: true },
  allowedDevOrigins: ['10.33.31.90'],
};

module.exports = nextConfig;
