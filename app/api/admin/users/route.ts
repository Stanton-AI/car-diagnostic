import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { verifyAdmin } from '../_lib'

export async function GET() {
  if (!await verifyAdmin()) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const service = createServiceClient()
  const { data, count } = await service
    .from('users')
    .select('id, display_name, email, provider, created_at', { count: 'exact' })
    .eq('role', 'user')
    .order('created_at', { ascending: false })
    .limit(100)

  return NextResponse.json({ data: data ?? [], count: count ?? 0 })
}

export async function DELETE(req: NextRequest) {
  if (!await verifyAdmin()) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { id } = await req.json()
  const service = createServiceClient()
  const { error } = await service.from('users').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ success: true })
}
