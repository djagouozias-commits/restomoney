/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      { protocol: 'http',  hostname: 'localhost' },
      { protocol: 'https', hostname: '*.onrender.com' },
      { protocol: 'https', hostname: '*.vercel.app' },
      // Ajoute ici ton domaine custom si tu en as un
      // { protocol: 'https', hostname: 'restomoney.com' },
    ],
  },
  // Permet à Next.js de fonctionner derrière un proxy (Vercel)
  output: 'standalone',
}

module.exports = nextConfig
