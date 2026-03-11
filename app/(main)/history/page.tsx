'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { getOrCreateGuestSessionId, formatDate, formatKRW, urgencyLabel } from '@/lib/utils'
import { REQUEST_STATUS_LABEL, formatDeadline } from '@/lib/marketplace'

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

type TabType = 'diagnosis' | 'repair'

// ── 진단 내역 카드 ──────────────────────────────────────────────────────
function ConvoCard({
  convo,
  onDeleteRequest,
  isConfirming,
  isDeleting,
  onDeleteConfirm,
  onDeleteCancel,
}: {
  convo: ConvoSummary
  onDeleteRequest: () => void
  isConfirming: boolean
  isDeleting: boolean
  onDeleteConfirm: () => void
  onDeleteCancel: () => void
}) {
  const urgency = convo.urgency ? urgencyLabel(convo.urgency) : null
  const topCause = convo.final_result?.causes?.[0]

  if (isConfirming) {
    return (
      <div className="bg-red-50 rounded-2xl p-4 border border-red-200 animate-fade-up">
        <p className="text-sm font-semibold text-red-800 mb-1">이 진단 내역을 삭제할까요?</p>
        <p className="text-xs text-red-500 mb-3 truncate">{topCause?.name ?? convo.initial_symptom}</p>
        <div className="flex gap-2">
          <button onClick={onDeleteCancel} disabled={isDeleting} className="flex-1 py-2.5 border border-gray-200 bg-white text-gray-600 rounded-xl text-sm font-medium hover:bg-gray-50 disabled:opacity-50 transition-colors">취소</button>
          <button onClick={onDeleteConfirm} disabled={isDeleting} className="flex-1 py-2.5 bg-red-500 text-white rounded-xl text-sm font-semibold hover:bg-red-600 disabled:opacity-60 transition-colors">
            {isDeleting ? '삭제 중...' : '삭제'}
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow overflow-hidden">
      <Link href={`/results/${convo.id}`} className="flex-1 block p-4 min-w-0">
        <div className="flex items-start gap-3">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-xl flex-shrink-0 ${urgency?.bg ?? 'bg-gray-50'}`}>
            {convo.urgency === 'HIGH' ? '🚨' : convo.urgency === 'MID' ? '⚠️' : '✅'}
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-bold text-gray-900 text-sm truncate">{topCause?.name ?? convo.initial_symptom}</p>
            {convo.vehicles && (
              <p className="text-xs text-primary-500 font-medium mt-0.5">🚗 {convo.vehicles.maker} {convo.vehicles.model} {convo.vehicles.year}년</p>
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
      </Link>
      <button onClick={onDeleteRequest} className="flex items-center justify-center w-12 border-l border-gray-100 text-gray-300 hover:text-red-400 hover:bg-red-50 transition-colors flex-shrink-0" aria-label="진단 내역 삭제">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
        </svg>
      </button>
    </div>
  )
}

// ── 견적 요청 카드 ──────────────────────────────────────────────────────
function RepairCard({ repair }: { repair: RepairSummary }) {
  const statusInfo = REQUEST_STATUS_LABEL[repair.status] ?? { label: repair.status, color: 'bg-gray-100 text-gray-500' }
  const isActive = ['open', 'bidding'].includes(repair.status)

  return (
    <Link href={`/repair/${repair.id}`} className="block">
      <div className={`bg-white rounded-2xl border shadow-sm hover:shadow-md transition-shadow p-4 ${
        isActive ? 'border-primary-200' : 'border-gray-100'
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
            {isActive && <span className="text-primary-500 font-semibold">📬 입찰 {repair.bid_count}건</span>}
          </div>
          {isActive
            ? <span className="text-amber-500 font-semibold">⏰ {formatDeadline(repair.bid_deadline)}</span>
            : <span>{formatDate(repair.created_at)}</span>
          }
        </div>

        {isActive && repair.bid_count > 0 && (
          <div className="mt-3 py-2 px-3 bg-primary-50 rounded-xl flex items-center justify-between">
            <span className="text-xs font-bold text-primary-700">🎉 {repair.bid_count}개 견적 확인하기</span>
            <span className="text-primary-500 text-xs font-bold">→</span>
          </div>
        )}
      </div>
    </Link>
  )
}

// ── 메인 ────────────────────────────────────────────────────────────────
export default function HistoryPage() {
  const router = useRouter()
  const supabase = createClient()
  const [convos, setConvos] = useState<ConvoSummary[]>([])
  const [repairs, setRepairs] = useState<RepairSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<TabType>('diagnosis')

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

      // 견적 요청 (로그인 사용자만)
      if (user) {
        const { data: repairData } = await supabase
          .from('repair_requests')
          .select('id, symptom_summary, status, urgency_level, bid_count, bid_deadline, preferred_location, vehicle_maker, vehicle_model, created_at')
          .eq('user_id', user.id)
          .neq('status', 'cancelled')
          .order('created_at', { ascending: false })
          .limit(20)

        const repairList = (repairData ?? []) as RepairSummary[]
        setRepairs(repairList)

        // 진행중인 견적이 있으면 견적 탭으로 시작
        const hasActive = repairList.some(r => ['open', 'bidding'].includes(r.status))
        if (hasActive) setActiveTab('repair')
      }

      setLoading(false)
    }
    load()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleDelete = async (id: string) => {
    setDeletingId(id)
    const guestId = getOrCreateGuestSessionId()
    try {
      const res = await fetch(`/api/conversations?id=${id}`, {
        method: 'DELETE',
        headers: { 'x-guest-session-id': guestId },
      })
      if (res.ok) setConvos(prev => prev.filter(c => c.id !== id))
    } catch (err) {
      console.error('Delete error:', err)
    } finally {
      setDeletingId(null)
      setDeleteConfirmId(null)
    }
  }

  const activeRepairs = repairs.filter(r => ['open', 'bidding'].includes(r.status))
  const pastRepairs = repairs.filter(r => !['open', 'bidding'].includes(r.status))

  return (
    <div className="flex flex-col min-h-screen bg-surface-50">
      <header className="bg-white px-4 pt-14 pb-0 flex items-center gap-3 border-b border-gray-100">
        <button onClick={() => router.back()} className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-500">←</button>
        <h1 className="text-lg font-black text-gray-900">내역</h1>
      </header>

      {/* 탭 */}
      <div className="bg-white border-b border-gray-100 px-4 flex gap-1">
        <button
          onClick={() => setActiveTab('diagnosis')}
          className={`py-3 px-3 text-sm font-semibold border-b-2 transition-colors flex items-center gap-1.5 ${
            activeTab === 'diagnosis' ? 'border-primary-600 text-primary-600' : 'border-transparent text-gray-400 hover:text-gray-600'
          }`}
        >
          🔍 진단 내역
          <span className={`text-xs px-1.5 py-0.5 rounded-full font-bold ${activeTab === 'diagnosis' ? 'bg-primary-100 text-primary-600' : 'bg-gray-100 text-gray-400'}`}>
            {convos.length}
          </span>
        </button>
        <button
          onClick={() => setActiveTab('repair')}
          className={`py-3 px-3 text-sm font-semibold border-b-2 transition-colors flex items-center gap-1.5 ${
            activeTab === 'repair' ? 'border-primary-600 text-primary-600' : 'border-transparent text-gray-400 hover:text-gray-600'
          }`}
        >
          🔧 견적 요청
          {activeRepairs.length > 0 && (
            <span className="text-xs px-1.5 py-0.5 rounded-full font-bold bg-red-100 text-red-600 animate-pulse">
              {activeRepairs.length}
            </span>
          )}
          {activeRepairs.length === 0 && (
            <span className={`text-xs px-1.5 py-0.5 rounded-full font-bold ${activeTab === 'repair' ? 'bg-primary-100 text-primary-600' : 'bg-gray-100 text-gray-400'}`}>
              {repairs.length}
            </span>
          )}
        </button>
      </div>

      <div className="flex-1 px-4 py-4">
        {loading ? (
          <div className="flex justify-center pt-16">
            <div className="w-8 h-8 border-2 border-primary-200 border-t-primary-600 rounded-full animate-spin" />
          </div>
        ) : activeTab === 'diagnosis' ? (
          // ── 진단 내역 탭 ──
          convos.length === 0 ? (
            <div className="text-center pt-16">
              <div className="text-5xl mb-4">🔍</div>
              <p className="font-bold text-gray-700 mb-2">진단 내역이 없습니다</p>
              <p className="text-sm text-gray-400 mb-6">차량 증상을 입력해서 AI 진단을 받아보세요</p>
              <Link href="/chat" className="inline-block bg-primary-600 text-white font-bold px-6 py-3 rounded-2xl text-sm">진단 시작하기</Link>
            </div>
          ) : (
            <div className="space-y-3">
              {convos.map(convo => (
                <ConvoCard
                  key={convo.id}
                  convo={convo}
                  isConfirming={deleteConfirmId === convo.id}
                  isDeleting={deletingId === convo.id}
                  onDeleteRequest={() => setDeleteConfirmId(convo.id)}
                  onDeleteConfirm={() => handleDelete(convo.id)}
                  onDeleteCancel={() => setDeleteConfirmId(null)}
                />
              ))}
            </div>
          )
        ) : (
          // ── 견적 요청 탭 ──
          repairs.length === 0 ? (
            <div className="text-center pt-16">
              <div className="text-5xl mb-4">🔧</div>
              <p className="font-bold text-gray-700 mb-2">견적 요청 내역이 없습니다</p>
              <p className="text-sm text-gray-400 mb-6">AI 진단 후 정비소 견적을 요청해보세요</p>
              <Link href="/main" className="inline-block bg-primary-600 text-white font-bold px-6 py-3 rounded-2xl text-sm">진단 시작하기</Link>
            </div>
          ) : (
            <div className="space-y-3">
              {activeRepairs.length > 0 && (
                <>
                  <p className="text-xs font-bold text-primary-500 uppercase tracking-wide px-1">진행 중 ({activeRepairs.length})</p>
                  {activeRepairs.map(r => <RepairCard key={r.id} repair={r} />)}
                </>
              )}
              {pastRepairs.length > 0 && (
                <>
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-wide px-1 pt-2">완료 / 기타</p>
                  {pastRepairs.map(r => <RepairCard key={r.id} repair={r} />)}
                </>
              )}
            </div>
          )
        )}
      </div>
    </div>
  )
}
