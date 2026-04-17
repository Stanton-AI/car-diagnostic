'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { getOrCreateGuestSessionId, formatDate, formatKRW, urgencyLabel } from '@/lib/utils'
import { REQUEST_STATUS_LABEL, formatDeadline } from '@/lib/marketplace'
import BottomNav from '@/components/nav/BottomNav'

interface ConvoSummary {
  id: string
  initial_symptom: string
  category: string | null
  urgency: string | null
  cost_min: number | null
  cost_max: number | null
  created_at: string
  vehicle_id: string | null
  vehicles: { maker: string; model: string; year: number } | null
  final_result: { causes?: Array<{ name: string; probability: number }> } | null
}

interface RepairSummary {
  id: string
  symptom_summary: string
  status: string
  urgency_level: string | null
  bid_count: number
  bid_deadline: string
  preferred_location: string
  vehicle_maker: string | null
  vehicle_model: string | null
  created_at: string
}

type TabType = 'diagnosis' | 'quote' | 'inprogress' | 'done'
type DiagSubTab = 'all' | 'my_car' | 'other'

// ── 진단 내역 카드 ──────────────────────────────────────────────────────
function ConvoCard({ convo }: { convo: ConvoSummary }) {
  const urgency = convo.urgency ? urgencyLabel(convo.urgency) : null
  const topCause = convo.final_result?.causes?.[0]

  return (
    <Link href={`/results/${convo.id}`} className="flex rounded-2xl overflow-hidden block transition-all hover:scale-[1.01]"
      style={{
        background: 'linear-gradient(135deg, #ffffff 0%, #faf9ff 100%)',
        border: '1px solid rgba(0,0,0,0.04)',
        boxShadow: '0 2px 12px rgba(0,0,0,0.04), 0 0 0 1px rgba(0,0,0,0.02)',
      }}
    >
      <div className="flex-1 p-4 min-w-0">
        <div className="flex items-start gap-3">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-xl flex-shrink-0 ${urgency?.bg ?? 'bg-gray-50'}`}>
            {convo.urgency === 'HIGH' ? '🚨' : convo.urgency === 'MID' ? '⚠️' : '✅'}
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-bold text-gray-900 text-sm truncate">{topCause?.name ?? convo.initial_symptom}</p>
            {convo.vehicles ? (
              <p className="text-xs text-primary-500 font-medium mt-0.5">🚗 {convo.vehicles.maker} {convo.vehicles.model} {convo.vehicles.year}년</p>
            ) : (
              <p className="text-xs text-gray-400 mt-0.5">차량 미등록</p>
            )}
            <div className="flex items-center gap-2 mt-1">
              {convo.category && <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">{convo.category}</span>}
              <span className="text-xs text-gray-400">{formatDate(convo.created_at)}</span>
            </div>
          </div>
          <div className="text-right flex-shrink-0">
            {urgency && <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${urgency.bg} ${urgency.color}`}>{urgency.label}</span>}
            {convo.cost_max && <p className="text-sm font-black text-gray-900 mt-1">{formatKRW(convo.cost_max)}</p>}
          </div>
        </div>
      </div>
    </Link>
  )
}

// ── 견적/수리 카드 ──────────────────────────────────────────────────────
function RepairCard({ repair }: { repair: RepairSummary }) {
  const statusInfo = REQUEST_STATUS_LABEL[repair.status] ?? { label: repair.status, color: 'bg-gray-100 text-gray-500' }
  const isQuoting = ['open', 'bidding'].includes(repair.status)
  const isInProgress = ['accepted', 'in_progress'].includes(repair.status)

  return (
    <Link href={`/repair/${repair.id}`} className="block">
      <div className={`bg-white rounded-2xl border shadow-sm hover:shadow-md transition-shadow p-4 ${
        isQuoting ? 'border-primary-200' : isInProgress ? 'border-purple-200' : 'border-gray-100'
      }`}>
        <div className="flex items-start justify-between gap-3 mb-2">
          <p className="font-bold text-gray-900 text-sm flex-1 line-clamp-2">{repair.symptom_summary}</p>
          <span className={`flex-shrink-0 text-xs font-bold px-2 py-0.5 rounded-full ${statusInfo.color}`}>
            {statusInfo.label}
          </span>
        </div>

        {repair.vehicle_maker && (
          <p className="text-xs text-primary-500 font-medium mb-2">🚗 {repair.vehicle_maker} {repair.vehicle_model}</p>
        )}

        <div className="flex items-center justify-between text-xs text-gray-400">
          <div className="flex items-center gap-3">
            <span>📍 {repair.preferred_location}</span>
            {isQuoting && repair.bid_count > 0 && (
              <span className="text-primary-500 font-semibold">📬 입찰 {repair.bid_count}건</span>
            )}
          </div>
          {isQuoting
            ? <span className="text-amber-500 font-semibold">⏰ {formatDeadline(repair.bid_deadline)}</span>
            : <span>{formatDate(repair.created_at)}</span>
          }
        </div>

        {isQuoting && repair.bid_count > 0 && (
          <div className="mt-3 py-2 px-3 bg-primary-50 rounded-xl flex items-center justify-between">
            <span className="text-xs font-bold text-primary-700">🎉 {repair.bid_count}개 견적 확인하기</span>
            <span className="text-primary-500 text-xs font-bold">→</span>
          </div>
        )}
        {isInProgress && (
          <div className="mt-3 py-2 px-3 bg-purple-50 rounded-xl flex items-center justify-between">
            <span className="text-xs font-bold text-purple-700">🔧 수리가 진행되고 있어요</span>
            <span className="text-purple-400 text-xs font-bold">→</span>
          </div>
        )}
      </div>
    </Link>
  )
}

