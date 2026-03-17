import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { verifyAdmin } from '../_lib'
import { parseCategoryHierarchy, MAJOR_CATEGORIES, type MajorCategory } from '@/lib/categoryTaxonomy'

export async function GET() {
  if (!await verifyAdmin()) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const service = createServiceClient()
  const today = new Date(); today.setHours(0, 0, 0, 0)

  const [
    { count: total, error: e1 },
    { count: todayCount, error: e2 },
    { data: rows, error: e3 },
  ] = await Promise.all([
    service.from('conversations').select('*', { count: 'exact', head: true }).not('final_result', 'is', null),
    service.from('conversations').select('*', { count: 'exact', head: true }).gte('created_at', today.toISOString()).not('final_result', 'is', null),
    service.from('conversations').select('urgency, category').not('final_result', 'is', null),
  ])

  if (e1 || e2 || e3) {
    console.error('[admin/stats] Supabase errors:', JSON.stringify({ e1, e2, e3 }))
    return NextResponse.json(
      { error: 'DB query failed', details: { e1, e2, e3 } },
      { status: 500 }
    )
  }

  // 긴급도 분석
  const urgencyBreakdown = { HIGH: 0, MID: 0, LOW: 0 }

  // 대분류 카운트
  const majorBreakdown: Record<MajorCategory, number> = Object.fromEntries(
    MAJOR_CATEGORIES.map(m => [m, 0])
  ) as Record<MajorCategory, number>

  // 중분류 카운트
  const subBreakdown: Record<string, number> = {}

  for (const row of rows ?? []) {
    if (row.urgency && row.urgency in urgencyBreakdown)
      urgencyBreakdown[row.urgency as keyof typeof urgencyBreakdown]++

    const { major, sub } = parseCategoryHierarchy(row.category)
    majorBreakdown[major] = (majorBreakdown[major] ?? 0) + 1
    const subKey = `${major} > ${sub}`
    subBreakdown[subKey] = (subBreakdown[subKey] ?? 0) + 1
  }

  return NextResponse.json({
    totalDiagnoses: total ?? 0,
    todayDiagnoses: todayCount ?? 0,
    urgencyBreakdown,
    majorBreakdown,
    subBreakdown,
  })
}
