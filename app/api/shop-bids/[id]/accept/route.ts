import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { calcCommission } from '@/lib/payments'

// PUT /api/shop-bids/[id]/accept — 소비자가 입찰 낙찰 수락
export async function PUT(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: bidId } = await params
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    // 입찰 + 연결된 요청 조회
    const { data: bid } = await supabase
      .from('shop_bids')
      .select('*, repair_requests(id, user_id, status, symptom_summary)')
      .eq('id', bidId)
      .single()

    if (!bid) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const rr = bid.repair_requests
    if (!rr || rr.user_id !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    if (!['open','bidding'].includes(rr.status)) {
      return NextResponse.json({ error: '이미 처리된 요청입니다' }, { status: 400 })
    }

    const commission = calcCommission(bid.total_cost, bid.commission_rate)

    // shop_bids UPDATE는 RLS 순환참조 가능 → service client 사용 (인증은 위에서 검증 완료)
    const svc = createServiceClient()

    // 트랜잭션: bid 낙찰, 나머지 rejected, request 상태 변경
    const [{ error: e1 }, { error: e2 }, { error: e3 }] = await Promise.all([
      // 낙찰 bid 업데이트 (service client)
      svc.from('shop_bids').update({
        status: 'accepted',
        commission_amount: commission,
        updated_at: new Date().toISOString(),
      }).eq('id', bidId),
      // 나머지 입찰 rejected (service client)
      svc.from('shop_bids').update({
        status: 'rejected',
        updated_at: new Date().toISOString(),
      }).eq('request_id', rr.id).neq('id', bidId),
      // 요청 상태 변경 (소비자 본인 → rr_update_own 정책으로 가능)
      supabase.from('repair_requests').update({
        status: 'accepted',
        accepted_bid_id: bidId,
        updated_at: new Date().toISOString(),
      }).eq('id', rr.id),
    ])

    if (e1 || e2 || e3) throw e1 ?? e2 ?? e3

    // repair_jobs 생성 (service client: RLS 순환참조 방지)
    const { data: job } = await svc.from('repair_jobs').insert({
      request_id: rr.id,
      bid_id: bidId,
      shop_id: bid.shop_id,
      user_id: user.id,
    }).select('id').single()

    // 파트너 정비소에 낙찰 알림 (service client)
    await svc.from('notifications').insert({
      shop_id: bid.shop_id,
      type: 'bid_accepted',
      title: '🎉 낙찰되었습니다!',
      body: rr.symptom_summary.slice(0, 60),
      data: { requestId: rr.id, bidId, jobId: job?.id },
    })

    return NextResponse.json({ ok: true, jobId: job?.id })
  } catch (e) {
    console.error('[shop-bids/:id/accept PUT]', e)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
