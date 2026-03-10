import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

interface FeedbackBody {
  repair_name: string      // "워터펌프 교체"
  actual_cost?: number     // 250000
  ai_correct?: boolean     // AI가 맞췄는지
  notes?: string           // 추가 메모
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    const body: FeedbackBody = await req.json()

    if (!body.repair_name?.trim()) {
      return NextResponse.json({ success: false, error: '수리 내역을 입력해 주세요.' }, { status: 400 })
    }

    const actual_repair = {
      repair_name: body.repair_name.trim(),
      actual_cost: body.actual_cost ?? null,
      ai_correct: body.ai_correct ?? null,
      notes: body.notes?.trim() ?? null,
      submitted_at: new Date().toISOString(),
    }

    // 본인 대화만 업데이트 가능
    let query = supabase
      .from('conversations')
      .update({ actual_repair })
      .eq('id', id)

    if (user) {
      query = query.eq('user_id', user.id)
    } else {
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
    console.error('Feedback API error:', error)
    return NextResponse.json(
      { success: false, error: '피드백 저장 중 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}
