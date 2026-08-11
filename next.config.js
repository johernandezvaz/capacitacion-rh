const path = require('path');

/** @type {import('next').NextConfig} */
const nextConfig = {
  outputFileTracingRoot: path.join(__dirname, './'),
  images: { unoptimized: true },
  allowedDevOrigins: ['10.33.31.90:4552', '10.33.31.90', 'localhost:4552'],
  poweredByHeader: false,
  devIndicators: false,
};

module.exports = nextConfig;
