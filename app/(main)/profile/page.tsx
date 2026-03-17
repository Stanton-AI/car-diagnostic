'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { UserProfile } from '@/types'
import BottomNav from '@/components/nav/BottomNav'

export default function ProfilePage() {
  const router = useRouter()
  const supabase = createClient()
  const [user, setUser] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [loggingOut, setLoggingOut] = useState(false)
  const [isAdmin, setIsAdmin] = useState(false)
  const [hasShop, setHasShop] = useState(false)

  // 피드백 모달
  const [feedbackOpen, setFeedbackOpen] = useState(false)
  const [feedbackText, setFeedbackText] = useState('')
  const [feedbackSending, setFeedbackSending] = useState(false)
  const [feedbackDone, setFeedbackDone] = useState(false)

  useEffect(() => {
    const load = async () => {
      const { data: { user: authUser } } = await supabase.auth.getUser()
      if (!authUser) { router.replace('/'); return }

      const [{ data: profile }, { data: shop }] = await Promise.all([
        supabase.from('users').select('*').eq('id', authUser.id).single(),
        supabase.from('partner_shops').select('id').eq('user_id', authUser.id).maybeSingle(),
      ])

      setUser(profile)
      setIsAdmin(profile?.role === 'admin')
      setHasShop(!!shop)
      setLoading(false)
    }
    load()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleLogout = async () => {
    setLoggingOut(true)
    await supabase.auth.signOut()
    router.replace('/')
  }

  const sendFeedback = async () => {
    if (feedbackText.trim().length < 5 || feedbackSending) return
    setFeedbackSending(true)
    await fetch('/api/feedback', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: feedbackText.trim(), page: 'profile' }),
    })
    setFeedbackSending(false)
    setFeedbackDone(true)
    setFeedbackText('')
    setTimeout(() => { setFeedbackOpen(false); setFeedbackDone(false) }, 1800)
  }

  if (loading) return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="w-10 h-10 border-2 border-primary-200 border-t-primary-600 rounded-full animate-spin" />
    </div>
  )

  const displayName = user?.displayName ?? '사용자'
  const initial = displayName[0]?.toUpperCase() ?? 'U'

  return (
    <div className="flex flex-col min-h-screen bg-surface-50">
      {/* 헤더 */}
      <header className="bg-white px-5 pt-12 pb-4 flex items-center gap-3 border-b border-gray-100">
        <button onClick={() => router.back()} className="text-gray-400 hover:text-gray-600 transition-colors p-1">
          ←
        </button>
        <h1 className="text-lg font-black text-gray-900">내 프로필</h1>
      </header>

      <div className="flex-1 px-4 py-6 space-y-4">
        {/* 프로필 카드 */}
        <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm flex items-center gap-4">
          <div className="w-16 h-16 rounded-full bg-primary-100 flex items-center justify-center overflow-hidden flex-shrink-0">
            {user?.avatarUrl ? (
              <img src={user.avatarUrl} alt="" className="w-full h-full object-cover" />
            ) : (
              <span className="text-primary-600 font-black text-2xl">{initial}</span>
            )}
          </div>
          <div>
            <p className="font-bold text-gray-900 text-lg">{displayName}</p>
            <p className="text-sm text-gray-500">{user?.email ?? ''}</p>
          </div>
        </div>

        {/* 메뉴 */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <button
            onClick={() => router.push('/history')}
            className="w-full flex items-center justify-between px-5 py-4 hover:bg-gray-50 transition-colors border-b border-gray-50"
          >
            <div className="flex items-center gap-3">
              <span className="text-lg">📋</span>
              <span className="font-semibold text-gray-800 text-sm">진단 내역</span>
            </div>
            <span className="text-gray-300">→</span>
          </button>
          <button
            onClick={() => router.push('/vehicles/new')}
            className="w-full flex items-center justify-between px-5 py-4 hover:bg-gray-50 transition-colors border-b border-gray-50"
          >
            <div className="flex items-center gap-3">
              <span className="text-lg">🚗</span>
              <span className="font-semibold text-gray-800 text-sm">차량 정보 관리</span>
            </div>
            <span className="text-gray-300">→</span>
          </button>
          <button
            onClick={() => setFeedbackOpen(true)}
            className="w-full flex items-center justify-between px-5 py-4 hover:bg-gray-50 transition-colors"
          >
            <div className="flex items-center gap-3">
              <span className="text-lg">💬</span>
              <div className="text-left">
                <span className="font-semibold text-gray-800 text-sm">의견 보내기</span>
                <p className="text-xs text-gray-400">서비스 개선을 위한 피드백</p>
              </div>
            </div>
            <span className="text-gray-300">→</span>
          </button>
        </div>

        {/* 포털 전환 (파트너/어드민 계정만 표시) */}
        {(hasShop || isAdmin) && (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <p className="px-5 pt-4 pb-2 text-xs font-semibold text-gray-400">다른 포털</p>
            {hasShop && (
              <button
                onClick={() => router.push('/partner')}
                className="w-full flex items-center justify-between px-5 py-4 hover:bg-gray-50 transition-colors border-t border-gray-50"
              >
                <div className="flex items-center gap-3">
                  <span className="text-lg">🔧</span>
                  <div className="text-left">
                    <p className="font-semibold text-gray-800 text-sm">파트너 포털</p>
                    <p className="text-xs text-gray-400">정비소 대시보드로 이동</p>
                  </div>
                </div>
                <span className="text-gray-300">→</span>
              </button>
            )}
            {isAdmin && (
              <button
                onClick={() => router.push('/admin')}
                className="w-full flex items-center justify-between px-5 py-4 hover:bg-gray-50 transition-colors border-t border-gray-50"
              >
                <div className="flex items-center gap-3">
                  <span className="text-lg">⚙️</span>
                  <div className="text-left">
                    <p className="font-semibold text-gray-800 text-sm">어드민 포털</p>
                    <p className="text-xs text-gray-400">운영 관리 페이지로 이동</p>
                  </div>
                </div>
                <span className="text-gray-300">→</span>
              </button>
            )}
          </div>
        )}

        {/* 로그아웃 */}
        <button
          onClick={handleLogout}
          disabled={loggingOut}
          className="w-full py-4 bg-white border border-red-200 text-red-500 font-bold rounded-2xl text-sm hover:bg-red-50 transition-colors disabled:opacity-50 shadow-sm"
        >
          {loggingOut ? '로그아웃 중...' : '로그아웃'}
        </button>
      </div>
      <BottomNav />

      {/* 피드백 바텀시트 */}
      {feedbackOpen && (
        <div className="fixed inset-0 z-50 flex flex-col justify-end">
          {/* 배경 dimmer */}
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => { if (!feedbackSending) { setFeedbackOpen(false); setFeedbackText('') } }}
          />
          <div className="relative bg-white rounded-t-3xl px-5 pt-5 pb-8 safe-area-pb animate-slide-up">
            <div className="w-10 h-1 bg-gray-200 rounded-full mx-auto mb-5" />

            {feedbackDone ? (
              <div className="text-center py-8">
                <p className="text-4xl mb-3">🙏</p>
                <p className="font-bold text-gray-900 text-lg">소중한 의견 감사해요!</p>
                <p className="text-sm text-gray-500 mt-1">더 좋은 서비스로 보답할게요</p>
              </div>
            ) : (
              <>
                <h3 className="font-black text-gray-900 text-base mb-1">의견 보내기</h3>
                <p className="text-xs text-gray-400 mb-4">불편한 점, 개선 제안, 칭찬 모두 환영해요 😊</p>
                <textarea
                  value={feedbackText}
                  onChange={e => setFeedbackText(e.target.value)}
                  placeholder="예) 진단 결과가 너무 어려워요 / 이런 기능이 있으면 좋겠어요 / ..."
                  rows={5}
                  className="w-full border border-gray-200 rounded-2xl px-4 py-3 text-sm text-gray-800 placeholder-gray-300 resize-none focus:outline-none focus:border-primary-400 focus:ring-1 focus:ring-primary-200"
                />
                <p className="text-xs text-gray-400 mt-1 mb-4 text-right">{feedbackText.length}자</p>
                <button
                  onClick={sendFeedback}
                  disabled={feedbackText.trim().length < 5 || feedbackSending}
                  className="w-full py-4 bg-primary-600 text-white font-bold rounded-2xl text-sm disabled:opacity-40 transition-opacity"
                >
                  {feedbackSending ? '전송 중...' : '의견 보내기'}
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
