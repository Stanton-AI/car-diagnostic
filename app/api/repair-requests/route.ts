import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// GET /api/repair-requests — 내 요청 목록
export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data, error } = await supabase
      .from('repair_requests')
      .select('*, shop_bids(*, partner_shops(name, rating, address, phone))')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })

    if (error) throw error
    return NextResponse.json(data)
  } catch (e) {
    console.error('[repair-requests GET]', e)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}

// POST /api/repair-requests — 새 견적 요청 생성
export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await req.json()
    const {
      conversationId,
      symptomSummary,
      diagnosisCategory,
      urgencyLevel,
      dealerPartsMin,
      dealerPartsMax,
      dealerLaborMin,
      dealerLaborMax,
      contactPhone,
      preferredLocation,
      preferredDate,
      consumerNotes,
      vehicleMaker,
      vehicleModel,
      vehicleYear,
      vehicleMileage,
    } = body

    if (!symptomSummary || !preferredLocation) {
      return NextResponse.json({ error: '필수 항목 누락' }, { status: 400 })
    }

    const { data, error } = await supabase
      .from('repair_requests')
      .insert({
        user_id: user.id,
        conversation_id: conversationId || null,
        symptom_summary: symptomSummary,
        diagnosis_category: diagnosisCategory || null,
        urgency_level: urgencyLevel || null,
        dealer_parts_min: dealerPartsMin || null,
        dealer_parts_max: dealerPartsMax || null,
        dealer_labor_min: dealerLaborMin || null,
        dealer_labor_max: dealerLaborMax || null,
        contact_phone: contactPhone || null,
        preferred_location: preferredLocation,
        preferred_date: preferredDate || null,
        consumer_notes: consumerNotes || null,
        vehicle_maker: vehicleMaker || null,
        vehicle_model: vehicleModel || null,
        vehicle_year: vehicleYear || null,
        vehicle_mileage: vehicleMileage || null,
      })
      .select('id')
      .single()

    if (error) throw error

    // 파트너 정비소에 알림 발송 (same 카테고리 활성 정비소)
    if (diagnosisCategory) {
      const { data: shops } = await supabase
        .from('partner_shops')
        .select('id, user_id')
        .eq('status', 'active')
        .contains('categories', [diagnosisCategory])
        .limit(20)

      if (shops && shops.length > 0) {
        await supabase.from('notifications').insert(
          shops.map(shop => ({
            shop_id: shop.id,
            type: 'new_request',
            title: '새 수리 견적 요청이 도착했습니다',
            body: symptomSummary.slice(0, 60),
            data: { requestId: data.id, category: diagnosisCategory },
          }))
        )
      }
    }

    return NextResponse.json({ id: data.id }, { status: 201 })
  } catch (e: any) {
    console.error('[repair-requests POST]', e)
    return NextResponse.json({ error: 'Server error', detail: e?.message ?? String(e) }, { status: 500 })
  }
}
