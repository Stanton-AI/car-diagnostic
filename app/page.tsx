'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function HomePage() {
  const router = useRouter()
  const [loadingKakao, setLoadingKakao] = useState(false)
  const [loadingGoogle, setLoadingGoogle] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [checking, setChecking] = useState(true)

  useEffect(() => {
    const check = async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setChecking(false); return }

      // 로그인 상태: 역할에 따라 적절한 포털로 분기
      const [{ data: profile }, { data: shop }] = await Promise.all([
        supabase.from('users').select('role').eq('id', user.id).single(),
        supabase.from('partner_shops').select('id').eq('user_id', user.id).maybeSingle(),
      ])

      if (profile?.role === 'admin') { router.replace('/admin'); return }
      if (shop) { router.replace('/partner'); return }
      router.replace('/main')
    }
    check()
  }, [router])

  const handleOAuth = async (provider: 'kakao' | 'google') => {
    if (provider === 'kakao') setLoadingKakao(true)
    else setLoadingGoogle(true)
    setErrorMsg(null)
    try {
      const supabase = createClient()
      // redirect=/main → 콜백에서 역할 기반 분기 처리
      const { error } = await supabase.auth.signInWithOAuth({
        provider,
        options: { redirectTo: `${window.location.origin}/auth/callback?redirect=/main` },
      })
      if (error) setErrorMsg(error.message)
    } catch (e: unknown) {
      setErrorMsg(e instanceof Error ? e.message : '알 수 없는 오류')
    } finally {
      setLoadingKakao(false)
      setLoadingGoogle(false)
    }
  }

  // 로그인 상태 확인 중에는 아무것도 렌더링하지 않음
  if (checking) return (
    <div className="flex items-center justify-center min-h-screen bg-gray-950">
      <div className="w-8 h-8 border-2 border-primary-800 border-t-primary-400 rounded-full animate-spin" />
    </div>
  )

  return (
    <div className="relative flex flex-col min-h-screen bg-gray-950 overflow-hidden">
      {/* 배경 그라디언트 */}
      <div className="absolute inset-0 bg-gradient-to-b from-gray-950 via-gray-900 to-primary-950 pointer-events-none" />
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[400px] bg-primary-600/10 rounded-full blur-3xl pointer-events-none" />

      {/* 상단 로고 + 파트너 링크 */}
      <div className="relative z-10 flex items-center justify-between px-6 pt-14">
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-xl overflow-hidden shadow-lg shadow-primary-900">
            <img src="/logo.png" alt="정비톡" className="w-full h-full object-cover" />
          </div>
          <span className="text-white font-black text-lg tracking-tight">정비톡</span>
        </div>
        {/* 파트너 진입점 */}
        <button
          onClick={() => router.push('/partner')}
          className="text-xs text-gray-500 hover:text-gray-300 transition-colors border border-gray-700 hover:border-gray-500 rounded-full px-3 py-1.5"
        >
          🔧 파트너 포털
        </button>
      </div>

      {/* 히어로 */}
      <div className="relative z-10 flex-1 flex flex-col px-6 pt-10 pb-6">
        {/* 배지 */}
        <div className="inline-flex items-center gap-1.5 bg-primary-600/20 border border-primary-500/30 rounded-full px-3 py-1.5 w-fit mb-6">
          <span className="w-1.5 h-1.5 bg-primary-400 rounded-full animate-pulse" />
          <span className="text-primary-300 text-xs font-semibold">AI 자동차 진단 어드바이저</span>
        </div>

        <h1 className="text-3xl font-black text-white leading-tight mb-4">
          내 차 증상,<br />
          <span className="text-primary-400">3분이면</span><br />
          알 수 있어요
        </h1>

        <p className="text-gray-400 text-sm leading-relaxed mb-8">
          증상을 알려주시면 원인 확률·예상 수리비를<br />
          즉시 분석해 드려요. 정비소 가기 전<br />
          미리 확인하고 현명하게 대비하세요.
        </p>

        {/* 특장점 3가지 */}
        <div className="space-y-3 mb-10">
          {[
            { icon: '🔍', title: '원인 분석', desc: '증상으로 가능한 원인을 가능성 높은 순서로 알려드려요' },
            { icon: '💰', title: '예상 수리비 확인', desc: '부품비랑 공임비까지 미리 파악하세요' },
            { icon: '🏪', title: '정비소 견적 비교', desc: '진단 결과로 근처 정비소 견적을 한번에 받아보세요' },
          ].map((item, i) => (
            <div key={i} className="flex items-center gap-4 bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl px-4 py-3.5">
              <span className="text-2xl flex-shrink-0">{item.icon}</span>
              <div>
                <p className="text-white font-bold text-sm">{item.title}</p>
                <p className="text-gray-400 text-xs mt-0.5 leading-relaxed">{item.desc}</p>
              </div>
            </div>
          ))}
        </div>

        {/* 에러 메시지 */}
        {errorMsg && (
          <div className="bg-red-900/40 border border-red-500/30 rounded-xl px-4 py-3 mb-4">
            <p className="text-red-300 text-xs text-center">❌ {errorMsg}</p>
          </div>
        )}

        {/* 소비자 로그인 버튼 */}
        <div className="space-y-3">
          <button
            onClick={() => handleOAuth('kakao')}
            disabled={loadingKakao || loadingGoogle}
            className="w-full py-4 bg-[#FEE500] text-[#3C1E1E] font-bold rounded-2xl text-sm hover:opacity-90 transition-opacity flex items-center justify-center gap-2 shadow-lg disabled:opacity-60"
          >
            {loadingKakao
              ? <span className="w-5 h-5 border-2 border-[#3C1E1E]/30 border-t-[#3C1E1E] rounded-full animate-spin" />
              : <span className="text-xl">💬</span>
            }
            {loadingKakao ? '로그인 중...' : '카카오로 시작하기'}
          </button>

          <button
            onClick={() => handleOAuth('google')}
            disabled={loadingKakao || loadingGoogle}
            className="w-full py-4 bg-white text-gray-700 font-semibold rounded-2xl text-sm hover:bg-gray-100 transition-colors flex items-center justify-center gap-2 shadow-lg disabled:opacity-60"
          >
            {loadingGoogle
              ? <span className="w-5 h-5 border-2 border-gray-300 border-t-gray-600 rounded-full animate-spin" />
              : (
                <svg width="20" height="20" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                </svg>
              )
            }
            {loadingGoogle ? '로그인 중...' : 'Google로 시작하기'}
          </button>
        </div>

        {/* 파트너 입점 안내 */}
        <div className="mt-6 pt-5 border-t border-white/10">
          <p className="text-gray-500 text-xs text-center mb-3">정비소를 운영 중이신가요?</p>
          <button
            onClick={() => router.push('/partner')}
            className="w-full py-3 border border-gray-700 hover:border-gray-500 text-gray-400 hover:text-gray-200 font-semibold rounded-2xl text-sm transition-colors flex items-center justify-center gap-2"
          >
            🔧 파트너 정비소로 입점하기
          </button>
        </div>

        {/* 이용약관 */}
        <p className="text-xs text-gray-600 text-center mt-5 leading-relaxed">
          로그인 시 <span className="underline text-gray-500">이용약관</span> 및{' '}
          <a href="/privacy" className="underline text-gray-500 hover:text-gray-300">개인정보처리방침</a>에 동의합니다
        </p>
      </div>
    </div>
  )
}
