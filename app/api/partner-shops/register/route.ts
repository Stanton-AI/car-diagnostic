import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// POST /api/partner-shops/register — 파트너 신청
export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    // 이미 신청했는지 확인
    const { data: existing } = await supabase
      .from('partner_shops')
      .select('id, status')
      .eq('user_id', user.id)
      .single()

    if (existing) {
      return NextResponse.json({
        error: `이미 파트너 신청이 존재합니다 (상태: ${existing.status})`,
        existingId: existing.id,
      }, { status: 409 })
    }

    const body = await req.json()
    const { name, ownerName, phone, address, categories, description, businessNumber } = body

    if (!name || !ownerName || !phone || !address) {
      return NextResponse.json({ error: '필수 항목 누락 (상호명, 대표자, 전화번호, 주소)' }, { status: 400 })
    }

    const { data, error } = await supabase
      .from('partner_shops')
      .insert({
        user_id: user.id,
        name,
        owner_name: ownerName,
        phone,
        address,
        categories: categories ?? [],
        description: description || null,
        business_number: businessNumber || null,
        status: 'pending',  // 관리자 승인 후 active
      })
      .select('id')
      .single()

    if (error) throw error

    // 관리자에게 알림 (admin 유저 조회)
    const { data: admins } = await supabase
      .from('users')
      .select('id')
      .eq('role', 'admin')

    if (admins && admins.length > 0) {
      await supabase.from('notifications').insert(
        admins.map(admin => ({
          user_id: admin.id,
          type: 'new_request',
          title: '새 파트너 신청',
          body: `${name} (${ownerName}) 님이 파트너 신청을 했습니다`,
          data: { shopId: data.id },
        }))
      )
    }

    return NextResponse.json({ id: data.id, status: 'pending' }, { status: 201 })
  } catch (e) {
    console.error('[partner-shops/register POST]', e)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
