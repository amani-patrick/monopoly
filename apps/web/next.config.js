/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  transpilePackages: ['@umukino/shared-types', '@umukino/shared-events', '@umukino/board-data'],
  experimental: {
    serverActions: process.env.NODE_ENV === 'development' 
      ? { allowedOrigins: ['localhost:3000'] } 
      : undefined,
  },
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'lh3.googleusercontent.com' }, // Google avatars
    ],
  },
  async rewrites() {
    const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
    return [
      { source: '/api/:path*', destination: `${API_URL}/:path*` },
    ];
  },
};

module.exports = nextConfig;
