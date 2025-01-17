import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // Static export
  // https://nextjs.org/docs/app/building-your-application/deploying/static-exports
  output: 'export',
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '*',
      },
    ],
  },
}

export default nextConfig
