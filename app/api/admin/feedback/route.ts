import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { verifyAdmin } from '../_lib'

export async function GET() {
  if (!await verifyAdmin()) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const service = createServiceClient()
  const { data, error } = await service
    .from('feedback')
    .select('id, content, page, created_at, user_id')
    .order('created_at', { ascending: false })
    .limit(200)

  // feedback 테이블이 아직 생성되지 않은 경우 빈 배열 반환
  if (error) {
    console.error('[admin/feedback] error:', error.message)
    return NextResponse.json([])
  }
  return NextResponse.json(data ?? [])
}

export async function DELETE(req: NextRequest) {
  if (!await verifyAdmin()) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { id } = await req.json()
  const service = createServiceClient()
  await service.from('feedback').delete().eq('id', id)
  return NextResponse.json({ success: true })
}
