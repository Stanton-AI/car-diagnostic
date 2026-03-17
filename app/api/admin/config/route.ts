import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { verifyAdmin } from '../_lib'

export async function POST(req: NextRequest) {
  if (!await verifyAdmin()) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await req.json()
  const service = createServiceClient()

  const { error } = await service.from('admin_config').update({
    diagnosis_mode: body.diagnosis_mode,
    free_users_ratio: body.free_users_ratio,
    guest_max_diagnosis: body.guest_max_diagnosis,
    user_daily_limit: body.user_daily_limit,
    maintenance_banner: body.maintenance_banner || null,
    updated_at: new Date().toISOString(),
  }).eq('id', 1)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
