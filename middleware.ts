import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

const PROTECTED_PATHS = ['/main', '/profile', '/history', '/vehicles', '/chat', '/repair', '/partner']
const ADMIN_PATHS = ['/admin']

// ── 간이 Rate Limiting (Edge 메모리, 인스턴스 단위) ─────────────
// Vercel Edge 프로세스당 유지되며, 요청 폭주 1차 방어용
const rateLimitMap = new Map<string, { count: number; resetAt: number }>()
const RATE_LIMIT_WINDOW_MS = 60_000  // 1분
const RATE_LIMIT_MAX = 120           // 1분에 최대 120 요청 (일반 경로)
const API_RATE_LIMIT_MAX = 60        // API는 1분에 최대 60 요청

function checkRateLimit(ip: string, max: number): boolean {
  const now = Date.now()
  const entry = rateLimitMap.get(ip)
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS })
    return true
  }
  entry.count++
  if (entry.count > max) return false
  return true
}

export async function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname

  // ── Rate Limiting ────────────────────────────────────────────
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    ?? request.headers.get('x-real-ip')
    ?? 'unknown'
  const isApi = path.startsWith('/api/')
  const allowed = checkRateLimit(ip, isApi ? API_RATE_LIMIT_MAX : RATE_LIMIT_MAX)
  if (!allowed) {
    return new NextResponse('Too Many Requests', {
      status: 429,
      headers: {
        'Retry-After': '60',
        'Content-Type': 'text/plain',
      },
    })
  }

  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (cookiesToSet: { name: string; value: string; options?: any }[]) => {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()

  // 보호된 경로: 비로그인 시 홈으로
  if (PROTECTED_PATHS.some(p => path.startsWith(p)) && !user) {
    return NextResponse.redirect(new URL(`/login?redirect=${path}`, request.url))
  }

  // 어드민 경로: 로그인 + role 이중 검증
  if (ADMIN_PATHS.some(p => path.startsWith(p))) {
    if (!user) return NextResponse.redirect(new URL('/login', request.url))
    // DB에서 role 재확인 (클라이언트 우회 불가)
    const { data: profile } = await supabase
      .from('users').select('role').eq('id', user.id).single()
    if (profile?.role !== 'admin') {
      return NextResponse.redirect(new URL('/main', request.url))
    }
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    // 정적 파일 제외, API 포함 (Rate Limiting 적용)
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
}
