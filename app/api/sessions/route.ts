import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/server'

// 유입 경로 판별
function detectSource(utmSource: string | null, referrer: string | null): string {
  if (utmSource) {
    const s = utmSource.toLowerCase()
    if (s.includes('kakao')) return 'kakao'
    if (s.includes('instagram') || s.includes('ig')) return 'instagram'
    if (s.includes('naver')) return 'naver'
    if (s.includes('google')) return 'google'
    if (s.includes('facebook') || s.includes('fb')) return 'facebook'
    return utmSource
  }
  if (referrer) {
    const r = referrer.toLowerCase()
    if (r.includes('kakao')) return 'kakao'
    if (r.includes('instagram')) return 'instagram'
    if (r.includes('naver')) return 'naver'
    if (r.includes('google')) return 'google'
    if (r.includes('facebook')) return 'facebook'
    if (r.includes('t.co') || r.includes('twitter')) return 'twitter'
  }
  return 'direct'
}

export async function POST(req: NextRequest) {
  try {
    const { utm_source, utm_medium, utm_campaign, referrer } = await req.json()

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    const source = detectSource(utm_source ?? null, referrer ?? null)

    const service = createServiceClient()
    await service.from('app_sessions').insert({
      user_id: user?.id ?? null,
      source,
      utm_source: utm_source ?? null,
      utm_medium: utm_medium ?? null,
      utm_campaign: utm_campaign ?? null,
      referrer: referrer ?? null,
    })

    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ success: false })
  }
}
