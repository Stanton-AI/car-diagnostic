'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { getOrCreateGuestSessionId, formatDate, formatKRW, urgencyLabel } from '@/lib/utils'

interface ConvoSummary {
  id: string
  initial_symptom: string
  category: string | null
  urgency: string | null
  cost_min: number | null
  cost_max: number | null
  created_at: string
  final_result: { causes?: Array<{ name: string; probability: number }> } | null
}

export default function HistoryPage() {
  const router = useRouter()
  const supabase = createClient()
  const [convos, setConvos] = useState<ConvoSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      const guestId = getOrCreateGuestSessionId()
      let query = supabase
        .from('conversations')
        .select('id, initial_symptom, category, urgency, cost_min, cost_max, created_at, final_result')
        .not('final_result', 'is', null)
        .order('created_at', { ascending: false })
        .limit(50)

      if (user) {
        query = query.eq('user_id', user.id)
      } else {
        query = query.eq('guest_session_id', guestId)
      }

      const { data } = await query
      setConvos(data ?? [])
      setLoading(false)
    }
    load()
  }, [])

  const handleDelete = async (id: string) => {
    setDeletingId(id)
    const guestId = getOrCreateGuestSessionId()
    try {
      const res = await fetch(`/api/conversations?id=${id}`, {
        method: 'DELETE',
        headers: { 'x-guest-session-id': guestId },
      })
      if (res.ok) {
        // 목록에서 즉시 제거 (Optimistic UI)
        setConvos(prev => prev.filter(c => c.id !== id))
      }
    } catch (err) {
      console.error('Delete error:', err)
    } finally {
      setDeletingId(null)
      setDeleteConfirmId(null)
    }
  }

  return (
    <div className="flex flex-col min-h-screen bg-surface-50">
      <header className="bg-white px-4 pt-14 pb-4 flex items-center gap-3 border-b border-gray-100">
        <button onClick={() => router.back()} className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-500">←</button>
        <h1 className="text-lg font-black text-gray-900">진단 내역</h1>
      </header>

      <div className="flex-1 px-4 py-4">
        {loading ? (
          <div className="flex justify-center pt-16">
            <div className="w-8 h-8 border-2 border-primary-200 border-t-primary-600 rounded-full animate-spin" />
          </div>
        ) : convos.length === 0 ? (
          <div className="text-center pt-16">
            <div className="text-5xl mb-4">🔍</div>
            <p className="font-bold text-gray-700 mb-2">진단 내역이 없습니다</p>
            <p className="text-sm text-gray-400 mb-6">차량 증상을 입력해서 AI 진단을 받아보세요</p>
            <Link href="/chat" className="inline-block bg-primary-600 text-white font-bold px-6 py-3 rounded-2xl text-sm">
              진단 시작하기
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {convos.map(convo => {
              const urgency = convo.urgency ? urgencyLabel(convo.urgency) : null
              const topCause = convo.final_result?.causes?.[0]
              const isConfirming = deleteConfirmId === convo.id
              const isDeleting = deletingId === convo.id

              // ── 삭제 확인 상태 ─────────────────────────────────────
              if (isConfirming) {
                return (
                  <div key={convo.id} className="bg-red-50 rounded-2xl p-4 border border-red-200 animate-fade-up">
                    <p className="text-sm font-semibold text-red-800 mb-1">이 진단 내역을 삭제할까요?</p>
                    <p className="text-xs text-red-500 mb-3 truncate">
                      {topCause?.name ?? convo.initial_symptom}
                    </p>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setDeleteConfirmId(null)}
                        disabled={isDeleting}
                        className="flex-1 py-2.5 border border-gray-200 bg-white text-gray-600 rounded-xl text-sm font-medium hover:bg-gray-50 disabled:opacity-50 transition-colors"
                      >
                        취소
                      </button>
                      <button
                        onClick={() => handleDelete(convo.id)}
                        disabled={isDeleting}
                        className="flex-1 py-2.5 bg-red-500 text-white rounded-xl text-sm font-semibold hover:bg-red-600 disabled:opacity-60 transition-colors"
                      >
                        {isDeleting ? '삭제 중...' : '삭제'}
                      </button>
                    </div>
                  </div>
                )
              }

              // ── 일반 카드 ──────────────────────────────────────────
              return (
                <div
                  key={convo.id}
                  className="flex bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow overflow-hidden"
                >
                  {/* 메인 컨텐츠 (링크) */}
                  <Link
                    href={`/results/${convo.id}`}
                    className="flex-1 block p-4 min-w-0"
                  >
                    <div className="flex items-start gap-3">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-xl flex-shrink-0 ${urgency?.bg ?? 'bg-gray-50'}`}>
                        {convo.urgency === 'HIGH' ? '🚨' : convo.urgency === 'MID' ? '⚠️' : '✅'}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-gray-900 text-sm truncate">
                          {topCause?.name ?? convo.initial_symptom}
                        </p>
                        {topCause && (
                          <p className="text-xs text-primary-600 font-semibold mt-0.5">{topCause.probability}% 가능성</p>
                        )}
                        <div className="flex items-center gap-2 mt-1">
                          {convo.category && (
                            <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">{convo.category}</span>
                          )}
                          <span className="text-xs text-gray-400">{formatDate(convo.created_at)}</span>
                        </div>
                      </div>
                      <div className="text-right flex-shrink-0">
                        {urgency && (
                          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${urgency.bg} ${urgency.color}`}>
                            {urgency.label}
                          </span>
                        )}
                        {convo.cost_max && (
                          <p className="text-sm font-black text-gray-900 mt-1">{formatKRW(convo.cost_max)}</p>
                        )}
                      </div>
                    </div>
                  </Link>

                  {/* 삭제 버튼 (세로 구분선 우측) */}
                  <button
                    onClick={() => setDeleteConfirmId(convo.id)}
                    className="flex items-center justify-center w-12 border-l border-gray-100 text-gray-300 hover:text-red-400 hover:bg-red-50 transition-colors flex-shrink-0"
                    title="삭제"
                    aria-label="진단 내역 삭제"
                  >
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="3 6 5 6 21 6"/>
                      <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
                      <path d="M10 11v6M14 11v6"/>
                      <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
                    </svg>
                  </button>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
