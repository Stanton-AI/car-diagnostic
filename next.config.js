/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '*.supabase.co' },
    ],
  },

  // ── 보안 헤더 ──────────────────────────────────────────────────
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          // 클릭재킹 방지
          { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
          // MIME 스니핑 방지
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          // 반사형 XSS 방지 (레거시 브라우저)
          { key: 'X-XSS-Protection', value: '1; mode=block' },
          // Referrer 최소 노출
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          // 불필요한 브라우저 기능 차단
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
          // DNS 프리페치 제어
          { key: 'X-DNS-Prefetch-Control', value: 'on' },
        ],
      },
      {
        // API 라우트: 외부 직접 호출 방지를 위한 헤더
        source: '/api/:path*',
        headers: [
          { key: 'X-Robots-Tag', value: 'noindex' },
        ],
      },
    ]
  },
}

module.exports = nextConfig
