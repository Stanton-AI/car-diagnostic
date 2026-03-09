import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const { data, error } = await supabase
      .from('conversations')
      .select('id, initial_symptom, category, urgency, cost_min, cost_max, created_at, updated_at')
      .eq('user_id', user.id)
      .order('updated_at', { ascending: false })
      .limit(20)

    if (error) throw error

    return NextResponse.json({ success: true, data })
  } catch (error) {
    console.error('Conversations API error:', error)
    return NextResponse.json(
      { success: false, error: '대화 목록 조회 중 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    const { searchParams } = new URL(req.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json({ success: false, error: 'ID required' }, { status: 400 })
    }

    let query = supabase.from('conversations').delete().eq('id', id)

    if (user) {
      // 로그인 사용자: user_id 일치 확인
      query = query.eq('user_id', user.id)
    } else {
      // 게스트: guest_session_id 일치 확인
      const guestSessionId = req.headers.get('x-guest-session-id')
      if (!guestSessionId) {
        return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
      }
      query = query.eq('guest_session_id', guestSessionId)
    }

    const { error } = await query
    if (error) throw error

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Delete conversation error:', error)
    return NextResponse.json(
      { success: false, error: '삭제 중 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}
