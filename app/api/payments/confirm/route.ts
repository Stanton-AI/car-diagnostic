import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { confirmPayment } from '@/lib/payments'

// POST /api/payments/confirm — 토스 결제 승인 처리 (Phase 2)
export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { paymentKey, orderId, amount, jobId } = await req.json()
    if (!paymentKey || !orderId || !amount || !jobId) {
      return NextResponse.json({ error: '필수 파라미터 누락' }, { status: 400 })
    }

    // 결제 승인 (토스 API)
    const result = await confirmPayment({ paymentKey, orderId, amount })
    if (!result) {
      return NextResponse.json({ error: '결제 승인 실패' }, { status: 400 })
    }

    // DB 업데이트
    const { error } = await supabase
      .from('repair_jobs')
      .update({
        payment_status: 'paid',
        payment_key: paymentKey,
        payment_method: result.method,
        paid_at: result.approvedAt,
        updated_at: new Date().toISOString(),
      })
      .eq('id', jobId)
      .eq('user_id', user.id)

    if (error) throw error

    // 파트너에게 알림
    const { data: job } = await supabase
      .from('repair_jobs')
      .select('shop_id')
      .eq('id', jobId)
      .single()

    if (job?.shop_id) {
      await supabase.from('notifications').insert({
        shop_id: job.shop_id,
        type: 'payment_required',
        title: '결제가 완료되었습니다',
        body: `${amount.toLocaleString()}원 결제 완료`,
        data: { jobId, orderId },
      })
    }

    return NextResponse.json({ ok: true, result })
  } catch (e) {
    console.error('[payments/confirm POST]', e)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
