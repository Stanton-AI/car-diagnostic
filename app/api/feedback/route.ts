import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/server'

export async function POST(req: NextRequest) {
  const { content, page, phone } = await req.json()

  if (!content || typeof content !== 'string' || content.trim().length < 5) {
    return NextResponse.json({ error: '내용을 5자 이상 입력해주세요.' }, { status: 400 })
  }

  // 로그인 여부 확인 (비로그인도 허용)
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const service = createServiceClient()
  const { error } = await service.from('feedback').insert({
    user_id: user?.id ?? null,
    page: page ?? null,
    content: content.trim(),
    phone: phone?.trim() || null,
  })

  if (error) {
    console.error('[feedback] insert error:', error.message)
    return NextResponse.json({ error: '저장 실패. 잠시 후 다시 시도해주세요.' }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
