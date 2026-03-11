import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

// PATCH /api/repair-jobs/[id] — 파트너가 작업 상태 변경
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { status } = await req.json()
    const validStatuses = ['in_progress', 'completed', 'cancelled']
    if (!validStatuses.includes(status)) {
      return NextResponse.json({ error: '유효하지 않은 상태값' }, { status: 400 })
    }

    const jobId = params.id

    // 파트너 소유 확인: repair_jobs → shop_id → partner_shops.user_id = 현재 유저
    const { data: job, error: jobErr } = await supabase
      .from('repair_jobs')
      .select('id, request_id, status, shop_id, partner_shops!inner(user_id)')
      .eq('id', jobId)
      .single()

    if (jobErr || !job) return NextResponse.json({ error: '작업을 찾을 수 없습니다' }, { status: 404 })

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const shopOwnerId = (job as any).partner_shops?.user_id
    if (shopOwnerId !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // repair_jobs 상태 업데이트
    const jobUpdate: Record<string, string> = { status, updated_at: new Date().toISOString() }
    if (status === 'in_progress') jobUpdate.started_at = new Date().toISOString()
    if (status === 'completed')   jobUpdate.completed_at = new Date().toISOString()

    const { error: updateErr } = await supabase
      .from('repair_jobs')
      .update(jobUpdate)
      .eq('id', jobId)

    if (updateErr) throw updateErr

    // repair_requests 상태 동기화 (파트너는 RLS 상 직접 업데이트 불가 → service client 사용)
    if (job.request_id) {
      const requestStatusMap: Record<string, string> = {
        in_progress: 'in_progress',
        completed:   'completed',
        cancelled:   'accepted', // 취소 시 다시 accepted 상태로 되돌림
      }
      const newRequestStatus = requestStatusMap[status]
      if (newRequestStatus) {
        const serviceSupabase = createServiceClient()
        await serviceSupabase
          .from('repair_requests')
          .update({ status: newRequestStatus, updated_at: new Date().toISOString() })
          .eq('id', job.request_id)
      }
    }

    return NextResponse.json({ ok: true, status })
  } catch (e: unknown) {
    console.error('[repair-jobs PATCH]', e)
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: 'Server error', detail: msg }, { status: 500 })
  }
}
