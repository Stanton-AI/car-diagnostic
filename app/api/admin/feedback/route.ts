import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { verifyAdmin } from '../_lib'

export async function GET() {
  if (!await verifyAdmin()) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const service = createServiceClient()

  // 1단계: feedback 목록 조회 (auth.users FK 때문에 JOIN 불가 → 별도 쿼리)
  const { data: feedbackRows, error } = await service
    .from('feedback')
    .select('id, content, page, phone, created_at, user_id')
    .order('created_at', { ascending: false })
    .limit(200)

  if (error) {
    console.error('[admin/feedback] error:', error.message)
    return NextResponse.json([])
  }

  // 2단계: 로그인 사용자의 user_id로 public.users에서 이름·이메일 조회
  const userIds = Array.from(new Set((feedbackRows ?? []).map(f => f.user_id).filter(Boolean)))
  let userMap: Record<string, { display_name: string | null; email: string | null }> = {}

  if (userIds.length > 0) {
    const { data: users } = await service
      .from('users')
      .select('id, display_name, email')
      .in('id', userIds)
    for (const u of users ?? []) {
      userMap[u.id] = { display_name: u.display_name, email: u.email }
    }
  }

  // 3단계: 병합
  const result = (feedbackRows ?? []).map(f => ({
    ...f,
    users: f.user_id ? (userMap[f.user_id] ?? null) : null,
  }))

  return NextResponse.json(result)
}

export async function DELETE(req: NextRequest) {
  if (!await verifyAdmin()) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { id } = await req.json()
  const service = createServiceClient()
  await service.from('feedback').delete().eq('id', id)
  return NextResponse.json({ success: true })
}
