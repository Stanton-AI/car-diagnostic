'use client'
import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { getMyShop, mapRequest, REQUEST_STATUS_LABEL, formatDeadline, SHOP_CATEGORIES } from '@/lib/marketplace'
import { formatKRW } from '@/lib/utils'
import type { RepairRequest, PartnerShop } from '@/types'

const URGENCY_COLOR: Record<string, string> = {
  HIGH: 'text-red-600 bg-red-50',
  MID:  'text-amber-600 bg-amber-50',
  LOW:  'text-green-600 bg-green-50',
}
const URGENCY_LABEL: Record<string, string> = {
  HIGH: '즉시', MID: '조기', LOW: '여유',
}

export default function PartnerRequestsPage() {
  const router = useRouter()
  const supabase = createClient()
  const [shop, setShop] = useState<PartnerShop | null>(null)
  const [requests, setRequests] = useState<RepairRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [myBidIds, setMyBidIds] = useState<Set<string>>(new Set())

  const load = useCallback(async () => {
    const myShop = await getMyShop(supabase)
    if (!myShop || myShop.status !== 'active') {
      router.replace('/partner')
      return
    }
    setShop(myShop)

    // 활성 요청 목록
    const { data: rr } = await supabase
      .from('repair_requests')
      .select('*')
      .in('status', ['open','bidding'])
      .order('created_at', { ascending: false })
      .limit(50)

    // urgency_level은 DB에서 알파벳 정렬되므로 클라이언트에서 재정렬 (HIGH→MID→LOW)
    const URGENCY_ORDER: Record<string, number> = { HIGH: 0, MID: 1, LOW: 2 }
    setRequests(
      (rr ?? [])
        .map(mapRequest)
        .sort((a, b) => {
          const ao = URGENCY_ORDER[a.urgencyLevel ?? 'LOW'] ?? 2
          const bo = URGENCY_ORDER[b.urgencyLevel ?? 'LOW'] ?? 2
          if (ao !== bo) return ao - bo
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        })
    )

    // 내가 이미 입찰한 요청 ID
    const { data: myBids } = await supabase
      .from('shop_bids')
      .select('request_id')
      .eq('shop_id', myShop.id)
    setMyBidIds(new Set((myBids ?? []).map(b => b.request_id)))

    setLoading(false)
  }, [supabase, router])

  useEffect(() => {
    load()
    // 실시간 새 요청 알림
    const channel = supabase
      .channel('new-requests')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'repair_requests' }, () => load())
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [load, supabase])

  if (loading) return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="w-8 h-8 border-2 border-primary-200 border-t-primary-600 rounded-full animate-spin" />
    </div>
  )

  return (
    <div className="flex flex-col min-h-screen bg-surface-50">
      <header className="bg-white px-4 pt-14 pb-4 flex items-center gap-3 border-b border-gray-100">
        <button onClick={() => router.push('/partner')} className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-500">←</button>
        <h1 className="text-lg font-black text-gray-900">견적 요청 목록</h1>
        <span className="ml-auto text-xs text-gray-400">{requests.length}건</span>
      </header>

      <div className="px-4 py-4 space-y-3">
        {requests.length === 0 ? (
          <div className="bg-white rounded-2xl p-8 text-center border border-gray-100">
            <p className="text-4xl mb-3">📭</p>
            <p className="font-bold text-gray-700">현재 새 요청이 없습니다</p>
            <p className="text-sm text-gray-400 mt-1">새 요청이 들어오면 알림을 드릴게요</p>
          </div>
        ) : requests.map(req => {
          const hasBid = myBidIds.has(req.id)
          const statusInfo = REQUEST_STATUS_LABEL[req.status]

          return (
            <div
              key={req.id}
              className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden"
            >
              <div className="p-4">
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      {req.urgencyLevel && (
                        <span className={`text-xs font-bold px-1.5 py-0.5 rounded-md ${URGENCY_COLOR[req.urgencyLevel]}`}>
                          {URGENCY_LABEL[req.urgencyLevel]}
                        </span>
                      )}
                      {req.diagnosisCategory && (
                        <span className="text-xs text-gray-400">
                          {SHOP_CATEGORIES[req.diagnosisCategory] ?? req.diagnosisCategory}
                        </span>
                      )}
                      <span className={`text-xs font-semibold px-1.5 py-0.5 rounded-md ${statusInfo.color}`}>
                        {statusInfo.label}
                      </span>
                    </div>
                    <p className="text-sm font-medium text-gray-800 leading-snug">
                      {req.symptomSummary.slice(0, 60)}{req.symptomSummary.length > 60 ? '...' : ''}
                    </p>
                  </div>
                  {hasBid && (
                    <span className="flex-shrink-0 text-xs bg-green-100 text-green-700 font-bold px-2 py-1 rounded-lg">입찰완료</span>
                  )}
                </div>

                <div className="flex flex-wrap gap-3 text-xs text-gray-500 mt-2">
                  <span>📍 {req.preferredLocation}</span>
                  {req.vehicleMaker && <span>🚗 {req.vehicleMaker} {req.vehicleModel}</span>}
                  <span>🕐 {formatDeadline(req.bidDeadline)}</span>
                  <span>📬 입찰 {req.bidCount}건</span>
                </div>

                {/* 딜러 기준가 */}
                {req.dealerTotalMin && req.dealerTotalMax && (
                  <div className="mt-2 pt-2 border-t border-gray-50 flex items-center justify-between text-xs">
                    <span className="text-gray-400">딜러 기준가</span>
                    <span className="font-semibold text-gray-600 line-through">
                      {formatKRW(req.dealerTotalMin)} ~ {formatKRW(req.dealerTotalMax)}
                    </span>
                  </div>
                )}
              </div>

              <div className="border-t border-gray-50 px-4 py-3">
                <button
                  onClick={() => router.push(`/partner/requests/${req.id}`)}
                  className={`w-full py-2.5 rounded-xl text-sm font-bold transition-colors ${
                    hasBid
                      ? 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                      : 'bg-primary-600 text-white hover:bg-primary-700'
                  }`}
                >
                  {hasBid ? '내 입찰 확인' : '견적 입찰하기'}
                </button>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
