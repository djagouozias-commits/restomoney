/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      { protocol: 'http',  hostname: 'localhost' },
      { protocol: 'https', hostname: '*.onrender.com' },
      { protocol: 'https', hostname: '*.vercel.app' },
    ],
  },
  output: 'standalone',
  // Ignore TypeScript errors pendant le build (erreurs de types tierces comme Leaflet)
  typescript: {
    ignoreBuildErrors: true,
  },
  // Ignore les erreurs ESLint pendant le build
  eslint: {
    ignoreDuringBuilds: true,
  },
}

module.exports = nextConfig
