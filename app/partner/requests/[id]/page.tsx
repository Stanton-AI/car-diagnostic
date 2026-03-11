'use client'
import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { getMyShop, mapRequest, mapBid, formatDeadline, REQUEST_STATUS_LABEL } from '@/lib/marketplace'
import { formatKRW } from '@/lib/utils'
import type { RepairRequest, ShopBid, PartnerShop } from '@/types'

export default function PartnerRequestDetailPage() {
  const router = useRouter()
  const { id: requestId } = useParams<{ id: string }>()
  const supabase = createClient()

  const [shop, setShop] = useState<PartnerShop | null>(null)
  const [request, setRequest] = useState<RepairRequest | null>(null)
  const [myBid, setMyBid] = useState<ShopBid | null>(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)

  // 입찰 폼
  const [partsCost, setPartsCost] = useState('')
  const [laborCost, setLaborCost] = useState('')
  const [estimatedDays, setEstimatedDays] = useState('1')
  const [availableDate, setAvailableDate] = useState('')
  const [bidNotes, setBidNotes] = useState('')

  useEffect(() => {
    const load = async () => {
      const myShop = await getMyShop(supabase)
      if (!myShop || myShop.status !== 'active') { router.replace('/partner'); return }
      setShop(myShop)

      const { data: rr } = await supabase
        .from('repair_requests')
        .select('*')
        .eq('id', requestId)
        .single()
      if (!rr) { router.replace('/partner/requests'); return }
      setRequest(mapRequest(rr))

      // 내 입찰 조회
      const { data: bid } = await supabase
        .from('shop_bids')
        .select('*')
        .eq('request_id', requestId)
        .eq('shop_id', myShop.id)
        .single()
      if (bid) setMyBid(mapBid(bid))

      setLoading(false)
    }
    load()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requestId])

  const handleSubmitBid = async () => {
    const pc = parseInt(partsCost.replace(/,/g, ''))
    const lc = parseInt(laborCost.replace(/,/g, ''))
    if (!pc || !lc || isNaN(pc) || isNaN(lc)) {
      alert('부품비와 공임비를 입력해주세요')
      return
    }
    setSubmitting(true)

    const res = await fetch('/api/shop-bids', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        requestId,
        partsCost: pc,
        laborCost: lc,
        estimatedDays: parseInt(estimatedDays) || 1,
        availableDate: availableDate || undefined,
        bidNotes: bidNotes.trim() || undefined,
      }),
    })

    setSubmitting(false)
    if (res.ok) {
      const data = await res.json()
      setMyBid({
        id: data.id, requestId, shopId: shop!.id,
        partsCost: pc, laborCost: lc, totalCost: pc + lc,
        estimatedDays: parseInt(estimatedDays) || 1,
        availableDate: availableDate || undefined, bidNotes: bidNotes || undefined,
        status: 'pending', commissionRate: 0.10, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
      })
    } else {
      const err = await res.json()
      alert(err.error ?? '입찰 실패')
    }
  }

  if (loading) return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="w-8 h-8 border-2 border-primary-200 border-t-primary-600 rounded-full animate-spin" />
    </div>
  )
  if (!request) return null

  const statusInfo = REQUEST_STATUS_LABEL[request.status]
  const totalCost = (parseInt(partsCost.replace(/,/g, '')) || 0) + (parseInt(laborCost.replace(/,/g, '')) || 0)
  const dealerMax = (request.dealerTotalMax ?? 0)
  const savings = dealerMax > 0 && totalCost > 0
    ? Math.round(((dealerMax - totalCost) / dealerMax) * 100)
    : 0

  const commissionPreview = Math.round(totalCost * (shop?.commissionRate ?? 0.10))
  const netRevenue = totalCost - commissionPreview

  return (
    <div className="flex flex-col min-h-screen bg-surface-50">
      <header className="bg-white px-4 pt-14 pb-4 flex items-center gap-3 border-b border-gray-100">
        <button onClick={() => router.back()} className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-500">←</button>
        <h1 className="text-lg font-black text-gray-900">견적 입찰</h1>
        <span className={`ml-auto text-xs font-bold px-2.5 py-1 rounded-full ${statusInfo.color}`}>
          {statusInfo.label}
        </span>
      </header>

      <div className="px-4 py-4 space-y-4 pb-8">

        {/* 요청 상세 */}
        <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm">
          <p className="text-xs text-gray-400 mb-1">수리 요청 내용</p>
          <p className="text-sm font-medium text-gray-800 leading-relaxed">{request.symptomSummary}</p>
          {request.vehicleMaker && (
            <p className="text-xs text-gray-500 mt-2">🚗 {request.vehicleMaker} {request.vehicleModel} · {request.vehicleYear}년식 · {request.vehicleMileage?.toLocaleString()}km</p>
          )}
          <div className="flex gap-3 mt-2 text-xs text-gray-500">
            <span>📍 {request.preferredLocation}</span>
            {request.preferredDate && <span>📅 희망일: {request.preferredDate}</span>}
            <span>⏰ {formatDeadline(request.bidDeadline)}</span>
          </div>
          {request.consumerNotes && (
            <div className="mt-2 p-2 bg-blue-50 rounded-lg">
              <p className="text-xs text-blue-700">💬 {request.consumerNotes}</p>
            </div>
          )}
        </div>

        {/* 딜러 기준가 */}
        {dealerMax > 0 && (
          <div className="bg-gray-50 rounded-xl px-4 py-3 border border-gray-100">
            <div className="flex items-center justify-between">
              <p className="text-xs text-gray-500">소비자에게 보이는 딜러 기준가</p>
              <p className="text-sm font-bold text-gray-500 line-through">
                ~ {formatKRW(dealerMax)}
              </p>
            </div>
            <p className="text-xs text-gray-400 mt-0.5">이 가격보다 낮게 입찰하면 소비자가 절감액을 확인합니다</p>
          </div>
        )}

        {/* 이미 입찰한 경우 */}
        {myBid ? (
          <div className={`rounded-2xl p-4 border ${
            myBid.status === 'accepted' ? 'bg-green-50 border-green-200' :
            myBid.status === 'rejected' ? 'bg-gray-50 border-gray-200' :
            'bg-blue-50 border-blue-200'
          }`}>
            <p className="font-bold text-gray-900 mb-3">
              {myBid.status === 'accepted' ? '🎉 낙찰되었습니다!' :
               myBid.status === 'rejected' ? '❌ 이번엔 다음 기회에' : '⏳ 입찰 완료 — 검토 대기 중'}
            </p>
            <div className="space-y-1.5 text-sm">
              <div className="flex justify-between"><span className="text-gray-500">부품비</span><span className="font-semibold">{formatKRW(myBid.partsCost)}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">공임비</span><span className="font-semibold">{formatKRW(myBid.laborCost)}</span></div>
              <div className="flex justify-between border-t border-gray-200 pt-1.5">
                <span className="font-bold">합계</span>
                <span className="font-black text-primary-600 text-base">{formatKRW(myBid.totalCost)}</span>
              </div>
              <div className="flex justify-between text-xs text-gray-400 pt-1">
                <span>수수료 ({((shop?.commissionRate ?? 0.10) * 100).toFixed(0)}%)</span>
                <span>-{formatKRW(Math.round(myBid.totalCost * (shop?.commissionRate ?? 0.10)))}</span>
              </div>
              <div className="flex justify-between text-xs font-semibold text-green-600">
                <span>순 수익</span>
                <span>{formatKRW(myBid.totalCost - Math.round(myBid.totalCost * (shop?.commissionRate ?? 0.10)))}</span>
              </div>
            </div>
          </div>
        ) : (
          /* 입찰 폼 */
          <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm space-y-4">
            <h2 className="font-bold text-gray-900">💰 견적 입력</h2>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-gray-600 mb-1.5 block">부품비 (원) *</label>
                <input
                  type="number"
                  value={partsCost}
                  onChange={e => setPartsCost(e.target.value)}
                  placeholder="30000"
                  className="w-full px-3 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-primary-400"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-600 mb-1.5 block">공임비 (원) *</label>
                <input
                  type="number"
                  value={laborCost}
                  onChange={e => setLaborCost(e.target.value)}
                  placeholder="50000"
                  className="w-full px-3 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-primary-400"
                />
              </div>
            </div>

            {/* 합계 미리보기 */}
            {totalCost > 0 && (
              <div className="bg-gray-50 rounded-xl p-3">
                <div className="flex justify-between text-sm font-bold mb-1">
                  <span>합계</span>
                  <span className="text-primary-600 text-base">{formatKRW(totalCost)}</span>
                </div>
                {savings > 0 && (
                  <p className="text-xs text-green-600">소비자 절감 {savings}% (대리점 대비)</p>
                )}
                <div className="flex justify-between text-xs text-gray-400 mt-1">
                  <span>수수료 ({((shop?.commissionRate ?? 0.10) * 100).toFixed(0)}%)</span>
                  <span>-{formatKRW(commissionPreview)}</span>
                </div>
                <div className="flex justify-between text-xs font-semibold text-green-600 mt-0.5">
                  <span>순 수익</span>
                  <span>{formatKRW(netRevenue)}</span>
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-gray-600 mb-1.5 block">예상 수리 기간</label>
                <select
                  value={estimatedDays}
                  onChange={e => setEstimatedDays(e.target.value)}
                  className="w-full px-3 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-primary-400 bg-white"
                >
                  {[1,2,3,4,5,7].map(d => (
                    <option key={d} value={d}>{d}일</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-600 mb-1.5 block">작업 가능일</label>
                <input
                  type="date"
                  value={availableDate}
                  onChange={e => setAvailableDate(e.target.value)}
                  min={new Date().toISOString().split('T')[0]}
                  className="w-full px-3 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-primary-400"
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-gray-600 mb-1.5 block">추가 메시지 (선택)</label>
              <textarea
                value={bidNotes}
                onChange={e => setBidNotes(e.target.value)}
                placeholder="정비소 장점, 추가 제공 서비스, 주의사항 등"
                rows={2}
                className="w-full px-3 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-primary-400 resize-none"
              />
            </div>

            <button
              onClick={handleSubmitBid}
              disabled={submitting || !partsCost || !laborCost}
              className="w-full py-4 bg-primary-600 text-white font-bold rounded-2xl hover:bg-primary-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {submitting ? (
                <><span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> 입찰 중...</>
              ) : `${totalCost > 0 ? formatKRW(totalCost) + ' ' : ''}입찰 제출`}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
