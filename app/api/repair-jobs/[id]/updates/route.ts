import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

// GET /api/repair-jobs/[id]/updates — 수리 현황 조회
export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data } = await supabase
      .from('repair_updates')
      .select('*')
      .eq('job_id', params.id)
      .order('created_at', { ascending: true })

    return NextResponse.json(data ?? [])
  } catch (e) {
    console.error('[updates GET]', e)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}

// POST /api/repair-jobs/[id]/updates — 파트너: 수리 현황 업데이트 추가
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const jobId = params.id

    // 파트너 소유 확인
    const { data: job } = await supabase
      .from('repair_jobs')
      .select('id, request_id, shop_id, completion_change_count, partner_shops!inner(user_id)')
      .eq('id', jobId)
      .single()

    if (!job) return NextResponse.json({ error: '작업을 찾을 수 없습니다' }, { status: 404 })
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if ((job as any).partner_shops?.user_id !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await req.json()
    const { content, photos, estimatedCompletionAt } = body

    if (!content?.trim()) {
      return NextResponse.json({ error: '내용을 입력해주세요' }, { status: 400 })
    }

    // ETA 변경 횟수 체크 (최대 3회)
    const isEtaChange = !!estimatedCompletionAt
    const changeCount = job.completion_change_count ?? 0

    if (isEtaChange && changeCount >= 3) {
      return NextResponse.json({ error: '예상 완료시간은 최대 3회까지만 변경할 수 있습니다' }, { status: 400 })
    }

    const svc = createServiceClient()

    // 업데이트 저장
    const { data: update } = await svc
      .from('repair_updates')
      .insert({
        job_id: jobId,
        shop_id: job.shop_id,
        content: content.trim(),
        photos: photos ?? [],
        estimated_completion_at: estimatedCompletionAt || null,
      })
      .select('*')
      .single()

    // ETA 변경이면 repair_jobs.estimated_completion_at + completion_change_count 업데이트
    if (isEtaChange) {
      await svc
        .from('repair_jobs')
        .update({
          estimated_completion_at: estimatedCompletionAt,
          completion_change_count: changeCount + 1,
          updated_at: new Date().toISOString(),
        })
        .eq('id', jobId)
    }

    // 소비자에게 알림
    const { data: rr } = await svc
      .from('repair_requests')
      .select('user_id')
      .eq('id', job.request_id)
      .single()

    if (rr?.user_id) {
      const notifTitle = isEtaChange
        ? '🕐 예상 완료시간이 변경되었습니다'
        : '🔧 수리 현황이 업데이트되었습니다'
      const notifBody = isEtaChange
        ? `새 예상 완료시간이 설정되었습니다. 수리 현황을 확인해 주세요.`
        : content.slice(0, 60)

      await svc.from('notifications').insert({
        user_id: rr.user_id,
        type: isEtaChange ? 'eta_changed' : 'repair_update',
        title: notifTitle,
        body: notifBody,
        data: { requestId: job.request_id, jobId },
      })
    }

    return NextResponse.json(update, { status: 201 })
  } catch (e: unknown) {
    console.error('[updates POST]', e)
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: 'Server error', detail: msg }, { status: 500 })
  }
}
