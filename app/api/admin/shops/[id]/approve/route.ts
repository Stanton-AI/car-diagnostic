import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { verifyAdmin } from '../../../_lib'

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  if (!await verifyAdmin()) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { approve } = await req.json()
  const service = createServiceClient()

  const { error } = await service.from('partner_shops').update({
    status: approve ? 'active' : 'suspended',
    updated_at: new Date().toISOString(),
  }).eq('id', params.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
