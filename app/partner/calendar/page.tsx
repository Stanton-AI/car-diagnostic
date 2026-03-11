'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { getMyShop } from '@/lib/marketplace'
import { formatKRW } from '@/lib/utils'

interface CalendarJob {
  id: string
  jobId: string
  date: string       // YYYY-MM-DD
  time: string
  symptom: string
  vehicle: string
  status: string
  totalCost: number
}

const STATUS_COLOR: Record<string, string> = {
  scheduled:   'bg-blue-100 text-blue-700 border-blue-200',
  in_progress: 'bg-purple-100 text-purple-700 border-purple-200',
  completed:   'bg-green-100 text-green-700 border-green-200',
}
const STATUS_LABEL: Record<string, string> = {
  scheduled:   '예약',
  in_progress: '수리중',
  completed:   '완료',
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

/** 해당 월의 달력 그리드 (빈칸 포함, 6주 × 7일) */
function getMonthGrid(year: number, month: number): (Date | null)[] {
  const first = new Date(year, month, 1)
  const last  = new Date(year, month + 1, 0)
  const startOffset = first.getDay() // 0=일
  const totalDays = last.getDate()
  const grid: (Date | null)[] = Array(startOffset).fill(null)
  for (let d = 1; d <= totalDays; d++) {
    grid.push(new Date(year, month, d))
  }
  // 6행 맞추기
  while (grid.length % 7 !== 0) grid.push(null)
  return grid
}

export default function PartnerCalendarPage() {
  const router = useRouter()
  const supabase = createClient()

  const today = new Date()
  const todayStr = fmtDate(today)

  const [jobs, setJobs] = useState<CalendarJob[]>([])
  const [loading, setLoading] = useState(true)
  const [year, setYear] = useState(today.getFullYear())
  const [month, setMonth] = useState(today.getMonth()) // 0-indexed
  const [selectedDate, setSelectedDate] = useState(todayStr)

  useEffect(() => {
    const load = async () => {
      const shop = await getMyShop(supabase)
      if (!shop || shop.status !== 'active') { router.replace('/partner'); return }

      const { data: rawJobs } = await supabase
        .from('repair_jobs')
        .select(`
          id, status, created_at,
          shop_bids(available_date, available_time, total_cost),
          repair_requests(symptom_summary, vehicle_maker, vehicle_model)
        `)
        .eq('shop_id', shop.id)
        .neq('status', 'cancelled')
        .order('created_at', { ascending: false })
        .limit(100)

      const mapped: CalendarJob[] = (rawJobs ?? []).flatMap(job => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const bid = (job.shop_bids as any)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const rr  = (job.repair_requests as any)
        const dateStr = bid?.available_date ?? job.created_at?.split('T')[0]
        if (!dateStr) return []
        return [{
          id: `${job.id}-${dateStr}`,
          jobId: job.id,
          date: dateStr,
          time: bid?.available_time ?? '종일',
          symptom: rr?.symptom_summary?.slice(0, 40) ?? '수리 요청',
          vehicle: rr?.vehicle_maker ? `${rr.vehicle_maker} ${rr.vehicle_model ?? ''}`.trim() : '차량 미지정',
          status: job.status,
          totalCost: bid?.total_cost ?? 0,
        }]
      })

      setJobs(mapped)
      setLoading(false)
    }
    load()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const goMonth = (dir: number) => {
    let m = month + dir
    let y = year
    if (m < 0)  { m = 11; y-- }
    if (m > 11) { m = 0;  y++ }
    setMonth(m)
    setYear(y)
  }

  const grid = getMonthGrid(year, month)

  // 날짜별 작업 수 & 상태
  const jobsByDate = jobs.reduce<Record<string, CalendarJob[]>>((acc, j) => {
    if (!acc[j.date]) acc[j.date] = []
    acc[j.date].push(j)
    return acc
  }, {})

  const selectedJobs = jobsByDate[selectedDate] ?? []

  // 이번 달 통계
  const monthStr = `${year}-${String(month + 1).padStart(2, '0')}`
  const monthJobs = jobs.filter(j => j.date.startsWith(monthStr))
  const monthScheduled  = monthJobs.filter(j => j.status === 'scheduled').length
  const monthInProgress = monthJobs.filter(j => j.status === 'in_progress').length
  const monthCompleted  = monthJobs.filter(j => j.status === 'completed').length

  if (loading) return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="w-8 h-8 border-2 border-primary-200 border-t-primary-600 rounded-full animate-spin" />
    </div>
  )

  return (
    <div className="flex flex-col min-h-screen bg-surface-50">
      <header className="bg-white px-4 pt-14 pb-4 flex items-center gap-3 border-b border-gray-100">
        <button onClick={() => router.push('/partner')} className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-500">←</button>
        <h1 className="text-lg font-black text-gray-900">예약 캘린더</h1>
      </header>

      {/* 월간 캘린더 */}
      <div className="bg-white border-b border-gray-100 px-4 pt-4 pb-3">

        {/* 월 이동 */}
        <div className="flex items-center justify-between mb-3">
          <button onClick={() => goMonth(-1)} className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-500 text-lg">‹</button>
          <div className="text-center">
            <p className="text-base font-black text-gray-900">{year}년 {month + 1}월</p>
            {monthJobs.length > 0 && (
              <p className="text-xs text-gray-400 mt-0.5">총 {monthJobs.length}건</p>
            )}
          </div>
          <button onClick={() => goMonth(1)} className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-500 text-lg">›</button>
        </div>

        {/* 요일 헤더 */}
        <div className="grid grid-cols-7 mb-1">
          {DAY_LABELS.map((d, i) => (
            <div key={d} className={`text-center text-xs font-bold py-1 ${i === 0 ? 'text-red-400' : i === 6 ? 'text-blue-400' : 'text-gray-400'}`}>
              {d}
            </div>
          ))}
        </div>

        {/* 날짜 그리드 */}
        <div className="grid grid-cols-7 gap-y-1">
          {grid.map((d, idx) => {
            if (!d) return <div key={`empty-${idx}`} />
            const ds = fmtDate(d)
            const isToday    = ds === todayStr
            const isSelected = ds === selectedDate
            const dayJobs    = jobsByDate[ds] ?? []
            const isSun = d.getDay() === 0
            const isSat = d.getDay() === 6

            return (
              <button
                key={ds}
                onClick={() => setSelectedDate(ds)}
                className={`flex flex-col items-center py-1.5 rounded-xl transition-colors min-h-[52px] ${
                  isSelected ? 'bg-primary-600' :
                  isToday    ? 'bg-primary-50 ring-1 ring-primary-300' :
                  'hover:bg-gray-50'
                }`}
              >
                <span className={`text-sm font-bold leading-none mb-1 ${
                  isSelected ? 'text-white' :
                  isToday    ? 'text-primary-700' :
                  isSun      ? 'text-red-400' :
                  isSat      ? 'text-blue-400' :
                  'text-gray-700'
                }`}>
                  {d.getDate()}
                </span>

                {/* 작업 점 표시 (최대 3개) */}
                {dayJobs.length > 0 && (
                  <div className="flex gap-0.5 flex-wrap justify-center px-1">
                    {dayJobs.slice(0, 3).map((j, i) => (
                      <span
                        key={i}
                        className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                          isSelected ? 'bg-white/70' : (STATUS_DOT[j.status] ?? 'bg-gray-300')
                        }`}
                      />
                    ))}
                    {dayJobs.length > 3 && (
                      <span className={`text-[8px] font-bold leading-none mt-0.5 ${isSelected ? 'text-white/70' : 'text-gray-400'}`}>
                        +{dayJobs.length - 3}
                      </span>
                    )}
                  </div>
                )}
              </button>
            )
          })}
        </div>

        {/* 월 통계 */}
        <div className="flex gap-3 mt-3 pt-3 border-t border-gray-50">
          <div className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-blue-400" />
            <span className="text-xs text-gray-500">예약 {monthScheduled}</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-purple-400" />
            <span className="text-xs text-gray-500">수리중 {monthInProgress}</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-green-400" />
            <span className="text-xs text-gray-500">완료 {monthCompleted}</span>
          </div>
        </div>
      </div>

      {/* 선택일 일정 */}
      <div className="px-4 py-4 flex-1">
        <div className="flex items-center justify-between mb-3">
          <p className="text-sm font-bold text-gray-700">
            {selectedDate === todayStr ? '오늘 ' : ''}
            {new Date(selectedDate + 'T00:00:00').toLocaleDateString('ko-KR', { month: 'long', day: 'numeric', weekday: 'short' })}
          </p>
          <span className="text-xs text-gray-400">
            {selectedJobs.length > 0 ? `${selectedJobs.length}건` : '일정 없음'}
          </span>
        </div>

        {selectedJobs.length === 0 ? (
          <div className="bg-white rounded-2xl p-8 text-center border border-gray-100">
            <p className="text-3xl mb-2">📅</p>
            <p className="text-sm text-gray-500">이 날 예약된 작업이 없습니다</p>
          </div>
        ) : (
          <div className="space-y-3">
            {selectedJobs
              .sort((a, b) => a.time.localeCompare(b.time))
              .map(job => (
              <div
                key={job.id}
                className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 cursor-pointer hover:border-primary-200 transition-colors active:scale-[0.99]"
                onClick={() => router.push('/partner/jobs')}
              >
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-800 leading-snug truncate">{job.symptom}</p>
                    <p className="text-xs text-gray-400 mt-0.5">🚗 {job.vehicle}</p>
                  </div>
                  <span className={`text-xs font-bold px-2 py-0.5 rounded-full border flex-shrink-0 ${STATUS_COLOR[job.status] ?? 'bg-gray-100 text-gray-500'}`}>
                    {STATUS_LABEL[job.status] ?? job.status}
                  </span>
                </div>
                <div className="flex items-center justify-between pt-2 border-t border-gray-50">
                  <span className="text-xs text-gray-500">🕐 {job.time}</span>
                  {job.totalCost > 0 && (
                    <span className="text-sm font-bold text-primary-600">{formatKRW(job.totalCost)}</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* 이번달 예정 목록 (날짜 없는 경우) */}
        {selectedJobs.length === 0 && monthJobs.filter(j => j.date >= todayStr).length > 0 && (
          <div className="mt-5">
            <p className="text-xs font-bold text-gray-400 mb-2">이번 달 남은 일정</p>
            {monthJobs
              .filter(j => j.date >= todayStr)
              .sort((a, b) => a.date.localeCompare(b.date))
              .slice(0, 8)
              .map(job => (
                <button
                  key={job.id}
                  className="w-full bg-white rounded-xl border border-gray-100 px-4 py-3 mb-2 flex items-center gap-3 hover:border-primary-200 transition-colors text-left"
                  onClick={() => {
                    setSelectedDate(job.date)
                    const d = new Date(job.date + 'T00:00:00')
                    setYear(d.getFullYear())
                    setMonth(d.getMonth())
                  }}
                >
                  <div className="flex-shrink-0 w-10 text-center">
                    <p className="text-lg font-black text-primary-600">{new Date(job.date + 'T00:00:00').getDate()}</p>
                    <p className="text-xs text-gray-400">{new Date(job.date + 'T00:00:00').toLocaleDateString('ko-KR', { weekday: 'short' })}</p>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-800 truncate">{job.symptom}</p>
                    <p className="text-xs text-gray-400">{job.time} · {job.vehicle}</p>
                  </div>
                  <span className={`text-xs font-bold px-2 py-0.5 rounded-full border flex-shrink-0 ${STATUS_COLOR[job.status] ?? 'bg-gray-100 text-gray-500'}`}>
                    {STATUS_LABEL[job.status] ?? job.status}
                  </span>
                </button>
              ))}
          </div>
        )}
      </div>
    </div>
  )
}
