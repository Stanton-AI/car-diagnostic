'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { getOrCreateGuestSessionId, formatDate, formatKRW } from '@/lib/utils'
import { urgencyLabel } from '@/lib/claude/diagnose'

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
              return (
                <Link
                  key={convo.id}
                  href={`/results/${convo.id}`}
                  className="block bg-white rounded-2xl p-4 border border-gray-100 shadow-sm hover:shadow-md transition-shadow"
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
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
