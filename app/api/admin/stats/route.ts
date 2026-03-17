import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { verifyAdmin } from '../_lib'
import { parseCategoryHierarchy, MAJOR_CATEGORIES, type MajorCategory } from '@/lib/categoryTaxonomy'

const KST_OFFSET = 9 * 60 * 60 * 1000 // UTC+9

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
    { count: totalUsers },
    { count: todayUsers },
    { count: weekUsers },
    { data: userRows },
    // 차량
    { data: vehicleRows },
    // 결제 전환 의향
    { count: paymentInterestTotal },
    { count: paymentInterestWeek },
    { data: paymentRows },
    // 시간대별 진단 (전체)
    { data: diagTimeRows },
    // 세션 (유입경로)
    { data: sessionRows },
  ] = await Promise.all([
    service.from('conversations').select('*', { count: 'exact', head: true }).not('final_result', 'is', null),
    service.from('conversations').select('*', { count: 'exact', head: true }).gte('created_at', today.toISOString()).not('final_result', 'is', null),
    service.from('conversations').select('urgency, category').not('final_result', 'is', null),
    service.from('users').select('*', { count: 'exact', head: true }).eq('role', 'user'),
    service.from('users').select('*', { count: 'exact', head: true }).gte('created_at', today.toISOString()).eq('role', 'user'),
    service.from('users').select('*', { count: 'exact', head: true }).gte('created_at', weekAgo.toISOString()).eq('role', 'user'),
    service.from('users').select('created_at, provider').eq('role', 'user').gte('created_at', monthAgo.toISOString()).order('created_at'),
    service.from('vehicles').select('year, mileage, fuel_type'),
    // 결제 의향 전체
    service.from('payment_interest').select('*', { count: 'exact', head: true }),
    // 결제 의향 7일
    service.from('payment_interest').select('*', { count: 'exact', head: true }).gte('created_at', weekAgo.toISOString()),
    // 결제 의향 상세 (plan별)
    service.from('payment_interest').select('plan, source, created_at').order('created_at', { ascending: false }),
    // 시간대별 진단 (최근 30일)
    service.from('conversations').select('created_at').not('final_result', 'is', null).gte('created_at', monthAgo.toISOString()),
    // 세션 (유입경로, 최근 30일) - 테이블 없으면 null
    service.from('app_sessions').select('source, referrer, utm_source, created_at').gte('created_at', monthAgo.toISOString()).limit(2000),
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

  // ── 가입자 추이 (일별 7일) ──────────────────────────────────
  const dailySignup: Record<string, number> = {}
  for (let i = 6; i >= 0; i--) {
    const d = new Date(today); d.setDate(d.getDate() - i)
    dailySignup[d.toISOString().slice(0, 10)] = 0
  }
  // 가입 경로 (provider)
  const providerBreakdown: Record<string, number> = {}
  const PROVIDER_LABEL: Record<string, string> = {
    google: '구글', kakao: '카카오', email: '이메일', github: 'GitHub',
  }
  for (const u of userRows ?? []) {
    const day = u.created_at.slice(0, 10)
    if (day in dailySignup) dailySignup[day]++
    const label = PROVIDER_LABEL[u.provider] ?? u.provider ?? '기타'
    providerBreakdown[label] = (providerBreakdown[label] ?? 0) + 1
  }
  // 전체 provider 포함
  const { data: allUsers } = await service.from('users').select('provider').eq('role', 'user')
  const allProviderBreakdown: Record<string, number> = {}
  for (const u of allUsers ?? []) {
    const label = PROVIDER_LABEL[u.provider] ?? u.provider ?? '기타'
    allProviderBreakdown[label] = (allProviderBreakdown[label] ?? 0) + 1
  }

  // ── 시간대별 진단 현황 (KST, 0~23시) ───────────────────────
  const hourlyDiag: number[] = Array(24).fill(0)
  for (const r of diagTimeRows ?? []) {
    const kstHour = new Date(new Date(r.created_at).getTime() + KST_OFFSET).getUTCHours()
    hourlyDiag[kstHour]++
  }

  // ── 유입경로 (세션 기반, 없으면 빈 객체) ───────────────────
  const sourceBreakdown: Record<string, number> = {}
  const SOURCE_LABEL: Record<string, string> = {
    direct: '직접 방문', kakao: '카카오', instagram: '인스타그램',
    naver: '네이버', google: '구글', facebook: '페이스북', other: '기타',
  }
  for (const s of sessionRows ?? []) {
    const label = SOURCE_LABEL[s.source] ?? s.source ?? '기타'
    sourceBreakdown[label] = (sourceBreakdown[label] ?? 0) + 1
  }
  // 세션 일별 추이 (7일)
  const dailySession: Record<string, number> = {}
  for (let i = 6; i >= 0; i--) {
    const d = new Date(today); d.setDate(d.getDate() - i)
    dailySession[d.toISOString().slice(0, 10)] = 0
  }
  for (const s of sessionRows ?? []) {
    const day = s.created_at.slice(0, 10)
    if (day in dailySession) dailySession[day]++
  }

  // '직접방문' 중 실제 referrer URL이 있는 경우 → 도메인별 분류
  const unknownReferrerBreakdown: Record<string, number> = {}
  for (const s of sessionRows ?? []) {
    if (s.source === 'direct' && s.referrer) {
      try {
        const domain = new URL(s.referrer).hostname.replace(/^www\./, '')
        unknownReferrerBreakdown[domain] = (unknownReferrerBreakdown[domain] ?? 0) + 1
      } catch { /* 잘못된 URL 무시 */ }
    }
  }

  // ── 결제 전환 의향 ──────────────────────────────────────────
  const planBreakdown: Record<string, number> = {}
  for (const p of paymentRows ?? []) {
    const plan = p.plan ?? 'unknown'
    planBreakdown[plan] = (planBreakdown[plan] ?? 0) + 1
  }

  // ── 차량 통계 ───────────────────────────────────────────────
  const vehicles = vehicleRows ?? []
  const CURRENT_YEAR = new Date().getFullYear()
  const yearBands = {
    '1~3년차 (신차급)': 0, '4~7년차': 0,
    '8~12년차': 0, '13년차 이상 (고연식)': 0, '미등록': 0,
  }
  for (const v of vehicles) {
    const y = v.year
    if (!y) { yearBands['미등록']++; continue }
    const age = CURRENT_YEAR - y
    if (age <= 3) yearBands['1~3년차 (신차급)']++
    else if (age <= 7) yearBands['4~7년차']++
    else if (age <= 12) yearBands['8~12년차']++
    else yearBands['13년차 이상 (고연식)']++
  }
  const mileageBands = {
    '3만km 미만': 0, '3~7만km': 0, '7~12만km': 0,
    '12~20만km': 0, '20만km 초과': 0, '미등록': 0,
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
  const fuelBreakdown: Record<string, number> = {}
  const FUEL_LABEL: Record<string, string> = {
    gasoline: '가솔린', diesel: '디젤', hybrid: '하이브리드', electric: '전기', lpg: 'LPG',
  }
  for (const v of vehicles) {
    const label = FUEL_LABEL[v.fuel_type] ?? v.fuel_type ?? '미등록'
    fuelBreakdown[label] = (fuelBreakdown[label] ?? 0) + 1
  }

  return NextResponse.json({
    totalDiagnoses: total ?? 0,
    todayDiagnoses: todayCount ?? 0,
    urgencyBreakdown, majorBreakdown, subBreakdown,
    users: {
      total: totalUsers ?? 0, today: todayUsers ?? 0, week: weekUsers ?? 0,
      daily: dailySignup,
      providerBreakdown: allProviderBreakdown,
    },
    vehicles: { total: vehicles.length, yearBands, mileageBands, fuelBreakdown },
    paymentInterest: {
      total: paymentInterestTotal ?? 0,
      week: paymentInterestWeek ?? 0,
      planBreakdown,
    },
    traffic: {
      hourlyDiag,
      sourceBreakdown,
      dailySession,
      unknownReferrerBreakdown,
      hasSessionData: (sessionRows ?? []).length > 0,
    },
  })
}
