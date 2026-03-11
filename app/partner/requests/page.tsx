'use client'
import { useState, useEffect, useCallback } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { getMyShop, mapRequest, REQUEST_STATUS_LABEL, formatDeadline, SHOP_CATEGORIES } from '@/lib/marketplace'
import { formatKRW } from '@/lib/utils'
import type { RepairRequest, PartnerShop } from '@/types'

type TabType = 'new' | 'bidding' | 'won' | 'done'

const URGENCY_COLOR: Record<string, string> = {
  HIGH: 'text-red-600 bg-red-50',
  MID:  'text-amber-600 bg-amber-50',
  LOW:  'text-green-600 bg-green-50',
}
const URGENCY_LABEL: Record<string, string> = {
  HIGH: '즉시', MID: '조기', LOW: '여유',
}
const URGENCY_ORDER: Record<string, number> = { HIGH: 0, MID: 1, LOW: 2 }

interface BidWithRequest {
  id: string
  status: string
  parts_cost: number
  labor_cost: number
  total_cost: number
  created_at: string
  request_id: string
  repair_requests: {
    id: string
    symptom_summary: string
    status: string
    vehicle_maker: string | null
    vehicle_model: string | null
    preferred_location: string
    urgency_level: string | null
  } | null
}

interface JobRow {
  id: string
  status: string
  completed_at: string | null
  actual_total_cost: number | null
  repair_requests: {
    symptom_summary: string
    vehicle_maker: string | null
    vehicle_model: string | null
    preferred_location: string
  } | null
  shop_bids: { total_cost: number } | null
}

