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
  const [feedbackPhone, setFeedbackPhone] = useState('')
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
      body: JSON.stringify({ content: feedbackText.trim(), page: 'profile', phone: feedbackPhone.trim() || null }),
    })
    setFeedbackSending(false)
    setFeedbackDone(true)
    setFeedbackText('')
    setFeedbackPhone('')
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
    <div className="flex flex-col min-h-screen" style={{ background: 'linear-gradient(180deg, #f8f7ff 0%, #f3f2fa 40%, #f5f5f5 100%)' }}>
      {/* 헤더 */}
      <header className="px-5 pt-12 pb-4 flex items-center gap-3 sticky top-0 z-20 relative overflow-hidden"
        style={{
          background: 'rgba(255, 255, 255, 0.88)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          borderBottom: '1px solid rgba(0, 0, 0, 0.04)',
        }}
      >
        <div className="absolute -top-10 -right-10 w-32 h-32 rounded-full" style={{ background: 'radial-gradient(circle, rgba(91,79,207,0.06) 0%, transparent 70%)' }} />
        <button onClick={() => router.back()} className="w-9 h-9 flex items-center justify-center rounded-xl text-gray-400 hover:text-gray-600 hover:bg-gray-100/60 transition-all relative z-10">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>
        <h1 className="text-lg font-black text-gray-900 relative z-10">내 프로필</h1>
      </header>

      <div className="flex-1 px-4 py-6 space-y-4">
        {/* 프로필 카드 */}
        <div className="rounded-2xl p-6 flex items-center gap-4"
          style={{
            background: 'linear-gradient(135deg, #ffffff 0%, #faf9ff 100%)',
            boxShadow: '0 2px 16px rgba(0, 0, 0, 0.05), 0 0 0 1px rgba(0, 0, 0, 0.02)',
          }}
        >
          <div className="w-16 h-16 rounded-full flex items-center justify-center overflow-hidden flex-shrink-0"
            style={{
              background: 'linear-gradient(135deg, rgba(91,79,207,0.08) 0%, rgba(124,111,224,0.12) 100%)',
              boxShadow: '0 0 0 2px rgba(91,79,207,0.1), 0 2px 8px rgba(91, 79, 207, 0.1)',
            }}
          >
            {user?.avatarUrl ? (
              <img src={user.avatarUrl} alt="" className="w-full h-full object-cover" />
            ) : (
              <span className="font-black text-2xl" style={{ color: '#5b4fcf' }}>{initial}</span>
            )}
          </div>
          <div>
            <p className="font-bold text-gray-900 text-lg">{displayName}</p>
            <p className="text-sm text-gray-500">{user?.email ?? ''}</p>
          </div>
        </div>

        {/* 메뉴 */}
        <div className="rounded-2xl overflow-hidden"
          style={{
            background: 'linear-gradient(135deg, #ffffff 0%, #faf9ff 100%)',
            boxShadow: '0 2px 12px rgba(0, 0, 0, 0.04), 0 0 0 1px rgba(0, 0, 0, 0.02)',
          }}
        >
          <button
            onClick={() => router.push('/history')}
            className="w-full flex items-center justify-between px-5 py-4 hover:bg-white/60 transition-all active:scale-[0.99]"
            style={{ borderBottom: '1px solid rgba(0, 0, 0, 0.03)' }}
          >
            <div className="flex items-center gap-3">
              <span className="text-lg">📋</span>
              <span className="font-semibold text-gray-800 text-sm">진단 내역</span>
            </div>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-gray-300">
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </button>
          <button
            onClick={() => router.push('/vehicles/new')}
            className="w-full flex items-center justify-between px-5 py-4 hover:bg-white/60 transition-all active:scale-[0.99]"
            style={{ borderBottom: '1px solid rgba(0, 0, 0, 0.03)' }}
          >
            <div className="flex items-center gap-3">
              <span className="text-lg">🚗</span>
              <span className="font-semibold text-gray-800 text-sm">차량 정보 관리</span>
            </div>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-gray-300">
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </button>
          <button
            onClick={() => setFeedbackOpen(true)}
            className="w-full flex items-center justify-between px-5 py-4 hover:bg-white/60 transition-all active:scale-[0.99]"
          >
            <div className="flex items-center gap-3">
              <span className="text-lg">💬</span>
              <div className="text-left">
                <span className="font-semibold text-gray-800 text-sm">의견 보내기</span>
                <p className="text-xs text-gray-400">서비스 개선을 위한 피드백</p>
              </div>
            </div>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-gray-300">
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </button>
        </div>

        {/* 포털 전환 (파트너/어드민 계정만 표시) */}
        {(hasShop || isAdmin) && (
          <div className="rounded-2xl overflow-hidden"
            style={{
              background: 'linear-gradient(135deg, #ffffff 0%, #faf9ff 100%)',
              boxShadow: '0 2px 12px rgba(0, 0, 0, 0.04), 0 0 0 1px rgba(0, 0, 0, 0.02)',
            }}
          >
            <p className="px-5 pt-4 pb-2 text-xs font-semibold text-gray-400">다른 포털</p>
            {hasShop && (
              <button
                onClick={() => router.push('/partner')}
                className="w-full flex items-center justify-between px-5 py-4 hover:bg-white/60 transition-all active:scale-[0.99]"
                style={{ borderTop: '1px solid rgba(0, 0, 0, 0.03)' }}
              >
                <div className="flex items-center gap-3">
                  <span className="text-lg">🔧</span>
                  <div className="text-left">
                    <p className="font-semibold text-gray-800 text-sm">파트너 포털</p>
                    <p className="text-xs text-gray-400">정비소 대시보드로 이동</p>
                  </div>
                </div>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-gray-300">
                  <polyline points="9 18 15 12 9 6" />
                </svg>
              </button>
            )}
            {isAdmin && (
              <button
                onClick={() => router.push('/admin')}
                className="w-full flex items-center justify-between px-5 py-4 hover:bg-white/60 transition-all active:scale-[0.99]"
                style={{ borderTop: '1px solid rgba(0, 0, 0, 0.03)' }}
              >
                <div className="flex items-center gap-3">
                  <span className="text-lg">⚙️</span>
                  <div className="text-left">
                    <p className="font-semibold text-gray-800 text-sm">어드민 포털</p>
                    <p className="text-xs text-gray-400">운영 관리 페이지로 이동</p>
                  </div>
                </div>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-gray-300">
                  <polyline points="9 18 15 12 9 6" />
                </svg>
              </button>
            )}
          </div>
        )}

        {/* 로그아웃 */}
        <button
          onClick={handleLogout}
          disabled={loggingOut}
          className="w-full py-4 text-red-500 font-bold rounded-2xl text-sm transition-all disabled:opacity-50 active:scale-[0.98]"
          style={{
            background: 'rgba(255, 255, 255, 0.8)',
            border: '1px solid rgba(239, 68, 68, 0.15)',
            boxShadow: '0 2px 8px rgba(0, 0, 0, 0.03)',
          }}
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
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={() => { if (!feedbackSending) { setFeedbackOpen(false); setFeedbackText('') } }}
          />
          <div className="relative rounded-t-3xl px-5 pt-5 pb-8 safe-area-pb animate-slide-up"
            style={{
              background: 'rgba(255, 255, 255, 0.96)',
              backdropFilter: 'blur(24px)',
              WebkitBackdropFilter: 'blur(24px)',
              boxShadow: '0 -4px 32px rgba(0, 0, 0, 0.08)',
            }}
          >
            <div className="w-10 h-1 rounded-full mx-auto mb-5" style={{ background: 'rgba(0, 0, 0, 0.1)' }} />

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
                  rows={4}
                  className="w-full rounded-2xl px-4 py-3 text-sm text-gray-800 placeholder-gray-300 resize-none focus:outline-none transition-all"
                  style={{ border: '1px solid rgba(0, 0, 0, 0.06)', background: 'rgba(0, 0, 0, 0.02)' }}
                />
                <p className="text-xs text-gray-400 mt-1 mb-3 text-right">{feedbackText.length}자</p>
                <label className="block text-xs font-semibold text-gray-500 mb-1.5">
                  연락처 <span className="font-normal text-gray-300">(선택 · 답장 원하시면 입력해 주세요)</span>
                </label>
                <input
                  type="tel"
                  value={feedbackPhone}
                  onChange={e => setFeedbackPhone(e.target.value)}
                  placeholder="010-0000-0000"
                  className="w-full rounded-2xl px-4 py-3 text-sm text-gray-800 placeholder-gray-300 focus:outline-none transition-all mb-4"
                  style={{ border: '1px solid rgba(0, 0, 0, 0.06)', background: 'rgba(0, 0, 0, 0.02)' }}
                />
                <button
                  onClick={sendFeedback}
                  disabled={feedbackText.trim().length < 5 || feedbackSending}
                  className="w-full py-4 text-white font-bold rounded-2xl text-sm disabled:opacity-40 transition-all active:scale-[0.98]"
                  style={{
                    background: (feedbackText.trim().length < 5 || feedbackSending) ? '#d1d5db' : 'linear-gradient(135deg, #5b4fcf 0%, #7c6fe0 100%)',
                    boxShadow: (feedbackText.trim().length < 5 || feedbackSending) ? 'none' : '0 4px 16px rgba(91, 79, 207, 0.3)',
                  }}
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
