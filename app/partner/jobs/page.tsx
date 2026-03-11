'use client'
import { useState, useEffect, useRef } from 'react'
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
    available_date: string | null
    available_time: string | null
  } | null
}

const JOB_STATUS: Record<string, { label: string; color: string }> = {
  scheduled:   { label: '예약됨',    color: 'text-blue-600 bg-blue-50' },
  in_progress: { label: '수리 중',   color: 'text-purple-600 bg-purple-50' },
  completed:   { label: '완료',      color: 'text-green-600 bg-green-50' },
  cancelled:   { label: '취소됨',    color: 'text-gray-400 bg-gray-50' },
}

const COMPLETION_MESSAGES = [
  '고객님의 차량 수리가 완료되었습니다. 꼼꼼하게 점검하였으니 안심하고 방문해 주세요. 궁금한 점이 있으시면 언제든 연락 주세요! 😊',
  '안전하게 수리가 완료되었습니다! 정성을 담아 작업했습니다. 앞으로도 안전 운전 하세요! 🙏',
  '차량 수리가 완료되었습니다. 고품질 부품으로 꼼꼼히 수리했습니다. 오래오래 잘 운행하세요! 🚗',
  '모든 작업이 깔끔하게 마무리되었습니다. 고객님 차량이 더욱 건강해졌습니다. 감사합니다! ✨',
]

