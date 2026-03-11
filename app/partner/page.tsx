'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { getMyShop } from '@/lib/marketplace'
import { formatKRW } from '@/lib/utils'
import type { PartnerShop } from '@/types'

interface DashStats {
  todayRequests: number
  openBids: number
  completedJobs: number
  totalRevenue: number
  pendingBids: number
  unreadNotifications: number
}

interface CalDot {
  date: string
  status: string
}

const STATUS_DOT: Record<string, string> = {
  scheduled:   'bg-blue-400',
  in_progress: 'bg-purple-400',
  completed:   'bg-green-400',
}

const DAY_LABELS = ['일', '월', '화', '수', '목', '금', '토']

function fmtDate(d: Date) {
  return d.toISOString().split('T')[0]
}

function getMonthGrid(year: number, month: number): (Date | null)[] {
  const first = new Date(year, month, 1)
  const last  = new Date(year, month + 1, 0)
  const grid: (Date | null)[] = Array(first.getDay()).fill(null)
  for (let d = 1; d <= last.getDate(); d++) {
    grid.push(new Date(year, month, d))
  }
  while (grid.length % 7 !== 0) grid.push(null)
  return grid
}

export default function PartnerDashboard() {
  const router = useRouter()
  const supabase = createClient()
  const [shop, setShop]   = useState<PartnerShop | null>(null)
  const [stats, setStats] = useState<DashStats | null>(null)
  const [calDots, setCalDots] = useState<CalDot[]>([])
  const [loading, setLoading] = useState(true)

  const today    = new Date()
  const todayStr = fmtDate(today)
  const year     = today.getFullYear()
  const month    = today.getMonth()
  const grid     = getMonthGrid(year, month)

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.replace('/login?redirect=/partner'); return }

      const myShop = await getMyShop(supabase)
      if (!myShop) { router.replace('/partner/register'); return }
      setShop(myShop)

      if (myShop.status === 'pending') { setLoading(false); return }

      const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0)

      const [
        { count: todayReq },
        { count: acceptedBids },
        { data: completedData },
        { count: pendingBids },
        { count: unread },
        { data: rawCalJobs },
      ] = await Promise.all([
        supabase.from('repair_requests')
          .select('*', { count: 'exact', head: true })
          .in('status', ['open', 'bidding'])
          .gte('created_at', todayStart.toISOString()),
        supabase.from('shop_bids')
          .select('*', { count: 'exact', head: true })
          .eq('shop_id', myShop.id).eq('status', 'accepted'),
        // 완료된 수리 — actual_total_cost 없으면 낙찰 금액(total_cost) 사용
        supabase.from('repair_jobs')
          .select('actual_total_cost, shop_bids(total_cost)')
          .eq('shop_id', myShop.id).eq('status', 'completed'),
        supabase.from('shop_bids')
          .select('*', { count: 'exact', head: true })
          .eq('shop_id', myShop.id).eq('status', 'pending'),
        supabase.from('notifications')
          .select('*', { count: 'exact', head: true })
          .eq('shop_id', myShop.id).eq('is_read', false),
        // 캘린더용 — 낙찰/예약/진행/완료
        supabase.from('repair_jobs')
          .select('id, status, created_at, shop_bids(available_date)')
          .eq('shop_id', myShop.id)
          .neq('status', 'cancelled')
          .order('created_at', { ascending: false })
          .limit(100),
      ])

      const totalRevenue = (completedData ?? []).reduce((sum, j) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const cost = j.actual_total_cost ?? (j.shop_bids as any)?.total_cost ?? 0
        return sum + cost
      }, 0)

      setStats({
        todayRequests:      todayReq ?? 0,
        openBids:           acceptedBids ?? 0,
        completedJobs:      completedData?.length ?? 0,
        totalRevenue,
        pendingBids:        pendingBids ?? 0,
        unreadNotifications: unread ?? 0,
      })

      // 캘린더 점
      const dots: CalDot[] = (rawCalJobs ?? []).flatMap(job => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const bid = (job.shop_bids as any)
        const dateStr = bid?.available_date ?? job.created_at?.split('T')[0]
        if (!dateStr) return []
        return [{ date: dateStr, status: job.status }]
      })
      setCalDots(dots)
      setLoading(false)
    }
    load()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const dotsByDate = calDots.reduce<Record<string, CalDot[]>>((acc, d) => {
    if (!acc[d.date]) acc[d.date] = []
    acc[d.date].push(d)
    return acc
  }, {})

  if (loading) return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="w-8 h-8 border-2 border-blue-200 border-t-blue-600 rounded-full animate-spin" />
    </div>
  )

  if (shop?.status === 'pending') {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="text-center max-w-sm">
          <div className="text-5xl mb-4">⏳</div>
          <h1 className="text-xl font-black text-gray-900 mb-2">승인 검토 중</h1>
          <p className="text-sm text-gray-500 mb-6">
            <strong>{shop.name}</strong> 파트너 신청을 검토 중입니다.<br />
            보통 1~2 영업일 내 처리됩니다.
          </p>
          <button onClick={() => router.push('/main')} className="text-sm text-gray-400 hover:text-gray-600">
            홈으로 돌아가기
          </button>
        </div>
      </div>
    )
  }

  const STAT_CARDS = stats ? [
    {
      label: '오늘 새 요청',
      value: stats.todayRequests,
      color: 'text-blue-600',
      bg:    'bg-blue-50',
      icon:  '📋',
      path:  '/partner/requests?tab=new',
      pulse: stats.todayRequests > 0,      // 즉시 확인 필요
    },
    {
      label: '입찰 진행 중',
      value: stats.pendingBids,
      color: 'text-amber-600',
      bg:    'bg-amber-50',
      icon:  '⏳',
      path:  '/partner/requests?tab=bidding',
      pulse: stats.pendingBids > 0,        // 소비자 응답 대기 중
    },
    {
      label: '낙찰 완료',
      value: stats.openBids,
      color: 'text-green-600',
      bg:    'bg-green-50',
      icon:  '✅',
      path:  '/partner/requests?tab=won',
      pulse: false,
    },
    {
      label: '누적 완료 수리',
      value: stats.completedJobs,
      color: 'text-purple-600',
      bg:    'bg-purple-50',
      icon:  '🔧',
      path:  '/partner/jobs',
      pulse: false,
    },
  ] : []

  return (
    <div className="flex flex-col min-h-screen bg-surface-50">
      {/* 헤더 */}
      <header className="bg-white border-b border-gray-100 px-4 pt-14 pb-4 flex items-center gap-3">
        <div className="flex-1">
          <p className="text-xs text-gray-400">파트너 대시보드</p>
          <h1 className="text-lg font-black text-gray-900">{shop?.name}</h1>
        </div>
        <div className="relative">
          <button
            onClick={() => router.push('/partner/requests')}
            className="w-10 h-10 flex items-center justify-center rounded-full bg-gray-100 hover:bg-gray-200 text-gray-600"
          >
            🔔
          </button>
          {(stats?.unreadNotifications ?? 0) > 0 && (
            <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center text-[10px] text-white font-bold">
              {stats!.unreadNotifications}
            </span>
          )}
        </div>
        <button onClick={() => router.push('/main')} className="text-xs text-gray-400 hover:text-gray-600">
          소비자 앱 →
        </button>
      </header>

      <div className="px-4 py-4 space-y-4 pb-8">

        {/* 요약 통계 카드 */}
        <div className="grid grid-cols-2 gap-3">
          {STAT_CARDS.map(item => (
            <button
              key={item.label}
              onClick={() => router.push(item.path)}
              className={`${item.bg} rounded-2xl p-4 text-center hover:brightness-95 active:scale-95 transition-all relative overflow-hidden`}
            >
              {/* 새 항목 펄스 인디케이터 */}
              {item.pulse && (
                <span className="absolute top-2.5 right-2.5 flex h-2.5 w-2.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500" />
                </span>
              )}
              <p className="text-2xl mb-1">{item.icon}</p>
              <p className={`text-2xl font-black ${item.color}`}>{item.value}</p>
              <p className="text-xs text-gray-500 mt-0.5">{item.label}</p>
            </button>
          ))}
        </div>

        {/* 누적 완료 매출 */}
        {stats && (
          <div className="bg-gradient-to-br from-gray-800 to-gray-900 rounded-2xl p-4 text-white">
            <p className="text-xs text-gray-400">누적 완료 매출</p>
            <p className="text-3xl font-black mt-1">{formatKRW(stats.totalRevenue)}</p>
            <p className="text-xs text-gray-400 mt-1">
              평균 {stats.completedJobs > 0 ? formatKRW(Math.round(stats.totalRevenue / stats.completedJobs)) : '0원'} / 건
            </p>
          </div>
        )}

        {/* 예약 캘린더 (이번 달) */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          {/* 헤더 → 전체 캘린더 페이지로 */}
          <button
            className="w-full px-4 pt-4 pb-2 flex items-center justify-between hover:bg-gray-50 transition-colors"
            onClick={() => router.push('/partner/calendar')}
          >
            <div className="text-left">
              <p className="text-sm font-black text-gray-900">📅 예약 캘린더</p>
              <p className="text-xs text-gray-400 mt-0.5">{year}년 {month + 1}월</p>
            </div>
            <span className="text-xs text-primary-600 font-bold flex-shrink-0">전체 보기 →</span>
          </button>

          {/* 요일 헤더 */}
          <div className="grid grid-cols-7 px-2">
            {DAY_LABELS.map((d, i) => (
              <div
                key={d}
                className={`text-center text-[10px] font-bold py-1 ${
                  i === 0 ? 'text-red-400' : i === 6 ? 'text-blue-400' : 'text-gray-400'
                }`}
              >
                {d}
              </div>
            ))}
          </div>

          {/* 날짜 그리드 */}
          <div className="grid grid-cols-7 gap-y-0.5 px-2 pb-3">
            {grid.map((d, idx) => {
              if (!d) return <div key={`empty-${idx}`} />
              const ds      = fmtDate(d)
              const isToday = ds === todayStr
              const dayDots = dotsByDate[ds] ?? []
              const isSun   = d.getDay() === 0
              const isSat   = d.getDay() === 6

              return (
                <button
                  key={ds}
                  onClick={() => router.push('/partner/calendar')}
                  className={`flex flex-col items-center py-1 rounded-lg transition-colors min-h-[40px] ${
                    isToday ? 'bg-primary-50 ring-1 ring-primary-300' : 'hover:bg-gray-50'
                  }`}
                >
                  <span className={`text-xs font-bold leading-none mb-0.5 ${
                    isToday ? 'text-primary-700' :
                    isSun   ? 'text-red-400'     :
                    isSat   ? 'text-blue-400'    :
                    'text-gray-700'
                  }`}>
                    {d.getDate()}
                  </span>
                  {dayDots.length > 0 && (
                    <div className="flex gap-0.5 flex-wrap justify-center px-0.5">
                      {dayDots.slice(0, 3).map((dot, i) => (
                        <span
                          key={i}
                          className={`w-1 h-1 rounded-full flex-shrink-0 ${STATUS_DOT[dot.status] ?? 'bg-gray-300'}`}
                        />
                      ))}
                      {dayDots.length > 3 && (
                        <span className="text-[7px] font-bold text-gray-400 leading-none">+{dayDots.length - 3}</span>
                      )}
                    </div>
                  )}
                </button>
              )
            })}
          </div>

          {/* 범례 */}
          <div className="flex gap-4 px-4 py-2 border-t border-gray-50">
            <div className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-blue-400" />
              <span className="text-[10px] text-gray-400">예약</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-purple-400" />
              <span className="text-[10px] text-gray-400">수리중</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-green-400" />
              <span className="text-[10px] text-gray-400">완료</span>
            </div>
          </div>
        </div>

      </div>
    </div>
  )
}
