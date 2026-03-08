'use client'
import { Suspense, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

function LoginContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const redirect = searchParams.get('redirect') ?? '/main'
  const supabase = createClient()

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (session) router.replace(redirect)
    })
    return () => subscription.unsubscribe()
  }, [redirect, router, supabase])

  const handleKakaoLogin = async () => {
    await supabase.auth.signInWithOAuth({
      provider: 'kakao',
      options: { redirectTo: `${window.location.origin}/auth/callback?redirect=${redirect}` },
    })
  }

  const handleGoogleLogin = async () => {
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/auth/callback?redirect=${redirect}` },
    })
  }

  return (
    <div className="flex flex-col min-h-screen bg-white px-6">
      {/* 뒤로가기 */}
      <div className="pt-14 pb-2">
        <button onClick={() => router.back()} className="text-gray-400 hover:text-gray-600 transition-colors">
          ← 뒤로
        </button>
      </div>

      <div className="flex-1 flex flex-col justify-center pb-16">
        {/* 로고 */}
        <div className="text-center mb-10">
          <div className="w-16 h-16 bg-primary-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-primary-200">
            <span className="text-white text-2xl font-black">M</span>
          </div>
          <h1 className="text-2xl font-black text-gray-900 mb-2">로그인</h1>
          <p className="text-sm text-gray-500 leading-relaxed">
            소셜 계정으로 1초 만에 시작하세요
          </p>
        </div>

        {/* 혜택 */}
        <div className="bg-surface-50 rounded-2xl p-4 mb-8 space-y-2">
          {[
            '진단 결과 저장 · 불러오기',
            '자가점검 후 재진단',
            '결과 링크 공유',
            '차량 정보 등록',
          ].map((text, i) => (
            <div key={i} className="flex items-center gap-2">
              <span className="w-4 h-4 bg-primary-100 rounded-full flex items-center justify-center text-primary-600 text-xs font-bold">✓</span>
              <span className="text-sm text-gray-600">{text}</span>
            </div>
          ))}
        </div>

        {/* 로그인 버튼 */}
        <div className="space-y-3">
          <button
            onClick={handleKakaoLogin}
            className="w-full py-4 bg-[#FEE500] text-[#3C1E1E] font-bold rounded-2xl text-sm hover:opacity-90 transition-opacity flex items-center justify-center gap-2 shadow-md"
          >
            <span className="text-xl">💬</span>
            카카오로 로그인
          </button>

          <button
            onClick={handleGoogleLogin}
            className="w-full py-4 bg-white border border-gray-200 text-gray-700 font-semibold rounded-2xl text-sm hover:bg-gray-50 transition-colors flex items-center justify-center gap-2 shadow-sm"
          >
            <svg width="20" height="20" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            구글로 로그인
          </button>
        </div>

        {/* 이용약관 */}
        <p className="text-xs text-gray-400 text-center mt-6 leading-relaxed">
          로그인 시 <span className="underline">이용약관</span> 및{' '}
          <span className="underline">개인정보처리방침</span>에 동의합니다
        </p>
      </div>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center min-h-screen"><div className="w-8 h-8 border-2 border-primary-200 border-t-primary-600 rounded-full animate-spin" /></div>}>
      <LoginContent />
    </Suspense>
  )
}
