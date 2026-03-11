import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

// GET /api/repair-requests/[id]/report
// 파트너가 수리 요청에 연결된 MIKY 진단 리포트를 조회
export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const requestId = params.id

    // 1) 파트너 샵 확인
    const { data: shop } = await supabase
      .from('partner_shops')
      .select('id')
      .eq('user_id', user.id)
      .eq('status', 'active')
      .maybeSingle()
    if (!shop) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    // 2) 이 파트너가 해당 요청에 입찰했는지 확인 (접근 권한 검증)
    const { data: bid } = await supabase
      .from('shop_bids')
      .select('id')
      .eq('shop_id', shop.id)
      .eq('request_id', requestId)
      .maybeSingle()
    if (!bid) return NextResponse.json({ error: 'Forbidden: 입찰하지 않은 요청입니다' }, { status: 403 })

    // 3) service client로 repair_requests → conversation_id 조회
    const svc = createServiceClient()
    const { data: rr } = await svc
      .from('repair_requests')
      .select('conversation_id, diagnosis_category, urgency_level, symptom_summary')
      .eq('id', requestId)
      .maybeSingle()

    if (!rr) return NextResponse.json({ error: '요청을 찾을 수 없습니다' }, { status: 404 })
    if (!rr.conversation_id) {
      // 대화 기록이 없는 경우 (직접 제출된 요청 등)
      return NextResponse.json({ hasReport: false })
    }

    // 4) conversations.final_result 조회 (RLS 우회: service client 사용)
    const { data: conv } = await svc
      .from('conversations')
      .select('final_result')
      .eq('id', rr.conversation_id)
      .maybeSingle()

    if (!conv?.final_result) {
      return NextResponse.json({ hasReport: false })
    }

    // 5) 파트너에게 필요한 필드만 반환 (소비자 개인정보 제외)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = conv.final_result as any
    return NextResponse.json({
      hasReport: true,
      category: result.category ?? rr.diagnosis_category,
      summary: result.summary ?? rr.symptom_summary,
      urgency: result.urgency ?? rr.urgency_level,
      urgencyReason: result.urgencyReason ?? '',
      causes: result.causes ?? [],   // [{ name, probability, description }]
      shopTip: result.shopTip ?? '', // 정비소 방문 시 전달 사항
      cost: result.cost ?? null,     // { parts, labor, total } 딜러 예상가
    })
  } catch (e: unknown) {
    console.error('[repair-requests report GET]', e)
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: 'Server error', detail: msg }, { status: 500 })
  }
}