export default function PartnerRequestsPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const supabase = createClient()
  const [shop, setShop] = useState<PartnerShop | null>(null)
  const [activeTab, setActiveTab] = useState<TabType>(
    (searchParams.get('tab') as TabType) ?? 'new'
  )
  const [loading, setLoading] = useState(true)

  // 탭별 데이터
  const [newRequests, setNewRequests] = useState<RepairRequest[]>([])
  const [myBidIds, setMyBidIds] = useState<Set<string>>(new Set())
  const [pendingBids, setPendingBids] = useState<BidWithRequest[]>([])
  const [wonBids, setWonBids] = useState<BidWithRequest[]>([])
  const [doneJobs, setDoneJobs] = useState<JobRow[]>([])

  const load = useCallback(async () => {
    const myShop = await getMyShop(supabase)
    if (!myShop || myShop.status !== 'active') { router.replace('/partner'); return }
    setShop(myShop)

    // 1) 새 요청 (open/bidding)
    const { data: rr } = await supabase
      .from('repair_requests')
      .select('*')
      .in('status', ['open', 'bidding'])
      .order('created_at', { ascending: false })
      .limit(50)

    setNewRequests(
      (rr ?? []).map(mapRequest).sort((a, b) => {
        const ao = URGENCY_ORDER[a.urgencyLevel ?? 'LOW'] ?? 2
        const bo = URGENCY_ORDER[b.urgencyLevel ?? 'LOW'] ?? 2
        if (ao !== bo) return ao - bo
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      })
    )

    // 2) 내 입찰 전체 (pending + accepted + rejected)
    const { data: allBids } = await supabase
      .from('shop_bids')
      .select('id, status, parts_cost, labor_cost, total_cost, created_at, request_id, repair_requests(id, symptom_summary, status, vehicle_maker, vehicle_model, preferred_location, urgency_level)')
      .eq('shop_id', myShop.id)
      .order('created_at', { ascending: false })
      .limit(100)

    const bids = (allBids ?? []) as unknown as BidWithRequest[]
    setMyBidIds(new Set(bids.map(b => b.request_id)))
    setPendingBids(bids.filter(b => b.status === 'pending'))
    setWonBids(bids.filter(b => b.status === 'accepted'))

    // 3) 완료 작업
    const { data: jobs } = await supabase
      .from('repair_jobs')
      .select('id, status, completed_at, actual_total_cost, repair_requests(symptom_summary, vehicle_maker, vehicle_model, preferred_location), shop_bids(total_cost)')
      .eq('shop_id', myShop.id)
      .eq('status', 'completed')
      .order('completed_at', { ascending: false })
      .limit(30)

    setDoneJobs((jobs ?? []) as unknown as JobRow[])
    setLoading(false)
  }, [supabase, router])

  useEffect(() => {
    load()
    const channel = supabase
      .channel('partner-requests-all')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'repair_requests' }, () => load())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'shop_bids' }, () => load())
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [load, supabase])

  if (loading) return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="w-8 h-8 border-2 border-primary-200 border-t-primary-600 rounded-full animate-spin" />
    </div>
  )

  const tabs: { key: TabType; label: string; count: number; badge?: boolean }[] = [
    { key: 'new',     label: '새 요청',   count: newRequests.length, badge: newRequests.length > 0 },
    { key: 'bidding', label: '입찰 중',   count: pendingBids.length },
    { key: 'won',     label: '낙찰',      count: wonBids.length, badge: wonBids.length > 0 },
    { key: 'done',    label: '수리 완료', count: doneJobs.length },
  ]

  return (
    <div className="flex flex-col min-h-screen bg-surface-50">
      <header className="bg-white px-4 pt-14 pb-0 flex items-center gap-3 border-b border-gray-100">
        <button onClick={() => router.push('/partner')} className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-500">←</button>
        <h1 className="text-lg font-black text-gray-900">견적 관리</h1>
      </header>

      {/* 탭 */}
      <div className="bg-white border-b border-gray-100 px-2 flex gap-0.5 overflow-x-auto">
        {tabs.map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`py-3 px-3 text-sm font-semibold border-b-2 transition-colors flex items-center gap-1.5 whitespace-nowrap flex-shrink-0 ${
              activeTab === tab.key ? 'border-primary-600 text-primary-600' : 'border-transparent text-gray-400 hover:text-gray-600'
            }`}
          >
            {tab.label}
            <span className={`text-xs px-1.5 py-0.5 rounded-full font-bold ${
              tab.badge
                ? 'bg-red-100 text-red-600 animate-pulse'
                : activeTab === tab.key ? 'bg-primary-100 text-primary-600' : 'bg-gray-100 text-gray-400'
            }`}>
              {tab.count}
            </span>
          </button>
        ))}
      </div>

      <div className="flex-1 px-4 py-4 space-y-3">

        {/* ── 새 요청 탭 ── */}
        {activeTab === 'new' && (
          newRequests.length === 0 ? (
            <EmptyState icon="📭" title="현재 새 요청이 없습니다" sub="새 요청이 들어오면 알림을 드릴게요" />
          ) : newRequests.map(req => {
            const hasBid = myBidIds.has(req.id)
            const statusInfo = REQUEST_STATUS_LABEL[req.status]
            return (
              <div key={req.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
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
                          <span className="text-xs text-gray-400">{SHOP_CATEGORIES[req.diagnosisCategory] ?? req.diagnosisCategory}</span>
                        )}
                        <span className={`text-xs font-semibold px-1.5 py-0.5 rounded-md ${statusInfo.color}`}>{statusInfo.label}</span>
                      </div>
                      <p className="text-sm font-medium text-gray-800 leading-snug">
                        {req.symptomSummary.slice(0, 60)}{req.symptomSummary.length > 60 ? '...' : ''}
                      </p>
                    </div>
                    {hasBid && <span className="flex-shrink-0 text-xs bg-green-100 text-green-700 font-bold px-2 py-1 rounded-lg">입찰완료</span>}
                  </div>
                  <div className="flex flex-wrap gap-3 text-xs text-gray-500 mt-2">
                    <span>📍 {req.preferredLocation}</span>
                    {req.vehicleMaker && <span>🚗 {req.vehicleMaker} {req.vehicleModel}</span>}
                    <span>🕐 {formatDeadline(req.bidDeadline)}</span>
                    <span>📬 입찰 {req.bidCount}건</span>
                  </div>
                  {req.dealerTotalMin && req.dealerTotalMax && (
                    <div className="mt-2 pt-2 border-t border-gray-50 flex items-center justify-between text-xs">
                      <span className="text-gray-400">딜러 기준가</span>
                      <span className="font-semibold text-gray-500 line-through">{formatKRW(req.dealerTotalMin)} ~ {formatKRW(req.dealerTotalMax)}</span>
                    </div>
                  )}
                </div>
                <div className="border-t border-gray-50 px-4 py-3">
                  <button
                    onClick={() => router.push(`/partner/requests/${req.id}`)}
                    className={`w-full py-2.5 rounded-xl text-sm font-bold transition-colors ${
                      hasBid ? 'bg-gray-100 text-gray-500 hover:bg-gray-200' : 'bg-primary-600 text-white hover:bg-primary-700'
                    }`}
                  >
                    {hasBid ? '내 입찰 확인' : '견적 입찰하기'}
                  </button>
                </div>
              </div>
            )
          })
        )}

        {/* ── 입찰 중 탭 ── */}
        {activeTab === 'bidding' && (
          pendingBids.length === 0 ? (
            <EmptyState icon="⏳" title="입찰 중인 견적이 없습니다" sub="새 요청에서 견적을 제출해보세요" />
          ) : pendingBids.map(bid => {
            const rr = bid.repair_requests
            return (
              <div key={bid.id} className="bg-white rounded-2xl border border-amber-100 shadow-sm p-4">
                <div className="flex items-start justify-between gap-2 mb-2">
                  <p className="text-sm font-medium text-gray-800 flex-1 leading-snug">
                    {rr?.symptom_summary?.slice(0, 60) ?? ''}
                  </p>
                  <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">검토 대기</span>
                </div>
                {rr && (
                  <div className="text-xs text-gray-500 space-y-0.5">
                    {rr.vehicle_maker && <p>🚗 {rr.vehicle_maker} {rr.vehicle_model}</p>}
                    <p>📍 {rr.preferred_location}</p>
                  </div>
                )}
                <div className="mt-3 pt-3 border-t border-gray-50 flex items-center justify-between">
                  <div className="text-xs text-gray-400">
                    <span>부품 {formatKRW(bid.parts_cost)} + 공임 {formatKRW(bid.labor_cost)}</span>
                  </div>
                  <span className="text-base font-black text-primary-600">{formatKRW(bid.total_cost)}</span>
                </div>
                <button
                  onClick={() => router.push(`/partner/requests/${bid.request_id}`)}
                  className="mt-3 w-full py-2 border border-gray-200 rounded-xl text-sm text-gray-500 hover:bg-gray-50 transition-colors"
                >
                  상세 보기
                </button>
              </div>
            )
          })
        )}

        {/* ── 낙찰 탭 ── */}
        {activeTab === 'won' && (
          wonBids.length === 0 ? (
            <EmptyState icon="🏆" title="낙찰된 견적이 없습니다" sub="소비자가 내 견적을 선택하면 여기에 표시됩니다" />
          ) : wonBids.map(bid => {
            const rr = bid.repair_requests
            return (
              <div key={bid.id} className="bg-green-50 rounded-2xl border border-green-200 shadow-sm p-4">
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div>
                    <p className="text-xs font-bold text-green-700 mb-1">🎉 낙찰 완료</p>
                    <p className="text-sm font-medium text-gray-800 leading-snug">
                      {rr?.symptom_summary?.slice(0, 60) ?? ''}
                    </p>
                  </div>
                  <span className="text-base font-black text-green-700 flex-shrink-0">{formatKRW(bid.total_cost)}</span>
                </div>
                {rr && (
                  <div className="text-xs text-gray-600 space-y-0.5 mt-2">
                    {rr.vehicle_maker && <p>🚗 {rr.vehicle_maker} {rr.vehicle_model}</p>}
                    <p>📍 {rr.preferred_location}</p>
                  </div>
                )}
                <button
                  onClick={() => router.push('/partner/jobs')}
                  className="mt-3 w-full py-2.5 bg-green-600 text-white rounded-xl text-sm font-bold hover:bg-green-700 transition-colors"
                >
                  작업 관리하기 →
                </button>
              </div>
            )
          })
        )}

        {/* ── 수리 완료 탭 ── */}
        {activeTab === 'done' && (
          doneJobs.length === 0 ? (
            <EmptyState icon="✅" title="완료된 수리가 없습니다" sub="수리를 완료하면 여기에 기록됩니다" />
          ) : doneJobs.map(job => {
            const rr = job.repair_requests
            const revenue = job.actual_total_cost ?? job.shop_bids?.total_cost ?? 0
            const commission = Math.round(revenue * (shop?.commissionRate ?? 0.10))
            return (
              <div key={job.id} className="bg-white rounded-2xl border border-gray-100 p-4">
                <div className="flex items-start justify-between gap-2 mb-2">
                  <p className="text-sm font-medium text-gray-800 flex-1">
                    {rr?.symptom_summary?.slice(0, 50) ?? ''}
                  </p>
                  <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">완료</span>
                </div>
                {rr && (
                  <div className="text-xs text-gray-500 space-y-0.5">
                    {rr.vehicle_maker && <p>🚗 {rr.vehicle_maker} {rr.vehicle_model}</p>}
                    <p>📍 {rr.preferred_location}</p>
                  </div>
                )}
                <div className="mt-3 pt-3 border-t border-gray-50 text-xs text-gray-500">
                  <div className="flex justify-between">
                    <span>매출</span><span className="font-semibold">{formatKRW(revenue)}</span>
                  </div>
                  <div className="flex justify-between text-gray-400 mt-0.5">
                    <span>수수료 ({((shop?.commissionRate ?? 0.10) * 100).toFixed(0)}%)</span>
                    <span>-{formatKRW(commission)}</span>
                  </div>
                  <div className="flex justify-between font-bold text-green-600 mt-1">
                    <span>순 수익</span><span>{formatKRW(revenue - commission)}</span>
                  </div>
                </div>
              </div>
            )
          })
        )}

      </div>
    </div>
  )
}

function EmptyState({ icon, title, sub }: { icon: string; title: string; sub: string }) {
  return (
    <div className="bg-white rounded-2xl p-8 text-center border border-gray-100 mt-4">
      <p className="text-4xl mb-3">{icon}</p>
      <p className="font-bold text-gray-700">{title}</p>
      <p className="text-sm text-gray-400 mt-1">{sub}</p>
    </div>
  )
}
