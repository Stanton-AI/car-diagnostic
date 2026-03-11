import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// GET /api/shop-bids?requestId=xxx — 입찰 목록 (소비자용)
// GET /api/shop-bids?shopId=xxx   — 내 입찰 목록 (파트너용)
export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const requestId = req.nextUrl.searchParams.get('requestId')
    const shopId    = req.nextUrl.searchParams.get('shopId')

    if (!requestId && !shopId) {
      return NextResponse.json({ error: 'requestId 또는 shopId 필요' }, { status: 400 })
    }

    let query = supabase
      .from('shop_bids')
      .select('*, partner_shops(id, name, address, phone, rating, review_count, total_jobs, categories, description)')
      .order('total_cost', { ascending: true })

    if (requestId) query = query.eq('request_id', requestId)
    if (shopId)    query = query.eq('shop_id', shopId)

    const { data, error } = await query
    if (error) throw error
    return NextResponse.json(data ?? [])
  } catch (e) {
    console.error('[shop-bids GET]', e)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}

// POST /api/shop-bids — 파트너 입찰 등록
export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    // 파트너 정비소 확인
    const { data: shop } = await supabase
      .from('partner_shops')
      .select('id, status')
      .eq('user_id', user.id)
      .single()

    if (!shop || shop.status !== 'active') {
      return NextResponse.json({ error: '활성화된 파트너 정비소가 없습니다' }, { status: 403 })
    }

    const body = await req.json()
    const { requestId, partsCost, laborCost, estimatedDays, availableDate, availableTime, bidNotes } = body

    if (!requestId || !partsCost || !laborCost) {
      return NextResponse.json({ error: '필수 항목 누락' }, { status: 400 })
    }

    // 이미 입찰했는지 확인
    const { data: existing } = await supabase
      .from('shop_bids')
      .select('id')
      .eq('request_id', requestId)
      .eq('shop_id', shop.id)
      .single()

    if (existing) {
      return NextResponse.json({ error: '이미 입찰한 요청입니다' }, { status: 409 })
    }

    // 요청 상태 확인
    const { data: rr } = await supabase
      .from('repair_requests')
      .select('status, user_id, symptom_summary')
      .eq('id', requestId)
      .single()

    if (!rr || !['open','bidding'].includes(rr.status)) {
      return NextResponse.json({ error: '입찰 불가능한 요청입니다' }, { status: 400 })
    }

    const { data: bid, error } = await supabase
      .from('shop_bids')
      .insert({
        request_id: requestId,
        shop_id: shop.id,
        parts_cost: partsCost,
        labor_cost: laborCost,
        estimated_days: estimatedDays ?? 1,
        available_date: availableDate || null,
        available_time: availableTime || null,
        bid_notes: bidNotes || null,
      })
      .select('id, total_cost, commission_rate, status, created_at, updated_at')
      .single()

    if (error) throw error

    // 소비자에게 알림
    await supabase.from('notifications').insert({
      user_id: rr.user_id,
      type: 'new_bid',
      title: '새 입찰이 도착했습니다!',
      body: `${rr.symptom_summary.slice(0, 30)}... 에 대한 견적`,
      data: { requestId, bidId: bid.id },
    })

    return NextResponse.json({
      id: bid.id,
      totalCost: bid.total_cost,
      commissionRate: bid.commission_rate,
      status: bid.status,
      createdAt: bid.created_at,
      updatedAt: bid.updated_at,
    }, { status: 201 })
  } catch (e) {
    console.error('[shop-bids POST]', e)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
