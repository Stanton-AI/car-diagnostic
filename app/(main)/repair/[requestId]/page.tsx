'use client'
import { useState, useEffect, useCallback } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { acceptBid, mapBid, mapRequest, REQUEST_STATUS_LABEL, BID_STATUS_LABEL, formatDeadline, calcSavings } from '@/lib/marketplace'
import { formatKRW } from '@/lib/utils'
import type { RepairRequest, ShopBid } from '@/types'

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
        <div className="flex gap-3 text-xs text-gray-500 mb-3">
          <span>🗓 예상 {bid.estimatedDays}일</span>
          {bid.availableDate && <span>📅 {bid.availableDate} 가능</span>}
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

export default function RepairStatusPage() {
  const router = useRouter()
  const { requestId } = useParams<{ requestId: string }>()
  const supabase = createClient()

  const [request, setRequest] = useState<RepairRequest | null>(null)
  const [bids, setBids] = useState<ShopBid[]>([])
  const [loading, setLoading] = useState(true)
  const [accepting, setAccepting] = useState(false)

  const load = useCallback(async () => {
    const res = await fetch(`/api/repair-requests/${requestId}`)
    if (!res.ok) { router.replace('/main'); return }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data: any = await res.json()
    setRequest(mapRequest(data))
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    setBids((data.shop_bids ?? []).map((b: any) => mapBid(b)))
    setLoading(false)
  }, [requestId, router])

  useEffect(() => {
    load()

    // 실시간 입찰 업데이트 (Supabase Realtime)
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

  if (loading) return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="w-8 h-8 border-2 border-primary-200 border-t-primary-600 rounded-full animate-spin" />
    </div>
  )

  if (!request) return null

  const statusInfo = REQUEST_STATUS_LABEL[request.status]
  const canAccept = ['open','bidding'].includes(request.status)
  const dealerTotal = (request.dealerPartsMax ?? 0) + (request.dealerLaborMax ?? 0)
  const pendingBids = bids.filter(b => b.status === 'pending').sort((a, b) => a.totalCost - b.totalCost)
  const acceptedBid = bids.find(b => b.status === 'accepted')

  return (
    <div className="flex flex-col min-h-screen bg-surface-50">
      <header className="bg-white px-4 pt-14 pb-4 flex items-center gap-3 border-b border-gray-100">
        <button onClick={() => router.push('/main')} className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-500">←</button>
        <h1 className="text-lg font-black text-gray-900">입찰 현황</h1>
        <span className={`ml-auto text-xs font-bold px-2.5 py-1 rounded-full ${statusInfo.color}`}>
          {statusInfo.label}
        </span>
      </header>

      <div className="px-4 py-4 space-y-4">
        {/* 요약 */}
        <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm">
          <p className="text-xs text-gray-400 mb-1">수리 요청 내용</p>
          <p className="text-sm font-medium text-gray-800">{request.symptomSummary.slice(0, 80)}</p>
          {request.vehicleMaker && (
            <p className="text-xs text-gray-400 mt-1">🚗 {request.vehicleMaker} {request.vehicleModel}</p>
          )}
          <div className="flex items-center gap-3 mt-2 text-xs text-gray-500">
            <span>📍 {request.preferredLocation}</span>
            <span>⏰ {formatDeadline(request.bidDeadline)}</span>
            <span>📬 입찰 {request.bidCount}건</span>
          </div>
        </div>

        {/* 낙찰된 경우 */}
        {acceptedBid && (
          <div className="bg-green-50 rounded-2xl p-4 border border-green-200">
            <p className="text-sm font-bold text-green-800 mb-1">✅ 낙찰 완료</p>
            <p className="text-sm text-green-700">{acceptedBid.shop?.name} 에 연락을 기다려주세요</p>
            <p className="text-xs text-green-600 mt-1">📞 {acceptedBid.shop?.phone}</p>
          </div>
        )}

        {/* 딜러 기준가 */}
        {dealerTotal > 0 && (
          <div className="bg-gray-50 rounded-xl px-4 py-3 border border-gray-100">
            <div className="flex items-center justify-between">
              <p className="text-xs text-gray-500">제조사 대리점 기준가</p>
              <p className="text-sm font-bold text-gray-700 line-through">
                {formatKRW((request.dealerTotalMin ?? 0))} ~ {formatKRW(dealerTotal)}
              </p>
            </div>
          </div>
        )}

        {/* 입찰 목록 */}
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

        {/* 요청 취소 */}
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
      </div>
    </div>
  )
}
