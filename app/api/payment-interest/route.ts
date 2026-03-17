import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/server'

// 스모크 테스트: 결제 의향을 기록합니다 (실제 결제 없음)
export async function POST(req: NextRequest) {
  const { plan, source } = await req.json()

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const service = createServiceClient()
  await service.from('payment_interest').insert({
    user_id: user?.id ?? null,
    plan: plan ?? 'premium_monthly',
    source: source ?? 'unknown',
    created_at: new Date().toISOString(),
  }).then(({ error }) => {
    if (error) console.error('[payment-interest] insert error:', error.message)
  })

  return NextResponse.json({ success: true })
}
