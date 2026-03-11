import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { buildPaymentParams, generateOrderId } from '@/lib/payments'

// POST /api/payments/create — 결제 파라미터 생성 (Phase 2)
export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { jobId } = await req.json()
    if (!jobId) return NextResponse.json({ error: 'jobId 필요' }, { status: 400 })

    // job 조회
    const { data: job } = await supabase
      .from('repair_jobs')
      .select('*, shop_bids(total_cost, parts_cost, labor_cost), repair_requests(symptom_summary, vehicle_maker, vehicle_model)')
      .eq('id', jobId)
      .eq('user_id', user.id)
      .single()

    if (!job) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    if (job.payment_status === 'paid') {
      return NextResponse.json({ error: '이미 결제된 건입니다' }, { status: 400 })
    }

    const amount = job.shop_bids?.total_cost ?? 0
    const { data: profile } = await supabase
      .from('users')
      .select('display_name, email')
      .eq('id', user.id)
      .single()

    const orderName = `${job.repair_requests?.symptom_summary?.slice(0, 20) ?? '수리'} (${job.repair_requests?.vehicle_maker ?? ''} ${job.repair_requests?.vehicle_model ?? ''})`

    const params = buildPaymentParams(
      jobId,
      amount,
      orderName,
      profile?.display_name ?? '고객',
      profile?.email,
    )

    // orderId 저장
    await supabase.from('repair_jobs').update({
      order_id: params.orderId,
      updated_at: new Date().toISOString(),
    }).eq('id', jobId)

    return NextResponse.json({ params, tossClientKey: process.env.NEXT_PUBLIC_TOSS_CLIENT_KEY })
  } catch (e) {
    console.error('[payments/create POST]', e)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
