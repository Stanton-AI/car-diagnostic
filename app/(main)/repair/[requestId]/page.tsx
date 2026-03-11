'use client'
import { useState, useEffect, useCallback } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { acceptBid, mapBid, mapRequest, REQUEST_STATUS_LABEL, BID_STATUS_LABEL, formatDeadline, calcSavings } from '@/lib/marketplace'
import { formatKRW } from '@/lib/utils'
import type { RepairRequest, ShopBid } from '@/types'

// ─── 정밀진단 타입 ────────────────────────────────────────────────────────
interface DiagItem { code: string; name: string; description: string; severity: string }
interface PartItem  { part_name: string; part_code: string; unit_cost: number; qty: number }

interface PreciseDiagnosis {
  id: string
  job_id: string
  diagnosis_items: DiagItem[]
  parts_needed: PartItem[]
  labor_cost: number
  total_cost: number
  mechanic_notes: string | null
  consumer_decision: string | null
  photos: string[]
  created_at: string
}

interface RepairUpdate {
  id: string
  content: string
  photos: string[]
  estimated_completion_at: string | null
  created_at: string
}

interface RepairJob {
  id: string
  status: string
  estimated_completion_at: string | null
  mechanic_final_comment: string | null
  invoice_url: string | null
  completion_change_count: number
}

const SEVERITY_STYLE: Record<string, string> = {
  critical: 'bg-red-50 text-red-600 border-red-200',
  major:    'bg-amber-50 text-amber-600 border-amber-200',
  minor:    'bg-blue-50 text-blue-600 border-blue-200',
}
const SEVERITY_LABEL: Record<string, string> = {
  critical: '즉시 수리 필요',
  major:    '조기 수리 권장',
  minor:    '관찰 필요',
}

function fmtDT(iso: string) {
  return new Date(iso).toLocaleString('ko-KR', {
    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
  })
}

