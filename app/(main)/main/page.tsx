'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import type { UserProfile, Vehicle, Conversation } from '@/types'
import { formatKRW, formatDate } from '@/lib/utils'
import { urgencyLabel } from '@/lib/claude/diagnose'

export default function MainPage() {
  const router = useRouter()
  const supabase = createClient()
  const [user, setUser] = useState<UserProfile | null>(null)
  const [vehicle, setVehicle] = useState<Vehicle | null>(null)
  const [recentConversations, setRecentConversations] = useState<Conversation[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      const { data: { user: authUser } } = await supabase.auth.getUser()
      if (!authUser) { router.replace('/'); return }

      const [{ data: profile }, { data: vehicles }, { data: convos }] = await Promise.all([
        supabase.from('users').select('*').eq('id', authUser.id).single(),
        supabase.from('vehicles').select('*').eq('user_id', authUser.id).order('created_at', { ascending: false }).limit(1),
        supabase.from('conversations').select('id, initial_symptom, category, urgency, cost_min, cost_max, created_at, final_result').eq('user_id', authUser.id).order('created_at', { ascending: false }).limit(5),
      ])

      setUser(profile)
      setVehicle(vehicles?.[0] ?? null)
      setRecentConversations(convos ?? [])
      setLoading(false)
    }
    load()
  }, [])

  if (loading) return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="w-10 h-10 border-2 border-primary-200 border-t-primary-600 rounded-full animate-spin" />
    </div>
  )

  const displayName = user?.displayName ?? '사용자'

  return (
    <div className="flex flex-col min-h-screen bg-surface-50">
      {/* 헤더 */}
      <header className="bg-white px-5 pt-12 pb-4 flex items-start justify-between">
        <div>
          <h1 className="text-xl font-black text-gray-900">나의 차고</h1>
          <p className="text-sm text-gray-500 mt-0.5">다시 만나서 반가워요, {displayName}님</p>
        </div>
        <Link href="/profile">
          <div className="w-10 h-10 rounded-full bg-primary-100 flex items-center justify-center overflow-hidden">
            {user?.avatarUrl ? (
              <img src={user.avatarUrl} alt="" className="w-full h-full object-cover" />
            ) : (
              <span className="text-primary-600 font-bold text-sm">{displayName[0]}</span>
            )}
          </div>
        </Link>
      </header>

      <div className="flex-1 px-4 py-4 space-y-5 pb-24">
        {/* 차량 카드 */}
        {vehicle ? (
          <div className="relative bg-gradient-to-br from-primary-600 to-primary-800 rounded-3xl p-5 text-white overflow-hidden shadow-lg shadow-primary-200">
            <div className="absolute top-4 right-4 bg-white/20 text-white text-xs font-bold px-2.5 py-1 rounded-full">
              {vehicle.fuelType === 'hybrid' ? '하이브리드' : vehicle.fuelType === 'electric' ? '전기차' : vehicle.fuelType === 'diesel' ? '디젤' : '가솔린'}
            </div>
            <div className="absolute bottom-3 right-3 bg-green-400/90 text-white text-xs font-bold px-2.5 py-1 rounded-full flex items-center gap-1">
              <span className="w-1.5 h-1.5 bg-white rounded-full animate-pulse" />
              정상
            </div>
            <p className="text-white/60 text-xs mb-1">{vehicle.maker}</p>
            <h2 className="text-2xl font-black mb-1">{vehicle.model}</h2>
            <p className="text-white/70 text-sm">{vehicle.year}년식 · {vehicle.mileage?.toLocaleString()}km</p>
          </div>
        ) : (
          <Link href="/vehicles/new" className="block bg-white rounded-3xl p-5 border-2 border-dashed border-primary-200 text-center hover:border-primary-400 transition-colors">
            <span className="text-3xl mb-2 block">🚗</span>
            <p className="font-semibold text-gray-700 text-sm">차량 정보 등록하기</p>
            <p className="text-xs text-gray-400 mt-1">등록 시 진단 정확도가 올라가요</p>
          </Link>
        )}

        {/* AI 진단 메뉴 */}
        <div>
          <div className="flex items-center gap-2 mb-3 px-1">
            <span className="text-primary-600">✦</span>
            <h3 className="font-bold text-gray-900 text-sm">AI 정비 어드바이저</h3>
          </div>

          <Link
            href="/chat"
            className="block bg-white rounded-2xl p-4 border border-gray-100 shadow-sm hover:shadow-md transition-shadow mb-2"
          >
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-primary-50 rounded-xl flex items-center justify-center text-2xl flex-shrink-0">💬</div>
              <div className="flex-1">
                <p className="font-bold text-gray-900 text-sm">증상 채팅 상담</p>
                <p className="text-xs text-gray-500 mt-0.5">AI 정비사에게 증상 문의</p>
              </div>
              <span className="text-gray-300">→</span>
            </div>
          </Link>

          <div className="grid grid-cols-2 gap-2">
            <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm opacity-50">
              <div className="text-2xl mb-2">📸</div>
              <p className="font-bold text-gray-700 text-sm">AI 사진 진단</p>
              <p className="text-xs text-gray-400 mt-0.5">외관 손상 분석</p>
              <span className="inline-block text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full mt-2">준비 중</span>
            </div>
            <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm opacity-50">
              <div className="text-2xl mb-2">🔊</div>
              <p className="font-bold text-gray-700 text-sm">AI 소리 진단</p>
              <p className="text-xs text-gray-400 mt-0.5">엔진·브레이크 소음 분석</p>
              <span className="inline-block text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full mt-2">준비 중</span>
            </div>
          </div>
        </div>

        {/* 최근 진단 내역 */}
        {recentConversations.length > 0 && (
          <div>
            <div className="flex items-center justify-between mb-3 px-1">
              <h3 className="font-bold text-gray-900 text-sm">최근 진단 내역</h3>
              <Link href="/history" className="text-xs text-primary-600 font-semibold">전체 보기</Link>
            </div>
            <div className="space-y-2">
              {recentConversations.map(convo => {
                const urgency = convo.urgency ? urgencyLabel(convo.urgency) : null
                const result = convo.final_result as { causes?: Array<{ name: string }> } | null
                const topCause = result?.causes?.[0]?.name ?? convo.initial_symptom
                return (
                  <Link
                    key={convo.id}
                    href={`/results/${convo.id}`}
                    className="flex items-center gap-3 bg-white rounded-2xl p-3.5 border border-gray-100 shadow-sm hover:shadow-md transition-shadow"
                  >
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-lg flex-shrink-0 ${urgency?.bg ?? 'bg-gray-50'}`}>
                      {convo.urgency === 'HIGH' ? '🚨' : convo.urgency === 'MID' ? '⚠️' : '✅'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-gray-800 text-sm truncate">{topCause}</p>
                      <p className="text-xs text-gray-400">{formatDate(convo.created_at)}</p>
                    </div>
                    {urgency && (
                      <span className={`text-xs font-semibold px-2.5 py-1 rounded-full border flex-shrink-0 ${urgency.bg} ${urgency.color}`}>
                        {urgency.label}
                      </span>
                    )}
                  </Link>
                )
              })}
            </div>
          </div>
        )}
      </div>

      {/* 추천 정비소 찾기 CTA */}
      <div className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[480px] px-4 pb-8 pt-4 bg-gradient-to-t from-surface-50 via-surface-50/80 to-transparent">
        <button className="w-full py-4 bg-primary-600 text-white font-bold rounded-2xl shadow-lg shadow-primary-200 hover:bg-primary-700 transition-colors flex items-center justify-center gap-2">
          <span>📍</span>
          추천 정비소 찾기
        </button>
      </div>
    </div>
  )
}
