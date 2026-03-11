import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

// GET /api/repair-jobs/[id]/diagnose — 정밀진단 결과 조회
export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data } = await supabase
      .from('precise_diagnoses')
      .select('*')
      .eq('job_id', params.id)
      .maybeSingle()

    return NextResponse.json(data ?? null)
  } catch (e) {
    console.error('[diagnose GET]', e)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}

// POST /api/repair-jobs/[id]/diagnose — 파트너: 정밀진단 결과 저장 (upsert)
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
      .select('id, request_id, shop_id, partner_shops!inner(user_id)')
      .eq('id', jobId)
      .single()

    if (!job) return NextResponse.json({ error: '작업을 찾을 수 없습니다' }, { status: 404 })
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if ((job as any).partner_shops?.user_id !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await req.json()
    const { diagnosisItems, partsNeeded, laborCost, totalCost, mechanicNotes } = body

    const svc = createServiceClient()

    // upsert (이미 있으면 업데이트)
    const { data: existing } = await supabase
      .from('precise_diagnoses')
      .select('id')
      .eq('job_id', jobId)
      .maybeSingle()

    let result
    if (existing) {
      const { data } = await svc
        .from('precise_diagnoses')
        .update({
          diagnosis_items: diagnosisItems ?? [],
          parts_needed: partsNeeded ?? [],
          labor_cost: laborCost ?? 0,
          total_cost: totalCost ?? 0,
          mechanic_notes: mechanicNotes || null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', existing.id)
        .select('*')
        .single()
      result = data
    } else {
      const { data } = await svc
        .from('precise_diagnoses')
        .insert({
          job_id: jobId,
          request_id: job.request_id,
          shop_id: job.shop_id,
          diagnosis_items: diagnosisItems ?? [],
          parts_needed: partsNeeded ?? [],
          labor_cost: laborCost ?? 0,
          total_cost: totalCost ?? 0,
          mechanic_notes: mechanicNotes || null,
        })
        .select('*')
        .single()
      result = data
    }

    // 소비자에게 알림 (service client)
    const { data: rr } = await svc
      .from('repair_requests')
      .select('user_id')
      .eq('id', job.request_id)
      .single()

    if (rr?.user_id) {
      await svc.from('notifications').insert({
        user_id: rr.user_id,
        type: 'precise_diagnosis_ready',
        title: '🔍 정밀진단 결과가 나왔습니다',
        body: '정비사가 정밀진단을 완료했습니다. 결과를 확인하고 수리 여부를 결정해주세요.',
        data: { requestId: job.request_id, jobId },
      })
    }

    return NextResponse.json(result, { status: existing ? 200 : 201 })
  } catch (e: unknown) {
    console.error('[diagnose POST]', e)
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: 'Server error', detail: msg }, { status: 500 })
  }
}

// PATCH /api/repair-jobs/[id]/diagnose — 소비자: 정밀진단 승인/거절
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { decision } = await req.json() // 'approved' | 'rejected'
    if (!['approved', 'rejected'].includes(decision)) {
      return NextResponse.json({ error: '유효하지 않은 결정값' }, { status: 400 })
    }

    const svc = createServiceClient()

    // 소비자 소유 확인: precise_diagnoses → repair_requests.user_id
    const { data: pd } = await svc
      .from('precise_diagnoses')
      .select('id, request_id, job_id')
      .eq('job_id', params.id)
      .single()

    if (!pd) return NextResponse.json({ error: '진단 결과를 찾을 수 없습니다' }, { status: 404 })

    const { data: rr } = await svc
      .from('repair_requests')
      .select('user_id')
      .eq('id', pd.request_id)
      .single()

    if (rr?.user_id !== user.id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    await svc
      .from('precise_diagnoses')
      .update({
        consumer_decision: decision,
        consumer_decided_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', pd.id)

    // 파트너에게 알림
    const { data: job } = await svc
      .from('repair_jobs')
      .select('shop_id, partner_shops(user_id)')
      .eq('id', pd.job_id)
      .single()

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const partnerUserId = (job as any)?.partner_shops?.user_id
    if (partnerUserId) {
      await svc.from('notifications').insert({
        user_id: partnerUserId,
        type: decision === 'approved' ? 'repair_approved' : 'repair_rejected',
        title: decision === 'approved' ? '✅ 소비자가 수리를 승인했습니다!' : '❌ 소비자가 수리를 거절했습니다',
        body: decision === 'approved' ? '수리를 시작해 주세요.' : '다음 기회에 좋은 결과가 있기를 바랍니다.',
        data: { jobId: pd.job_id },
      })
    }

    return NextResponse.json({ ok: true, decision })
  } catch (e: unknown) {
    console.error('[diagnose PATCH]', e)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
