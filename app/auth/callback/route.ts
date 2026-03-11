import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const redirect = searchParams.get('redirect') ?? '/main'

  // ── OAuth 공급자가 에러를 보낸 경우 (access_denied 등) ─────────────────
  const oauthError = searchParams.get('error')
  const oauthErrorDesc = searchParams.get('error_description')
  if (oauthError) {
    const p = new URLSearchParams({ error: oauthError })
    if (oauthErrorDesc) p.set('desc', oauthErrorDesc)
    return NextResponse.redirect(`${origin}/login?${p}`)
  }

  if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)

    if (!error) {
      const { data: { user } } = await supabase.auth.getUser()

      if (user) {
        // ── 역할 기반 리디렉션 (root '/' 또는 기본 '/main'에서 온 경우) ──
        // 미들웨어가 /partner, /admin, /history 등으로 redirect한 경우엔 그 경로 존중
        const isDefaultRedirect = redirect === '/main' || redirect === '/'
        if (isDefaultRedirect) {
          // 1순위: admin 역할
          const { data: profile } = await supabase
            .from('users')
            .select('role')
            .eq('id', user.id)
            .single()

          if (profile?.role === 'admin') {
            return NextResponse.redirect(`${origin}/admin`)
          }

          // 2순위: 파트너 정비소 보유 여부
          const { data: shop } = await supabase
            .from('partner_shops')
            .select('id')
            .eq('user_id', user.id)
            .maybeSingle()

          if (shop) {
            return NextResponse.redirect(`${origin}/partner`)
          }

          // 3순위: 일반 소비자 — 차량 미등록 시 최초 등록 페이지
          const { count } = await supabase
            .from('vehicles')
            .select('*', { count: 'exact', head: true })
            .eq('user_id', user.id)

          if ((count ?? 0) === 0) {
            return NextResponse.redirect(`${origin}/vehicles/new?first=true`)
          }

          return NextResponse.redirect(`${origin}/main`)
        }

        // 명시적 redirect 경로 (미들웨어가 보낸 /partner, /admin, /history 등)
        return NextResponse.redirect(`${origin}${redirect}`)
      }
    }

    // ── 코드 교환 실패 (PKCE 불일치 등) ───────────────────────────────────
    const p = new URLSearchParams({ error: 'exchange_failed', desc: error?.message ?? '' })
    return NextResponse.redirect(`${origin}/login?${p}`)
  }

  // ── code 파라미터 자체가 없는 경우 ────────────────────────────────────
  return NextResponse.redirect(`${origin}/login?error=no_code`)
}
