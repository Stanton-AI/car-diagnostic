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
