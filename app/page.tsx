'use client'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function HomePage() {
  const router = useRouter()

  useEffect(() => {
    const check = async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (user) router.replace('/main')
    }
    check()
  }, [router])

  const handleKakaoLogin = async () => {
    const supabase = createClient()
    await supabase.auth.signInWithOAuth({
      provider: 'kakao',
      options: { redirectTo: `${window.location.origin}/auth/callback?redirect=/main` },
    })
  }

  const handleGoogleLogin = async () => {
    const supabase = createClient()
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/auth/callback?redirect=/main` },
    })
  }

  return (
    <div className="relative flex flex-col min-h-screen bg-gray-950 overflow-hidden">
      {/* 배경 그라디언트 */}
      <div className="absolute inset-0 bg-gradient-to-b from-gray-950 via-gray-900 to-primary-950 pointer-events-none" />
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[400px] bg-primary-600/10 rounded-full blur-3xl pointer-events-none" />

      {/* 상단 로고 */}
      <div className="relative z-10 flex items-center gap-2 px-6 pt-14">
        <div className="w-9 h-9 bg-primary-600 rounded-xl flex items-center justify-center shadow-lg shadow-primary-900">
          <span className="text-white text-sm font-black">M</span>
        </div>
        <span className="text-white font-black text-lg tracking-tight">MIKY</span>
      </div>

      {/* 히어로 */}
      <div className="relative z-10 flex-1 flex flex-col px-6 pt-10 pb-6">
        {/* 배지 */}
        <div className="inline-flex items-center gap-1.5 bg-primary-600/20 border border-primary-500/30 rounded-full px-3 py-1.5 w-fit mb-6">
          <span className="w-1.5 h-1.5 bg-primary-400 rounded-full animate-pulse" />
          <span className="text-primary-300 text-xs font-semibold">AI 자동차 진단 어드바이저</span>
        </div>

        <h1 className="text-3xl font-black text-white leading-tight mb-4">
          내 차의 문제,<br />
          <span className="text-primary-400">AI가 먼저</span><br />
          알려드립니다
        </h1>

        <p className="text-gray-400 text-sm leading-relaxed mb-8">
          증상을 알려주시면 원인 확률·예상 수리비를<br />
          즉시 분석해 드려요. 정비소 가기 전<br />
          미리 확인하고 현명하게 대비하세요.
        </p>

        {/* 특장점 3가지 */}
        <div className="space-y-3 mb-10">
          {[
            { icon: '🔍', title: '원인 확률 분석', desc: 'AI가 증상으로 가능한 원인을 확률순으로 분석' },
            { icon: '💰', title: '수리비 사전 파악', desc: '부품비·공임비 포함 예상 견적 즉시 산출' },
            { icon: '🏪', title: '정비소 연결', desc: '진단 결과 기반 최적 파트너 정비소 추천' },
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

        {/* 로그인 버튼 */}
        <div className="space-y-3">
          <button
            onClick={handleKakaoLogin}
            className="w-full py-4 bg-[#FEE500] text-[#3C1E1E] font-bold rounded-2xl text-sm hover:opacity-90 transition-opacity flex items-center justify-center gap-2 shadow-lg"
          >
            <span className="text-xl">💬</span>
            카카오로 시작하기
          </button>

          <button
            onClick={handleGoogleLogin}
            className="w-full py-4 bg-white text-gray-700 font-semibold rounded-2xl text-sm hover:bg-gray-100 transition-colors flex items-center justify-center gap-2 shadow-lg"
          >
            <svg width="20" height="20" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            Google로 시작하기
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
