/** @type {import('next').NextConfig} */
const nextConfig = {
  agentRules: false,
  output: 'standalone',
  poweredByHeader: false,
  images: {
    unoptimized: true
  },
  async headers() {
    return [{
      source: '/:path*',
      headers: [
        { key: 'Content-Security-Policy', value: "frame-ancestors 'none'; object-src 'none'; base-uri 'self'" },
        { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
        { key: 'X-Content-Type-Options', value: 'nosniff' }
      ]
    }, ...['/admin/testing/player', '/lobby', '/game', '/results'].map((source) => ({
      source,
      headers: [
        { key: 'Content-Security-Policy', value: "frame-ancestors 'self'; object-src 'none'; base-uri 'self'" }
      ]
    }))];
  }
}

module.exports = nextConfig

