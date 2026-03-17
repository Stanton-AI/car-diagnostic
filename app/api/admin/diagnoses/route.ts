import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { verifyAdmin } from '../_lib'

export async function GET() {
  if (!await verifyAdmin()) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const service = createServiceClient()
  const { data, count } = await service
    .from('conversations')
    .select('id, created_at, urgency, category, user_id', { count: 'exact' })
    .not('final_result', 'is', null)
    .order('created_at', { ascending: false })
    .limit(100)

  // 2-step: join with public.users
  const userIds = Array.from(new Set((data ?? []).map(r => r.user_id).filter(Boolean)))
  const { data: users } = userIds.length > 0
    ? await service.from('users').select('id, display_name, email').in('id', userIds)
    : { data: [] }

  const userMap: Record<string, { display_name: string | null; email: string | null }> = {}
  for (const u of users ?? []) userMap[u.id] = u

  const result = (data ?? []).map(r => ({
    ...r,
    users: r.user_id ? userMap[r.user_id] ?? null : null,
  }))

  return NextResponse.json({ data: result, count: count ?? 0 })
}

export async function DELETE(req: NextRequest) {
  if (!await verifyAdmin()) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { id } = await req.json()
  const service = createServiceClient()
  const { error } = await service.from('conversations').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ success: true })
}
