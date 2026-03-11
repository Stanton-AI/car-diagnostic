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
  time: string       // e.g. '오후 1-3시'
  symptom: string
  vehicle: string
  status: string
  totalCost: number
  type: 'visit' | 'ongoing' | 'scheduled'
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

function getWeekDates(anchor: Date): Date[] {
  const day = anchor.getDay() // 0=Sun
  const monday = new Date(anchor)
  monday.setDate(anchor.getDate() - ((day + 6) % 7))
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday)
    d.setDate(monday.getDate() + i)
    return d
  })
}

function fmtDate(d: Date) {
  return d.toISOString().split('T')[0]
}

const DAY_LABELS = ['월', '화', '수', '목', '금', '토', '일']

export default function PartnerCalendarPage() {
  const router = useRouter()
  const supabase = createClient()
  const [jobs, setJobs] = useState<CalendarJob[]>([])
  const [loading, setLoading] = useState(true)
  const [anchor, setAnchor] = useState(() => new Date())
  const [selectedDate, setSelectedDate] = useState(() => fmtDate(new Date()))

  useEffect(() => {
    const load = async () => {
      const shop = await getMyShop(supabase)
      if (!shop || shop.status !== 'active') { router.replace('/partner'); return }

      // 낙찰 + 진행 중 + 완료 작업의 예약일/작업일 조회
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
        .limit(60)

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
          time: bid?.available_time ?? '종일 가능',
          symptom: rr?.symptom_summary?.slice(0, 40) ?? '수리 요청',
          vehicle: rr?.vehicle_maker ? `${rr.vehicle_maker} ${rr.vehicle_model ?? ''}`.trim() : '차량 미지정',
          status: job.status,
          totalCost: bid?.total_cost ?? 0,
          type: job.status === 'scheduled' ? 'visit' : job.status === 'in_progress' ? 'ongoing' : 'scheduled',
        }]
      })

      setJobs(mapped)
      setLoading(false)
    }
    load()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const weekDates = getWeekDates(anchor)
  const todayStr = fmtDate(new Date())

  const goWeek = (dir: number) => {
    const d = new Date(anchor)
    d.setDate(d.getDate() + dir * 7)
    setAnchor(d)
  }

  const selectedJobs = jobs.filter(j => j.date === selectedDate)

  if (loading) return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="w-8 h-8 border-2 border-primary-200 border-t-primary-600 rounded-full animate-spin" />
    </div>
  )

  // 각 날짜에 있는 작업 수
  const jobCountByDate = jobs.reduce<Record<string, number>>((acc, j) => {
    acc[j.date] = (acc[j.date] ?? 0) + 1
    return acc
  }, {})

  const monthLabel = (() => {
    const d = weekDates[0]
    return `${d.getFullYear()}년 ${d.getMonth() + 1}월`
  })()

  return (
    <div className="flex flex-col min-h-screen bg-surface-50">
      <header className="bg-white px-4 pt-14 pb-4 flex items-center gap-3 border-b border-gray-100">
        <button onClick={() => router.push('/partner')} className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-500">←</button>
        <h1 className="text-lg font-black text-gray-900">예약 캘린더</h1>
      </header>

      {/* 주간 캘린더 */}
      <div className="bg-white border-b border-gray-100 px-4 py-3">
        {/* 월 이동 */}
        <div className="flex items-center justify-between mb-3">
          <button onClick={() => goWeek(-1)} className="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-gray-700">‹</button>
          <span className="text-sm font-bold text-gray-700">{monthLabel}</span>
          <button onClick={() => goWeek(1)} className="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-gray-700">›</button>
        </div>

        {/* 요일 + 날짜 */}
        <div className="grid grid-cols-7 gap-1">
          {weekDates.map((d, i) => {
            const ds = fmtDate(d)
            const isToday = ds === todayStr
            const isSelected = ds === selectedDate
            const count = jobCountByDate[ds] ?? 0
            return (
              <button
                key={ds}
                onClick={() => setSelectedDate(ds)}
                className={`flex flex-col items-center py-2 rounded-xl transition-colors ${
                  isSelected ? 'bg-primary-600 text-white' :
                  isToday ? 'bg-primary-50 text-primary-600' : 'hover:bg-gray-50 text-gray-600'
                }`}
              >
                <span className={`text-xs mb-1 ${isSelected ? 'text-white/70' : 'text-gray-400'}`}>
                  {DAY_LABELS[i]}
                </span>
                <span className={`text-sm font-bold ${isSelected ? 'text-white' : ''}`}>
                  {d.getDate()}
                </span>
                {count > 0 && (
                  <span className={`w-1.5 h-1.5 rounded-full mt-1 ${isSelected ? 'bg-white' : 'bg-primary-400'}`} />
                )}
              </button>
            )
          })}
        </div>
      </div>

      {/* 선택일 일정 */}
      <div className="px-4 py-4 flex-1">
        <p className="text-xs font-bold text-gray-500 mb-3">
          {selectedDate === todayStr ? '오늘' : selectedDate} — {selectedJobs.length > 0 ? `${selectedJobs.length}건` : '일정 없음'}
        </p>

        {selectedJobs.length === 0 ? (
          <div className="bg-white rounded-2xl p-8 text-center border border-gray-100">
            <p className="text-3xl mb-2">📅</p>
            <p className="text-sm text-gray-500">이 날 예약된 작업이 없습니다</p>
          </div>
        ) : (
          <div className="space-y-3">
            {selectedJobs.map(job => (
              <div
                key={job.id}
                className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 cursor-pointer hover:border-primary-200 transition-colors"
                onClick={() => router.push('/partner/jobs')}
              >
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-gray-800 leading-snug">{job.symptom}</p>
                    <p className="text-xs text-gray-400 mt-0.5">🚗 {job.vehicle}</p>
                  </div>
                  <span className={`text-xs font-bold px-2 py-0.5 rounded-full border flex-shrink-0 ${STATUS_COLOR[job.status] ?? 'bg-gray-100 text-gray-500'}`}>
                    {STATUS_LABEL[job.status] ?? job.status}
                  </span>
                </div>
                <div className="flex items-center justify-between mt-2 pt-2 border-t border-gray-50">
                  <span className="text-xs text-gray-500">🕐 {job.time}</span>
                  <span className="text-sm font-bold text-primary-600">{formatKRW(job.totalCost)}</span>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* 전체 예약 목록 (오늘 이후) */}
        {selectedJobs.length === 0 && (
          <div className="mt-4">
            <p className="text-xs font-bold text-gray-500 mb-2">예정된 모든 방문 ({jobs.filter(j => j.date >= todayStr).length}건)</p>
            {jobs
              .filter(j => j.date >= todayStr)
              .sort((a, b) => a.date.localeCompare(b.date))
              .slice(0, 10)
              .map(job => (
                <div key={job.id} className="bg-white rounded-xl border border-gray-100 px-4 py-3 mb-2 flex items-center gap-3 cursor-pointer hover:border-primary-200" onClick={() => { setSelectedDate(job.date); setAnchor(new Date(job.date)) }}>
                  <div className="flex-shrink-0 w-10 text-center">
                    <p className="text-lg font-black text-primary-600">{new Date(job.date + 'T00:00:00').getDate()}</p>
                    <p className="text-xs text-gray-400">{new Date(job.date + 'T00:00:00').toLocaleDateString('ko-KR', { month: 'short' })}</p>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-800 truncate">{job.symptom}</p>
                    <p className="text-xs text-gray-400">{job.time} · {job.vehicle}</p>
                  </div>
                  <span className={`text-xs font-bold px-2 py-0.5 rounded-full border flex-shrink-0 ${STATUS_COLOR[job.status] ?? 'bg-gray-100 text-gray-500'}`}>
                    {STATUS_LABEL[job.status] ?? job.status}
                  </span>
                </div>
              ))}
          </div>
        )}
      </div>
    </div>
  )
}