// ── 서브필터 칩 ─────────────────────────────────────────────────────────
function SubFilterChip({ label, count, active, onClick }: { label: string; count: number; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${
        active
          ? 'bg-primary-600 text-white'
          : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
      }`}
    >
      {label}
      <span className={`text-[10px] px-1 py-0.5 rounded-full ${active ? 'bg-white/30 text-white' : 'bg-gray-200 text-gray-400'}`}>
        {count}
      </span>
    </button>
  )
}

// ── 메인 ────────────────────────────────────────────────────────────────
export default function HistoryPage() {
  const router = useRouter()
  const supabase = createClient()
  const [convos, setConvos] = useState<ConvoSummary[]>([])
  const [repairs, setRepairs] = useState<RepairSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<TabType>('diagnosis')
  const [diagSubTab, setDiagSubTab] = useState<DiagSubTab>('all')

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      const guestId = getOrCreateGuestSessionId()

      // 진단 내역
      let query = supabase
        .from('conversations')
        .select('id, initial_symptom, category, urgency, cost_min, cost_max, created_at, vehicle_id, final_result, vehicles(maker, model, year)')
        .not('final_result', 'is', null)
        .order('created_at', { ascending: false })
        .limit(50)

      if (user) query = query.eq('user_id', user.id)
      else query = query.eq('guest_session_id', guestId)

      const { data: convoData } = await query
      setConvos((convoData ?? []) as unknown as ConvoSummary[])

      // 견적/수리 내역 (로그인 사용자만)
      if (user) {
        const { data: repairData } = await supabase
          .from('repair_requests')
          .select('id, symptom_summary, status, urgency_level, bid_count, bid_deadline, preferred_location, vehicle_maker, vehicle_model, created_at')
          .eq('user_id', user.id)
          .neq('status', 'cancelled')
          .order('created_at', { ascending: false })
          .limit(30)

        const repairList = (repairData ?? []) as RepairSummary[]
        setRepairs(repairList)

        // 진행중인 견적이 있으면 견적 탭으로 시작
        const hasActive = repairList.some(r => ['open', 'bidding'].includes(r.status))
        if (hasActive) setActiveTab('quote')
      }

      setLoading(false)
    }
    load()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // 수리 상태별 분류
  const quoteRepairs     = repairs.filter(r => ['open', 'bidding'].includes(r.status))
  const inProgressRepairs = repairs.filter(r => ['accepted', 'in_progress'].includes(r.status))
  const doneRepairs      = repairs.filter(r => r.status === 'completed')

  // 진단 서브필터
  const myCarConvos    = convos.filter(c => c.vehicle_id !== null)
  const otherConvos    = convos.filter(c => c.vehicle_id === null)
  const filteredConvos = diagSubTab === 'my_car' ? myCarConvos : diagSubTab === 'other' ? otherConvos : convos

  const TAB_CFG: { key: TabType; label: string; count: number; pulse?: boolean }[] = [
    { key: 'diagnosis',   label: '🔍 진단내역',  count: convos.length },
    { key: 'quote',       label: '💬 견적요청',   count: quoteRepairs.length,      pulse: quoteRepairs.length > 0 },
    { key: 'inprogress',  label: '🔧 수리중',     count: inProgressRepairs.length, pulse: inProgressRepairs.length > 0 },
    { key: 'done',        label: '✅ 수리완료',   count: doneRepairs.length },
  ]

  return (
    <div className="flex flex-col min-h-screen bg-surface-50">
      <header className="px-4 pt-14 pb-0 flex items-center gap-3 sticky top-0 z-20"
        style={{
          background: 'rgba(255, 255, 255, 0.88)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          borderBottom: '1px solid rgba(0, 0, 0, 0.04)',
        }}
      >
        <button onClick={() => router.back()} className="w-9 h-9 flex items-center justify-center rounded-xl hover:bg-gray-100/60 text-gray-500 transition-all">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6" /></svg>
        </button>
        <h1 className="text-lg font-black text-gray-900">내역</h1>
      </header>

      {/* 메인 탭 */}
      <div className="px-2 flex gap-0 overflow-x-auto scrollbar-hide"
        style={{
          background: 'rgba(255, 255, 255, 0.92)',
          borderBottom: '1px solid rgba(0, 0, 0, 0.04)',
        }}
      >
        {TAB_CFG.map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`py-3 px-3 text-xs font-semibold border-b-2 transition-colors flex items-center gap-1 whitespace-nowrap flex-shrink-0 ${
              activeTab === tab.key ? 'border-primary-600 text-primary-600' : 'border-transparent text-gray-400 hover:text-gray-600'
            }`}
          >
            {tab.label}
            <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${
              tab.pulse
                ? 'bg-red-100 text-red-600 animate-pulse'
                : activeTab === tab.key
                  ? 'bg-primary-100 text-primary-600'
                  : 'bg-gray-100 text-gray-400'
            }`}>
              {tab.count}
            </span>
          </button>
        ))}
      </div>

      {/* 진단내역 서브필터 */}
      {activeTab === 'diagnosis' && (
        <div className="bg-white border-b border-gray-50 px-4 py-2.5 flex gap-2">
          <SubFilterChip label="전체"               count={convos.length}      active={diagSubTab === 'all'}     onClick={() => setDiagSubTab('all')} />
          <SubFilterChip label="🚗 내 차"           count={myCarConvos.length}  active={diagSubTab === 'my_car'}  onClick={() => setDiagSubTab('my_car')} />
          <SubFilterChip label="차량 미등록"         count={otherConvos.length} active={diagSubTab === 'other'}   onClick={() => setDiagSubTab('other')} />
        </div>
      )}

      <div className="flex-1 px-4 py-4 pb-24">
        {loading ? (
          <div className="flex justify-center pt-16">
            <div className="w-8 h-8 border-2 border-primary-200 border-t-primary-600 rounded-full animate-spin" />
          </div>

        ) : activeTab === 'diagnosis' ? (
          // ── 진단 내역 탭 ──
          filteredConvos.length === 0 ? (
            <div className="text-center pt-16">
              <div className="text-5xl mb-4">🔍</div>
              <p className="font-bold text-gray-700 mb-2">
                {diagSubTab === 'my_car' ? '내 차 진단 내역이 없어요' : diagSubTab === 'other' ? '미등록 차량 진단 내역이 없어요' : '진단 내역이 없습니다'}
              </p>
              <p className="text-sm text-gray-400 mb-6">차량 증상을 입력해서 AI 진단을 받아보세요</p>
              <Link href="/chat" className="inline-block text-white font-bold px-6 py-3 rounded-2xl text-sm transition-all active:scale-[0.98]"
                style={{
                  background: 'linear-gradient(135deg, #5b4fcf 0%, #7c6fe0 100%)',
                  boxShadow: '0 4px 16px rgba(91, 79, 207, 0.25)',
                }}
              >진단 시작하기</Link>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredConvos.map(convo => (
                <ConvoCard key={convo.id} convo={convo} />
              ))}
            </div>
          )

        ) : activeTab === 'quote' ? (
          // ── 견적 요청 탭 ──
          quoteRepairs.length === 0 ? (
            <div className="text-center pt-16">
              <div className="text-5xl mb-4">💬</div>
              <p className="font-bold text-gray-700 mb-2">진행 중인 견적 요청이 없어요</p>
              <p className="text-sm text-gray-400 mb-6">AI 진단 후 정비소 견적을 요청해보세요</p>
              <Link href="/main" className="inline-block text-white font-bold px-6 py-3 rounded-2xl text-sm transition-all active:scale-[0.98]"
                style={{
                  background: 'linear-gradient(135deg, #5b4fcf 0%, #7c6fe0 100%)',
                  boxShadow: '0 4px 16px rgba(91, 79, 207, 0.25)',
                }}
              >진단 시작하기</Link>
            </div>
          ) : (
            <div className="space-y-3">
              {quoteRepairs.map(r => <RepairCard key={r.id} repair={r} />)}
            </div>
          )

        ) : activeTab === 'inprogress' ? (
          // ── 수리 중 탭 ──
          inProgressRepairs.length === 0 ? (
            <div className="text-center pt-16">
              <div className="text-5xl mb-4">🔧</div>
              <p className="font-bold text-gray-700 mb-2">수리 중인 내역이 없어요</p>
              <p className="text-sm text-gray-400">낙찰 완료 후 정비소에서 수리가 시작되면 여기에 표시돼요</p>
            </div>
          ) : (
            <div className="space-y-3">
              {inProgressRepairs.map(r => <RepairCard key={r.id} repair={r} />)}
            </div>
          )

        ) : (
          // ── 수리 완료 탭 ──
          doneRepairs.length === 0 ? (
            <div className="text-center pt-16">
              <div className="text-5xl mb-4">✅</div>
              <p className="font-bold text-gray-700 mb-2">완료된 수리 내역이 없어요</p>
              <p className="text-sm text-gray-400">수리가 완료되면 여기서 확인할 수 있어요</p>
            </div>
          ) : (
            <div className="space-y-3">
              {doneRepairs.map(r => <RepairCard key={r.id} repair={r} />)}
            </div>
          )
        )}
      </div>

      <BottomNav />
    </div>
  )
}
