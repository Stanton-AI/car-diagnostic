'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { getMyShop } from '@/lib/marketplace'
import { formatKRW } from '@/lib/utils'
import type { PartnerShop } from '@/types'

interface JobRow {
  id: string
  status: string
  payment_status: string
  actual_total_cost: number | null
  created_at: string
  repair_requests: {
    symptom_summary: string
    vehicle_maker: string | null
    vehicle_model: string | null
    preferred_location: string
    contact_phone: string | null
  } | null
  shop_bids: {
    total_cost: number
  } | null
}

const JOB_STATUS: Record<string, { label: string; color: string }> = {
  scheduled:   { label: '예약됨',    color: 'text-blue-600 bg-blue-50' },
  in_progress: { label: '수리 중',   color: 'text-purple-600 bg-purple-50' },
  completed:   { label: '완료',      color: 'text-green-600 bg-green-50' },
  cancelled:   { label: '취소됨',    color: 'text-gray-400 bg-gray-50' },
}

export default function PartnerJobsPage() {
  const router = useRouter()
  const supabase = createClient()
  const [shop, setShop] = useState<PartnerShop | null>(null)
  const [jobs, setJobs] = useState<JobRow[]>([])
  const [loading, setLoading] = useState(true)
  const [updating, setUpdating] = useState<string | null>(null)

  useEffect(() => {
    const load = async () => {
      const myShop = await getMyShop(supabase)
      if (!myShop || myShop.status !== 'active') { router.replace('/partner'); return }
      setShop(myShop)

      const { data } = await supabase
        .from('repair_jobs')
        .select('*, repair_requests(symptom_summary, vehicle_maker, vehicle_model, preferred_location, contact_phone), shop_bids(total_cost)')
        .eq('shop_id', myShop.id)
        .order('created_at', { ascending: false })

      setJobs(data ?? [])
      setLoading(false)
    }
    load()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const updateJobStatus = async (jobId: string, status: string) => {
    setUpdating(jobId)
    const update: Record<string, string> = { status, updated_at: new Date().toISOString() }
    if (status === 'in_progress') update.started_at = new Date().toISOString()
    if (status === 'completed')   update.completed_at = new Date().toISOString()

    await supabase.from('repair_jobs').update(update).eq('id', jobId)
    setJobs(prev => prev.map(j => j.id === jobId ? { ...j, status } : j))
    setUpdating(null)
  }

  if (loading) return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="w-8 h-8 border-2 border-primary-200 border-t-primary-600 rounded-full animate-spin" />
    </div>
  )

  const activeJobs = jobs.filter(j => j.status !== 'completed' && j.status !== 'cancelled')
  const pastJobs   = jobs.filter(j => j.status === 'completed' || j.status === 'cancelled')

  return (
    <div className="flex flex-col min-h-screen bg-surface-50">
      <header className="bg-white px-4 pt-14 pb-4 flex items-center gap-3 border-b border-gray-100">
        <button onClick={() => router.push('/partner')} className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-500">←</button>
        <h1 className="text-lg font-black text-gray-900">작업 관리</h1>
      </header>

      <div className="px-4 py-4 space-y-4">

        {/* 진행 중 */}
        <section>
          <h2 className="text-sm font-bold text-gray-500 mb-2">진행 중 ({activeJobs.length})</h2>
          {activeJobs.length === 0 ? (
            <div className="bg-white rounded-2xl p-6 text-center border border-gray-100 text-gray-400 text-sm">
              진행 중인 작업이 없습니다
            </div>
          ) : activeJobs.map(job => {
            const si = JOB_STATUS[job.status]
            const rr = job.repair_requests
            const bidTotal = job.shop_bids?.total_cost ?? 0

            return (
              <div key={job.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden mb-3">
                <div className="p-4">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <p className="text-sm font-medium text-gray-800 flex-1 leading-snug">
                      {rr?.symptom_summary?.slice(0, 50) ?? ''}
                    </p>
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full flex-shrink-0 ${si.color}`}>
                      {si.label}
                    </span>
                  </div>
                  {rr && (
                    <div className="space-y-1 text-xs text-gray-500">
                      <p>🚗 {rr.vehicle_maker} {rr.vehicle_model}</p>
                      <p>📍 {rr.preferred_location}</p>
                      {rr.contact_phone && <p>📞 {rr.contact_phone}</p>}
                    </div>
                  )}
                  <p className="text-sm font-bold text-primary-600 mt-2">{formatKRW(bidTotal)}</p>
                </div>

                {/* 상태 변경 버튼 */}
                <div className="border-t border-gray-50 px-4 py-3 flex gap-2">
                  {job.status === 'scheduled' && (
                    <button
                      onClick={() => updateJobStatus(job.id, 'in_progress')}
                      disabled={updating === job.id}
                      className="flex-1 py-2.5 bg-purple-600 text-white rounded-xl text-sm font-bold hover:bg-purple-700 disabled:opacity-50"
                    >
                      수리 시작
                    </button>
                  )}
                  {job.status === 'in_progress' && (
                    <button
                      onClick={() => updateJobStatus(job.id, 'completed')}
                      disabled={updating === job.id}
                      className="flex-1 py-2.5 bg-green-600 text-white rounded-xl text-sm font-bold hover:bg-green-700 disabled:opacity-50"
                    >
                      ✅ 수리 완료
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </section>

        {/* 완료 내역 */}
        {pastJobs.length > 0 && (
          <section>
            <h2 className="text-sm font-bold text-gray-500 mb-2">완료 내역 ({pastJobs.length})</h2>
            {pastJobs.slice(0, 10).map(job => {
              const si = JOB_STATUS[job.status]
              const rr = job.repair_requests
              const bidTotal = job.shop_bids?.total_cost ?? 0
              const commission = Math.round(bidTotal * (shop?.commissionRate ?? 0.10))

              return (
                <div key={job.id} className="bg-white rounded-2xl border border-gray-100 p-4 mb-2">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm text-gray-700 flex-1">{rr?.symptom_summary?.slice(0, 40) ?? ''}...</p>
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${si.color}`}>{si.label}</span>
                  </div>
                  <div className="flex items-center justify-between mt-2 text-xs text-gray-500">
                    <span>매출 {formatKRW(bidTotal)} (수수료 -{formatKRW(commission)} = 순 {formatKRW(bidTotal - commission)})</span>
                  </div>
                </div>
              )
            })}
          </section>
        )}
      </div>
    </div>
  )
}
