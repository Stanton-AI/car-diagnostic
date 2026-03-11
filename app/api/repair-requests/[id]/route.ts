import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

// GET /api/repair-requests/[id] — 단건 조회 (소비자 + 입찰 목록)
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data, error } = await supabase
      .from('repair_requests')
      .select(`
        *,
        shop_bids(
          *,
          partner_shops(id, name, address, phone, rating, review_count, total_jobs, categories, description, profile_image_url)
        )
      `)
      .eq('id', id)
      .eq('user_id', user.id)
      .single()

    if (error || !data) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    // 수리 작업 정보도 함께 반환 (accepted 이후 상태 추적용)
    const svc = createServiceClient()
    const { data: repairJob } = await svc
      .from('repair_jobs')
      .select('id, status, estimated_completion_at, mechanic_final_comment, invoice_url, completion_change_count, completion_photos')
      .eq('request_id', id)
      .neq('status', 'cancelled')
      .maybeSingle()

    return NextResponse.json({ ...data, repair_job: repairJob ?? null })
  } catch (e) {
    console.error('[repair-requests/:id GET]', e)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}

// PATCH /api/repair-requests/[id] — 상태 변경 (취소 등)
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { status } = await req.json()
    const allowed = ['cancelled']
    if (!allowed.includes(status)) {
      return NextResponse.json({ error: 'Invalid status' }, { status: 400 })
    }

    const { error } = await supabase
      .from('repair_requests')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('id', id)
      .eq('user_id', user.id)

    if (error) throw error
    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error('[repair-requests/:id PATCH]', e)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