export default function PartnerJobsPage() {
  const router = useRouter()
  const supabase = createClient()
  const invoiceRef     = useRef<HTMLInputElement>(null)
  const photoRef       = useRef<HTMLInputElement>(null)

  const [shop, setShop] = useState<PartnerShop | null>(null)
  const [jobs, setJobs] = useState<JobRow[]>([])
  const [loading, setLoading] = useState(true)
  const [updating, setUpdating] = useState<string | null>(null)
  // 정밀진단 소비자 결정 상태 { jobId: 'approved'|'rejected'|'pending'|null }
  const [diagStatuses, setDiagStatuses] = useState<Record<string, string | null>>({})
  // 수리 완료 모달
  const [completionJobId, setCompletionJobId] = useState<string | null>(null)
  const [completionComment, setCompletionComment] = useState('')
  const [invoiceUrl, setInvoiceUrl] = useState('')
  const [uploadingInvoice, setUploadingInvoice] = useState(false)
  const [completionPhotos, setCompletionPhotos] = useState<string[]>([])
  const [uploadingPhotos, setUploadingPhotos] = useState(false)

  useEffect(() => {
    const load = async () => {
      const myShop = await getMyShop(supabase)
      if (!myShop || myShop.status !== 'active') { router.replace('/partner'); return }
      setShop(myShop)

      const { data } = await supabase
        .from('repair_jobs')
        .select('*, repair_requests(symptom_summary, vehicle_maker, vehicle_model, preferred_location, contact_phone), shop_bids(total_cost, available_date, available_time)')
        .eq('shop_id', myShop.id)
        .order('created_at', { ascending: false })

      const jobsList = data ?? []
      setJobs(jobsList)

      // 각 작업의 정밀진단 소비자 결정 조회
      if (jobsList.length > 0) {
        const { data: diagData } = await supabase
          .from('precise_diagnoses')
          .select('job_id, consumer_decision')
          .in('job_id', jobsList.map(j => j.id))

        const statusMap: Record<string, string | null> = {}
        for (const d of diagData ?? []) {
          statusMap[d.job_id] = d.consumer_decision
        }
        setDiagStatuses(statusMap)
      }

      setLoading(false)
    }
    load()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const openCompletionModal = (jobId: string) => {
    const randomMsg = COMPLETION_MESSAGES[Math.floor(Math.random() * COMPLETION_MESSAGES.length)]
    setCompletionComment(randomMsg)
    setInvoiceUrl('')
    setCompletionPhotos([])
    setCompletionJobId(jobId)
  }

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? [])
    if (!files.length) return
    setUploadingPhotos(true)
    try {
      const urls = await Promise.all(files.map(async file => {
        const formData = new FormData()
        formData.append('file', file)
        formData.append('folder', 'completion-photos')
        const res = await fetch('/api/upload', { method: 'POST', body: formData })
        if (!res.ok) throw new Error('업로드 실패')
        return (await res.json()).url as string
      }))
      setCompletionPhotos(prev => [...prev, ...urls])
    } catch {
      alert('사진 업로드에 실패했습니다.')
    } finally {
      setUploadingPhotos(false)
      if (photoRef.current) photoRef.current.value = ''
    }
  }

  const handleInvoiceUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploadingInvoice(true)
    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('folder', 'invoices')
      const res = await fetch('/api/upload', { method: 'POST', body: formData })
      if (!res.ok) throw new Error('업로드 실패')
      const data = await res.json()
      setInvoiceUrl(data.url)
    } catch {
      alert('파일 업로드에 실패했습니다.')
    } finally {
      setUploadingInvoice(false)
      if (invoiceRef.current) invoiceRef.current.value = ''
    }
  }

  const updateJobStatus = async (jobId: string, status: string, extras?: { mechanicFinalComment?: string; invoiceUrl?: string; completionPhotos?: string[] }) => {
    setUpdating(jobId)
    try {
      const res = await fetch(`/api/repair-jobs/${jobId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status, ...extras }),
      })
      if (res.ok) {
        setJobs(prev => prev.map(j => j.id === jobId ? { ...j, status } : j))
        if (status === 'completed') setCompletionJobId(null)
      } else {
        const err = await res.json().catch(() => ({}))
        alert(err.error ?? '상태 변경에 실패했습니다.')
      }
    } catch {
      alert('상태 변경 중 오류가 발생했습니다.')
    } finally {
      setUpdating(null)
    }
  }

  const handleCompleteJob = async () => {
    if (!completionJobId) return
    await updateJobStatus(completionJobId, 'completed', {
      mechanicFinalComment: completionComment.trim() || undefined,
      invoiceUrl: invoiceUrl || undefined,
      completionPhotos: completionPhotos.length ? completionPhotos : undefined,
    })
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
            const diagDecision = diagStatuses[job.id]
            const hasApprovedDiag = diagDecision === 'approved'
            const hasPendingDiag = diagDecision === 'pending'
            // 수리 시작 가능: 소비자가 명시적으로 거절하지 않은 경우
            // (진단 없음 | pending | approved 모두 허용, rejected만 불가)
            const canStartRepair = diagDecision !== 'rejected'

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
                  {/* 방문 날짜/시간 */}
                  {(job.shop_bids?.available_date || job.shop_bids?.available_time) && (
                    <div className="flex gap-2 mt-2 text-xs text-primary-600 font-semibold">
                      {job.shop_bids?.available_date && <span>📅 {job.shop_bids.available_date}</span>}
                      {job.shop_bids?.available_time && <span>🕐 {job.shop_bids.available_time}</span>}
                    </div>
                  )}
                  <p className="text-sm font-bold text-primary-600 mt-2">{formatKRW(bidTotal)}</p>

                  {/* 정밀진단 상태 뱃지 */}
                  {job.status === 'scheduled' && (
                    <div className="mt-2">
                      {hasApprovedDiag && (
                        <span className="text-xs bg-green-50 text-green-600 border border-green-200 px-2 py-0.5 rounded-full font-bold">✅ 소비자 수리 승인</span>
                      )}
                      {diagDecision === 'rejected' && (
                        <span className="text-xs bg-gray-50 text-gray-500 border border-gray-200 px-2 py-0.5 rounded-full font-bold">❌ 소비자 수리 거절</span>
                      )}
                      {hasPendingDiag && (
                        <span className="text-xs bg-amber-50 text-amber-600 border border-amber-200 px-2 py-0.5 rounded-full font-bold">⏳ 소비자 결정 대기</span>
                      )}
                    </div>
                  )}
                </div>

                {/* 상태 변경 버튼 */}
                <div className="border-t border-gray-50 px-4 py-3 space-y-2">
                  {job.status === 'scheduled' && (
                    <>
                      {/* 정밀진단 작성 */}
                      <button
                        onClick={() => router.push(`/partner/jobs/${job.id}/diagnose`)}
                        className="w-full py-2.5 bg-blue-50 text-blue-700 border border-blue-200 rounded-xl text-sm font-bold hover:bg-blue-100 transition-colors"
                      >
                        🔍 정밀진단 결과 작성
                      </button>
                      {/* 수리 시작 — 소비자가 거절하지 않은 경우 (pending/approved/없음 모두 허용) */}
                      {canStartRepair && (
                        <button
                          onClick={() => updateJobStatus(job.id, 'in_progress')}
                          disabled={updating === job.id}
                          className={`w-full py-2.5 rounded-xl text-sm font-bold disabled:opacity-50 ${
                            hasApprovedDiag
                              ? 'bg-purple-600 text-white hover:bg-purple-700'
                              : 'bg-purple-100 text-purple-700 border border-purple-200 hover:bg-purple-200'
                          }`}
                        >
                          🔧 수리 시작{hasPendingDiag ? ' (소비자 결정 대기 중)' : ''}
                        </button>
                      )}
                    </>
                  )}
                  {job.status === 'in_progress' && (
                    <div className="flex gap-2">
                      <button
                        onClick={() => router.push(`/partner/jobs/${job.id}/updates`)}
                        className="flex-1 py-2.5 bg-gray-100 text-gray-700 rounded-xl text-sm font-bold hover:bg-gray-200 transition-colors"
                      >
                        📸 수리 현황 업데이트
                      </button>
                      <button
                        onClick={() => openCompletionModal(job.id)}
                        disabled={updating === job.id}
                        className="flex-1 py-2.5 bg-green-600 text-white rounded-xl text-sm font-bold hover:bg-green-700 disabled:opacity-50"
                      >
                        ✅ 수리 완료
                      </button>
                    </div>
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

      {/* 수리 완료 모달 */}
      {completionJobId && (
        <div className="fixed inset-0 bg-black/50 flex items-end z-50">
          <div className="w-full bg-white rounded-t-3xl px-4 pt-5 pb-8 max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-black text-gray-900">✅ 수리 완료 처리</h2>
              <button
                onClick={() => setCompletionJobId(null)}
                className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-400"
              >×</button>
            </div>
            <p className="text-xs text-gray-400 mb-4">소비자에게 수리 완료 알림이 전송됩니다</p>

            {/* 정비사 코멘트 */}
            <div className="mb-4">
              <label className="text-xs font-semibold text-gray-600 mb-2 block">💬 정비사 코멘트 (소비자에게 전달)</label>
              <textarea
                value={completionComment}
                onChange={e => setCompletionComment(e.target.value)}
                rows={4}
                className="w-full px-3 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-primary-400 resize-none"
              />
              <p className="text-xs text-gray-400 mt-1">기본 메시지를 수정하거나 직접 작성하세요</p>
            </div>

            {/* 수리 완료 사진 */}
            <div className="mb-4">
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-semibold text-gray-600">📷 수리 완료 사진 (선택)</label>
                <button
                  type="button"
                  onClick={() => photoRef.current?.click()}
                  disabled={uploadingPhotos}
                  className="text-xs text-primary-600 font-bold px-2 py-1 rounded-lg border border-primary-200 hover:bg-primary-50 disabled:opacity-50"
                >
                  {uploadingPhotos ? '업로드 중...' : '+ 사진 추가'}
                </button>
              </div>
              <input
                ref={photoRef}
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={handlePhotoUpload}
              />
              {completionPhotos.length > 0 ? (
                <div className="flex gap-2 flex-wrap">
                  {completionPhotos.map((url, i) => (
                    <div key={i} className="relative">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={url} alt="" className="w-20 h-20 rounded-xl object-cover border border-gray-200" />
                      <button
                        onClick={() => setCompletionPhotos(prev => prev.filter((_, idx) => idx !== i))}
                        className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white rounded-full text-xs flex items-center justify-center"
                      >×</button>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-gray-400">수리 후 차량 상태 사진을 첨부하면 소비자 신뢰도가 높아집니다</p>
              )}
            </div>

            {/* 명세서 첨부 */}
            <div className="mb-5">
              <label className="text-xs font-semibold text-gray-600 mb-2 block">📎 정비/점검 명세서 첨부 (선택)</label>
              {invoiceUrl ? (
                <div className="flex items-center gap-2 p-3 bg-green-50 rounded-xl border border-green-200">
                  <span className="text-green-600 text-sm font-semibold flex-1 truncate">✅ 명세서 업로드 완료</span>
                  <button
                    onClick={() => setInvoiceUrl('')}
                    className="text-xs text-gray-400 hover:text-red-500"
                  >삭제</button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => invoiceRef.current?.click()}
                  disabled={uploadingInvoice}
                  className="w-full py-3 border-2 border-dashed border-gray-200 rounded-xl text-sm text-gray-500 hover:border-gray-300 hover:bg-gray-50 disabled:opacity-50"
                >
                  {uploadingInvoice ? '업로드 중...' : '📁 명세서 파일 선택 (PDF/이미지)'}
                </button>
              )}
              <input
                ref={invoiceRef}
                type="file"
                accept="image/*,application/pdf"
                className="hidden"
                onChange={handleInvoiceUpload}
              />
            </div>

            <button
              onClick={handleCompleteJob}
              disabled={updating === completionJobId || uploadingPhotos || uploadingInvoice}
              className="w-full py-4 bg-green-600 text-white font-bold rounded-2xl hover:bg-green-700 disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {updating === completionJobId
                ? <><span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> 처리 중...</>
                : uploadingPhotos || uploadingInvoice
                ? <><span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> 업로드 중...</>
                : '✅ 수리 완료 확정 및 소비자 알림 전송'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
