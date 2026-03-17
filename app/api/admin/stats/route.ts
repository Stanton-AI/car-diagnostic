import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { verifyAdmin } from '../_lib'
import { parseCategoryHierarchy, MAJOR_CATEGORIES, type MajorCategory } from '@/lib/categoryTaxonomy'

export async function GET() {
  if (!await verifyAdmin()) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const service = createServiceClient()
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const weekAgo = new Date(today); weekAgo.setDate(weekAgo.getDate() - 6)
  const monthAgo = new Date(today); monthAgo.setDate(monthAgo.getDate() - 29)

  const [
    { count: total, error: e1 },
    { count: todayCount, error: e2 },
    { data: rows, error: e3 },
    // 가입자
    { count: totalUsers, error: e4 },
    { count: todayUsers, error: e5 },
    { count: weekUsers, error: e6 },
    { data: userRows, error: e7 },
    // 차량
    { data: vehicleRows, error: e8 },
  ] = await Promise.all([
    service.from('conversations').select('*', { count: 'exact', head: true }).not('final_result', 'is', null),
    service.from('conversations').select('*', { count: 'exact', head: true }).gte('created_at', today.toISOString()).not('final_result', 'is', null),
    service.from('conversations').select('urgency, category').not('final_result', 'is', null),
    // 가입자 전체 (admin 제외)
    service.from('users').select('*', { count: 'exact', head: true }).eq('role', 'user'),
    // 오늘 신규
    service.from('users').select('*', { count: 'exact', head: true }).gte('created_at', today.toISOString()).eq('role', 'user'),
    // 7일 신규
    service.from('users').select('*', { count: 'exact', head: true }).gte('created_at', weekAgo.toISOString()).eq('role', 'user'),
    // 월별 가입자 추이 (최근 30일)
    service.from('users').select('created_at').eq('role', 'user').gte('created_at', monthAgo.toISOString()).order('created_at'),
    // 차량 연식·주행거리·연료타입
    service.from('vehicles').select('year, mileage, fuel_type'),
  ])

  if (e1 || e2 || e3) {
    console.error('[admin/stats] diagnosis errors:', JSON.stringify({ e1, e2, e3 }))
    return NextResponse.json({ error: 'DB query failed', details: { e1, e2, e3 } }, { status: 500 })
  }

  // ── 진단 통계 ──────────────────────────────────────────────
  const urgencyBreakdown = { HIGH: 0, MID: 0, LOW: 0 }
  const majorBreakdown: Record<MajorCategory, number> = Object.fromEntries(
    MAJOR_CATEGORIES.map(m => [m, 0])
  ) as Record<MajorCategory, number>
  const subBreakdown: Record<string, number> = {}

  for (const row of rows ?? []) {
    if (row.urgency && row.urgency in urgencyBreakdown)
      urgencyBreakdown[row.urgency as keyof typeof urgencyBreakdown]++
    const { major, sub } = parseCategoryHierarchy(row.category)
    majorBreakdown[major] = (majorBreakdown[major] ?? 0) + 1
    const subKey = `${major} > ${sub}`
    subBreakdown[subKey] = (subBreakdown[subKey] ?? 0) + 1
  }

  // ── 가입자 추이 (일별) ──────────────────────────────────────
  const dailySignup: Record<string, number> = {}
  for (let i = 6; i >= 0; i--) {
    const d = new Date(today); d.setDate(d.getDate() - i)
    dailySignup[d.toISOString().slice(0, 10)] = 0
  }
  for (const u of userRows ?? []) {
    const day = u.created_at.slice(0, 10)
    if (day in dailySignup) dailySignup[day]++
  }

  // ── 차량 통계 ───────────────────────────────────────────────
  const vehicles = vehicleRows ?? []

  // 연식 구간
  const yearBands = {
    '2020년 이후': 0,
    '2015~2019년': 0,
    '2010~2014년': 0,
    '2009년 이하': 0,
    '미등록': 0,
  }
  for (const v of vehicles) {
    const y = v.year
    if (!y) yearBands['미등록']++
    else if (y >= 2020) yearBands['2020년 이후']++
    else if (y >= 2015) yearBands['2015~2019년']++
    else if (y >= 2010) yearBands['2010~2014년']++
    else yearBands['2009년 이하']++
  }

  // 주행거리 구간
  const mileageBands = {
    '3만km 미만': 0,
    '3~7만km': 0,
    '7~12만km': 0,
    '12~20만km': 0,
    '20만km 초과': 0,
    '미등록': 0,
  }
  for (const v of vehicles) {
    const m = v.mileage
    if (m == null) mileageBands['미등록']++
    else if (m < 30000) mileageBands['3만km 미만']++
    else if (m < 70000) mileageBands['3~7만km']++
    else if (m < 120000) mileageBands['7~12만km']++
    else if (m < 200000) mileageBands['12~20만km']++
    else mileageBands['20만km 초과']++
  }

  // 연료 타입
  const fuelBreakdown: Record<string, number> = {}
  const FUEL_LABEL: Record<string, string> = {
    gasoline: '가솔린', diesel: '디젤', hybrid: '하이브리드', electric: '전기', lpg: 'LPG',
  }
  for (const v of vehicles) {
    const label = FUEL_LABEL[v.fuel_type] ?? v.fuel_type ?? '미등록'
    fuelBreakdown[label] = (fuelBreakdown[label] ?? 0) + 1
  }

  return NextResponse.json({
    // 진단
    totalDiagnoses: total ?? 0,
    todayDiagnoses: todayCount ?? 0,
    urgencyBreakdown,
    majorBreakdown,
    subBreakdown,
    // 가입자
    users: {
      total: totalUsers ?? 0,
      today: todayUsers ?? 0,
      week: weekUsers ?? 0,
      daily: dailySignup,
    },
    // 차량
    vehicles: {
      total: vehicles.length,
      yearBands,
      mileageBands,
      fuelBreakdown,
    },
  })
}