// ─── 입찰 카드 ────────────────────────────────────────────────────────────
function BidCard({
  bid,
  dealerTotal,
  isAccepted,
  onAccept,
}: {
  bid: ShopBid
  dealerTotal: number
  isAccepted: boolean
  onAccept: (bidId: string) => void
}) {
  const savings = dealerTotal > 0 ? calcSavings(dealerTotal, bid.totalCost) : null
  const statusInfo = BID_STATUS_LABEL[bid.status]

  return (
    <div className={`bg-white rounded-2xl border shadow-sm overflow-hidden transition-all ${
      bid.status === 'accepted' ? 'border-green-300 ring-2 ring-green-200' : 'border-gray-100'
    }`}>
      <div className="p-4">
        <div className="flex items-start justify-between gap-3 mb-3">
          <div>
            <h3 className="font-bold text-gray-900">{bid.shop?.name ?? '정비소'}</h3>
            <p className="text-xs text-gray-400 mt-0.5">{bid.shop?.address}</p>
          </div>
          <div className="flex flex-col items-end gap-1">
            <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${statusInfo.color}`}>
              {statusInfo.label}
            </span>
            {bid.shop?.rating ? (
              <span className="text-xs text-amber-500 font-semibold">
                ★ {bid.shop.rating.toFixed(1)} ({bid.shop.reviewCount}건)
              </span>
            ) : null}
          </div>
        </div>

        {/* 가격 */}
        <div className="bg-gray-50 rounded-xl p-3 mb-3">
          <div className="flex justify-between text-sm mb-1">
            <span className="text-gray-500">부품비</span>
            <span className="font-semibold">{formatKRW(bid.partsCost)}</span>
          </div>
          <div className="flex justify-between text-sm mb-2">
            <span className="text-gray-500">공임비</span>
            <span className="font-semibold">{formatKRW(bid.laborCost)}</span>
          </div>
          <div className="flex justify-between font-bold border-t border-gray-200 pt-2">
            <span className="text-gray-800">합계</span>
            <span className="text-primary-600 text-lg">{formatKRW(bid.totalCost)}</span>
          </div>
          {savings && savings.percent > 0 && (
            <p className="text-xs text-green-600 font-semibold text-right mt-1">
              대리점 대비 {savings.percent}% 절감 (약 {formatKRW(savings.amount)} 아낌)
            </p>
          )}
        </div>

        {/* 세부 정보 */}
        <div className="flex gap-3 text-xs text-gray-500 mb-3 flex-wrap">
          <span>🗓 예상 {bid.estimatedDays}일</span>
          {bid.availableDate && (
            <>
              <span>📅 방문가능일: {bid.availableDate}</span>
              <span>🕐 {bid.availableTime ?? '시간 미정'}</span>
            </>
          )}
          {bid.shop?.totalJobs ? <span>🔧 완료 {bid.shop.totalJobs}건</span> : null}
        </div>

        {bid.bidNotes && (
          <p className="text-xs text-gray-600 bg-blue-50 rounded-lg p-2 mb-3">
            💬 {bid.bidNotes}
          </p>
        )}

        {/* CTA */}
        {isAccepted && bid.status === 'pending' && (
          <button
            onClick={() => onAccept(bid.id)}
            className="w-full py-3 bg-primary-600 text-white font-bold rounded-xl hover:bg-primary-700 transition-colors"
          >
            이 정비소 선택하기
          </button>
        )}
        {bid.status === 'accepted' && (
          <div className="flex items-center justify-center gap-2 py-2 text-green-600 font-bold text-sm">
            <span>✅</span> 낙찰 완료 — 정비소 연락 대기 중
          </div>
        )}
      </div>
    </div>
  )
}

// ─── 메인 페이지 ─────────────────────────────────────────────────────────
export default function RepairStatusPage() {
  const router = useRouter()
  const { requestId } = useParams<{ requestId: string }>()
  const supabase = createClient()

  const [request, setRequest] = useState<RepairRequest | null>(null)
  const [bids, setBids] = useState<ShopBid[]>([])
  const [repairJob, setRepairJob] = useState<RepairJob | null>(null)
  const [diagnosis, setDiagnosis] = useState<PreciseDiagnosis | null>(null)
  const [updates, setUpdates] = useState<RepairUpdate[]>([])
  const [loading, setLoading] = useState(true)
  const [accepting, setAccepting] = useState(false)
  const [deciding, setDeciding] = useState(false)
  const [diagExpanded, setDiagExpanded] = useState(true)

  const load = useCallback(async () => {
    const res = await fetch(`/api/repair-requests/${requestId}`)
    if (!res.ok) { router.replace('/main'); return }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data: any = await res.json()
    setRequest(mapRequest(data))
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    setBids((data.shop_bids ?? []).map((b: any) => mapBid(b)))

    const job: RepairJob | null = data.repair_job ?? null
    setRepairJob(job)

    // 수리 진행 중이면 정밀진단 + 업데이트 조회
    if (job?.id) {
      const [diagRes, updatesRes] = await Promise.all([
        fetch(`/api/repair-jobs/${job.id}/diagnose`),
        fetch(`/api/repair-jobs/${job.id}/updates`),
      ])
      if (diagRes.ok) {
        const d = await diagRes.json()
        setDiagnosis(d && d.id ? d : null)
      }
      if (updatesRes.ok) {
        setUpdates(await updatesRes.json())
      }
    }

    setLoading(false)
  }, [requestId, router])

  useEffect(() => {
    load()
    const channel = supabase
      .channel(`request-${requestId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'shop_bids',
        filter: `request_id=eq.${requestId}`,
      }, () => load())
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [load, requestId, supabase])

  const handleAccept = async (bidId: string) => {
    if (!confirm('이 정비소에 낙찰하시겠습니까?')) return
    setAccepting(true)
    const ok = await acceptBid(bidId)
    setAccepting(false)
    if (ok) {
      await load()
    } else {
      alert('낙찰 처리 중 오류가 발생했습니다.')
    }
  }

  const handleDiagDecision = async (decision: 'approved' | 'rejected') => {
    if (!repairJob?.id) return
    const msg = decision === 'approved' ? '수리를 진행하시겠습니까?' : '수리를 거절하시겠습니까?'
    if (!confirm(msg)) return
    setDeciding(true)
    try {
      const res = await fetch(`/api/repair-jobs/${repairJob.id}/diagnose`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ decision }),
      })
      if (res.ok) {
        setDiagnosis(prev => prev ? { ...prev, consumer_decision: decision } : prev)
      } else {
        alert('처리 중 오류가 발생했습니다.')
      }
    } finally {
      setDeciding(false)
    }
  }

  if (loading) return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="w-8 h-8 border-2 border-primary-200 border-t-primary-600 rounded-full animate-spin" />
    </div>
  )

  if (!request) return null

  const statusInfo = REQUEST_STATUS_LABEL[request.status]
  const canAccept = ['open', 'bidding'].includes(request.status)
  const dealerTotal = (request.dealerPartsMax ?? 0) + (request.dealerLaborMax ?? 0)
  const pendingBids = bids.filter(b => b.status === 'pending').sort((a, b) => a.totalCost - b.totalCost)
  const acceptedBid = bids.find(b => b.status === 'accepted')
  const isPostAccepted = ['accepted', 'in_progress', 'completed'].includes(request.status)

  return (
    <div className="flex flex-col min-h-screen bg-surface-50">
      <header className="bg-white px-4 pt-14 pb-4 flex items-center gap-3 border-b border-gray-100">
        <button onClick={() => router.push('/main')} className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-500">←</button>
        <h1 className="text-lg font-black text-gray-900">
          {request.status === 'completed' ? '수리 완료' : isPostAccepted ? '수리 진행 현황' : '입찰 현황'}
        </h1>
        <span className={`ml-auto text-xs font-bold px-2.5 py-1 rounded-full ${statusInfo.color}`}>
          {statusInfo.label}
        </span>
      </header>

      <div className="px-4 py-4 space-y-4 pb-8">

        {/* 요청 요약 */}
        <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm">
          <p className="text-xs text-gray-400 mb-1">수리 요청 내용</p>
          <p className="text-sm font-medium text-gray-800">{request.symptomSummary.slice(0, 80)}</p>
          {request.vehicleMaker && (
            <p className="text-xs text-gray-400 mt-1">🚗 {request.vehicleMaker} {request.vehicleModel}</p>
          )}
          <div className="flex items-center gap-3 mt-2 text-xs text-gray-500 flex-wrap">
            <span>📍 {request.preferredLocation}</span>
            {!isPostAccepted && <span>⏰ {formatDeadline(request.bidDeadline)}</span>}
            {!isPostAccepted && <span>📬 입찰 {request.bidCount}건</span>}
          </div>
        </div>

        {/* ─── 낙찰 이후 흐름 ─────────────────────────────────── */}
        {isPostAccepted && (
          <>
            {/* 선택된 정비소 */}
            {acceptedBid && (
              <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm">
                <p className="text-xs text-gray-400 mb-2">선택한 정비소</p>
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-gray-900">{acceptedBid.shop?.name ?? '정비소'}</p>
                    <p className="text-xs text-gray-500 mt-0.5">{acceptedBid.shop?.address}</p>
                    {acceptedBid.shop?.phone && (
                      <a href={`tel:${acceptedBid.shop.phone}`} className="text-xs text-primary-600 font-semibold mt-1 inline-block">
                        📞 {acceptedBid.shop.phone}
                      </a>
                    )}
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-base font-black text-primary-600">{formatKRW(acceptedBid.totalCost)}</p>
                    {acceptedBid.availableDate && (
                      <>
                        <p className="text-xs text-gray-500 mt-0.5">📅 방문일: {acceptedBid.availableDate}</p>
                        <p className="text-xs text-gray-500">🕐 {acceptedBid.availableTime ?? '시간 미정'}</p>
                      </>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* ETA (수리 중) */}
            {repairJob?.estimated_completion_at && (
              <div className="bg-blue-50 rounded-2xl p-4 border border-blue-200">
                <p className="text-xs font-bold text-blue-700 mb-1">🕐 예상 완료시간</p>
                <p className="text-sm font-bold text-blue-800">{fmtDT(repairJob.estimated_completion_at)}</p>
                <p className="text-xs text-blue-500 mt-0.5">변경 시 알림이 전송됩니다 ({repairJob.completion_change_count}/3회)</p>
              </div>
            )}

            {/* 정밀진단 결과 */}
            {diagnosis && (
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                <button
                  onClick={() => setDiagExpanded(p => !p)}
                  className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-base">🔍</span>
                    <span className="text-sm font-bold text-gray-800">정밀진단 결과</span>
                    {diagnosis.consumer_decision === 'approved' && (
                      <span className="text-xs bg-green-50 text-green-600 border border-green-200 px-2 py-0.5 rounded-full font-bold">✅ 수리 승인</span>
                    )}
                    {diagnosis.consumer_decision === 'rejected' && (
                      <span className="text-xs bg-gray-50 text-gray-500 border border-gray-200 px-2 py-0.5 rounded-full font-bold">❌ 수리 거절</span>
                    )}
                    {!diagnosis.consumer_decision && (
                      <span className="text-xs bg-amber-50 text-amber-600 border border-amber-200 px-2 py-0.5 rounded-full font-bold animate-pulse">결정 필요</span>
                    )}
                  </div>
                  <span className="text-gray-400 text-xs">{diagExpanded ? '▲' : '▼'}</span>
                </button>

                {diagExpanded && (
                  <div className="px-4 pb-4 space-y-3">
                    {/* 진단 항목 */}
                    {diagnosis.diagnosis_items?.length > 0 && (
                      <div>
                        <p className="text-xs font-bold text-gray-600 mb-2">진단 내역</p>
                        <div className="space-y-2">
                          {diagnosis.diagnosis_items.map((d, i) => (
                            <div key={i} className="flex items-start gap-2 p-2.5 bg-gray-50 rounded-xl">
                              <span className={`text-xs font-bold px-2 py-0.5 rounded-full border flex-shrink-0 ${SEVERITY_STYLE[d.severity] ?? 'bg-gray-50 text-gray-500 border-gray-200'}`}>
                                {SEVERITY_LABEL[d.severity] ?? d.severity}
                              </span>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-semibold text-gray-800">{d.name}</p>
                                {d.code && <p className="text-xs text-gray-400 font-mono">{d.code}</p>}
                                {d.description && <p className="text-xs text-gray-500 mt-0.5 leading-snug">{d.description}</p>}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* 예상 비용 */}
                    {diagnosis.total_cost > 0 && (
                      <div className="bg-gray-50 rounded-xl p-3 border border-gray-100">
                        <p className="text-xs font-bold text-gray-600 mb-1.5">💰 정밀진단 기반 예상 비용</p>
                        {diagnosis.parts_needed?.filter(p => p.part_name).map((p, i) => (
                          <div key={i} className="flex justify-between text-xs text-gray-500 mb-0.5">
                            <span>{p.part_name} × {p.qty}</span>
                            <span>{formatKRW(p.unit_cost * p.qty)}</span>
                          </div>
                        ))}
                        {diagnosis.parts_needed?.some(p => p.part_name) && (
                          <div className="flex justify-between text-xs text-gray-500 border-t border-gray-200 pt-1 mb-0.5">
                            <span>공임비</span><span>{formatKRW(diagnosis.labor_cost)}</span>
                          </div>
                        )}
                        <div className="flex justify-between font-bold text-gray-900 mt-1">
                          <span>합계</span>
                          <span className="text-primary-600">{formatKRW(diagnosis.total_cost)}</span>
                        </div>
                      </div>
                    )}

                    {/* 정비사 메모 */}
                    {diagnosis.mechanic_notes && (
                      <div className="bg-blue-50 rounded-xl p-3 border border-blue-100">
                        <p className="text-xs font-bold text-blue-700 mb-1">💬 정비사 설명</p>
                        <p className="text-xs text-blue-700 leading-relaxed">{diagnosis.mechanic_notes}</p>
                      </div>
                    )}

                    {/* 진단 사진 */}
                    {diagnosis.photos?.length > 0 && (
                      <div>
                        <p className="text-xs font-bold text-gray-600 mb-2">📷 진단 사진</p>
                        <div className="flex gap-2 flex-wrap">
                          {diagnosis.photos.map((url, pi) => (
                            <a key={pi} href={url} target="_blank" rel="noopener noreferrer">
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img src={url} alt="" className="w-20 h-20 rounded-xl object-cover border border-gray-200" />
                            </a>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* 수리 결정 버튼 */}
                    {!diagnosis.consumer_decision && request.status !== 'completed' && (
                      <div className="space-y-2 pt-1">
                        <p className="text-xs font-bold text-gray-700 text-center">수리를 진행하시겠습니까?</p>
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleDiagDecision('approved')}
                            disabled={deciding}
                            className="flex-1 py-3 bg-primary-600 text-white font-bold rounded-xl hover:bg-primary-700 disabled:opacity-50"
                          >
                            ✅ 수리 진행
                          </button>
                          <button
                            onClick={() => handleDiagDecision('rejected')}
                            disabled={deciding}
                            className="flex-1 py-3 bg-gray-100 text-gray-700 font-bold rounded-xl hover:bg-gray-200 disabled:opacity-50"
                          >
                            ❌ 거절
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* 수리 현황 타임라인 */}
            {updates.length > 0 && (
              <div>
                <h2 className="text-sm font-bold text-gray-500 mb-2">🔧 수리 현황 ({updates.length}건)</h2>
                <div className="space-y-3">
                  {[...updates].reverse().map(u => (
                    <div key={u.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <p className="text-xs text-gray-400">{fmtDT(u.created_at)}</p>
                        {u.estimated_completion_at && (
                          <span className="text-xs bg-blue-50 text-blue-600 border border-blue-200 px-2 py-0.5 rounded-full font-bold flex-shrink-0">
                            🕐 {fmtDT(u.estimated_completion_at)}
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-gray-700 leading-relaxed">{u.content}</p>
                      {u.photos?.length > 0 && (
                        <div className="flex gap-2 mt-2 flex-wrap">
                          {u.photos.map((url, pi) => (
                            <a key={pi} href={url} target="_blank" rel="noopener noreferrer">
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img src={url} alt="" className="w-20 h-20 rounded-xl object-cover border border-gray-200" />
                            </a>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 수리 완료 */}
            {request.status === 'completed' && repairJob && (
              <div className="bg-green-50 rounded-2xl p-4 border border-green-200">
                <p className="text-base font-bold text-green-800 mb-3">✅ 수리가 완료되었습니다!</p>
                {repairJob.mechanic_final_comment && (
                  <div className="bg-white rounded-xl p-3 border border-green-100 mb-3">
                    <p className="text-xs font-bold text-gray-600 mb-1">💬 정비사 코멘트</p>
                    <p className="text-sm text-gray-700 leading-relaxed">{repairJob.mechanic_final_comment}</p>
                  </div>
                )}
                {repairJob.invoice_url && (() => {
                  const isImage = /\.(jpg|jpeg|png|webp|heic)(\?|$)/i.test(repairJob.invoice_url!)
                  return isImage ? (
                    <div className="mb-3">
                      <p className="text-xs font-bold text-gray-600 mb-2">📎 정비/점검 명세서</p>
                      <a href={repairJob.invoice_url!} target="_blank" rel="noopener noreferrer">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={repairJob.invoice_url!} alt="명세서" className="w-full rounded-xl border border-green-100 object-contain max-h-64" />
                        <p className="text-xs text-primary-600 text-center mt-1">클릭하여 원본 보기</p>
                      </a>
                    </div>
                  ) : (
                    <a
                      href={repairJob.invoice_url!}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-3 bg-white rounded-xl p-3 border border-green-100 hover:border-primary-200 transition-colors mb-3"
                    >
                      <span className="text-2xl">📎</span>
                      <div>
                        <p className="text-xs font-bold text-gray-700">정비/점검 명세서</p>
                        <p className="text-xs text-primary-600">클릭하여 확인하기</p>
                      </div>
                    </a>
                  )
                })()}
                <p className="text-xs text-green-700 text-center">차량을 수령해 주세요. 이용해 주셔서 감사합니다! 🚗</p>
              </div>
            )}
          </>
        )}

        {/* ─── 입찰 단계 ─────────────────────────────────────── */}
        {!isPostAccepted && (
          <>
            {dealerTotal > 0 && (
              <div className="bg-gray-50 rounded-xl px-4 py-3 border border-gray-100">
                <div className="flex items-center justify-between">
                  <p className="text-xs text-gray-500">제조사 대리점 기준가</p>
                  <p className="text-sm font-bold text-gray-700 line-through">
                    {formatKRW(request.dealerTotalMin ?? 0)} ~ {formatKRW(dealerTotal)}
                  </p>
                </div>
              </div>
            )}

            {bids.length === 0 ? (
              <div className="bg-white rounded-2xl p-8 border border-gray-100 text-center">
                <p className="text-4xl mb-3">⏳</p>
                <p className="font-bold text-gray-700">아직 입찰이 없습니다</p>
                <p className="text-sm text-gray-400 mt-1">파트너 정비소들이 견적을 준비 중입니다</p>
                <p className="text-xs text-gray-300 mt-3">마감까지 {formatDeadline(request.bidDeadline)}</p>
              </div>
            ) : (
              <>
                {acceptedBid && (
                  <BidCard bid={acceptedBid} dealerTotal={dealerTotal} isAccepted={false} onAccept={handleAccept} />
                )}
                {pendingBids.map((bid, i) => (
                  <div key={bid.id} className="relative">
                    {i === 0 && pendingBids.length > 1 && (
                      <div className="absolute -top-2 left-4 z-10">
                        <span className="bg-primary-600 text-white text-xs font-bold px-2 py-0.5 rounded-full">최저가</span>
                      </div>
                    )}
                    <BidCard
                      bid={bid}
                      dealerTotal={dealerTotal}
                      isAccepted={canAccept && !accepting}
                      onAccept={handleAccept}
                    />
                  </div>
                ))}
              </>
            )}

            {canAccept && (
              <button
                onClick={async () => {
                  if (!confirm('견적 요청을 취소하시겠습니까?')) return
                  await fetch(`/api/repair-requests/${requestId}`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ status: 'cancelled' }),
                  })
                  router.push('/main')
                }}
                className="w-full py-3 text-gray-400 text-sm border border-gray-200 rounded-xl hover:bg-gray-50"
              >
                요청 취소
              </button>
            )}
          </>
        )}
      </div>
    </div>
  )
}
