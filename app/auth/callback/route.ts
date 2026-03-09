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
      // 차량 등록 여부 확인 → 없으면 첫 등록 페이지로
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const { count } = await supabase
          .from('vehicles')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', user.id)

        if ((count ?? 0) === 0) {
          return NextResponse.redirect(`${origin}/vehicles/new?first=true`)
        }
      }
      return NextResponse.redirect(`${origin}${redirect}`)
    }

    // ── 코드 교환 실패 (PKCE 불일치 등) ───────────────────────────────────
    const p = new URLSearchParams({ error: 'exchange_failed', desc: error.message })
    return NextResponse.redirect(`${origin}/login?${p}`)
  }

  // ── code 파라미터 자체가 없는 경우 ────────────────────────────────────
  return NextResponse.redirect(`${origin}/login?error=no_code`)
}
