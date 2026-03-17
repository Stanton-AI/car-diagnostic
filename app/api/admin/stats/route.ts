import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { verifyAdmin } from '../_lib'

export async function GET() {
  if (!await verifyAdmin()) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const service = createServiceClient()
  const today = new Date(); today.setHours(0, 0, 0, 0)

  const [{ count: total }, { count: todayCount }, { data: rows }] = await Promise.all([
    service.from('conversations').select('*', { count: 'exact', head: true }).not('final_result', 'is', null),
    service.from('conversations').select('*', { count: 'exact', head: true }).gte('created_at', today.toISOString()).not('final_result', 'is', null),
    service.from('conversations').select('urgency, category').not('final_result', 'is', null),
  ])

  const urgencyBreakdown = { HIGH: 0, MID: 0, LOW: 0 }
  const categoryBreakdown: Record<string, number> = {}
  for (const row of rows ?? []) {
    if (row.urgency && row.urgency in urgencyBreakdown)
      urgencyBreakdown[row.urgency as keyof typeof urgencyBreakdown]++
    if (row.category)
      categoryBreakdown[row.category] = (categoryBreakdown[row.category] ?? 0) + 1
  }

  return NextResponse.json({ totalDiagnoses: total ?? 0, todayDiagnoses: todayCount ?? 0, urgencyBreakdown, categoryBreakdown })
}
