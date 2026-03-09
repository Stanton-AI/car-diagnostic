'use client'
import { Suspense, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

// ── 인앱 브라우저 감지 ──────────────────────────────────────────────────────
function getInAppBrowserType(): 'kakao' | 'instagram' | 'facebook' | 'line' | null {
  if (typeof navigator === 'undefined') return null
  const ua = navigator.userAgent
  if (/KAKAOTALK/i.test(ua)) return 'kakao'
  if (/Instagram/i.test(ua)) return 'instagram'
  if (/FBAN|FBAV/i.test(ua)) return 'facebook'
  if (/Line\//i.test(ua)) return 'line'
  return null
}

function isIOS() {
  return typeof navigator !== 'undefined' && /iPhone|iPad|iPod/i.test(navigator.userAgent)
}

// ── OAuth 에러 코드 → 한국어 메시지 ───────────────────────────────────────
function getErrorMessage(code: string, desc?: string): { title: string; body: string; hint?: string } {
  switch (code) {
    case 'access_denied':
      return {
        title: '로그인 권한이 없습니다',
        body: '현재 앱이 테스트 모드로 운영 중이어서 일부 계정만 로그인할 수 있습니다.',
        hint: '서비스 담당자에게 계정 등록을 요청해 주세요.',
      }
    case 'exchange_failed':
      return {
        title: '인증 코드 처리에 실패했습니다',
        body: desc || '브라우저 보안 정책으로 인증 정보가 손실되었습니다.',
        hint: '브라우저 캐시를 지운 뒤 다시 시도하거나, 다른 브라우저를 사용해 보세요.',
      }
    case 'no_code':
      return {
        title: '인증 코드를 받지 못했습니다',
        body: '소셜 로그인 중 문제가 발생했습니다.',
        hint: '잠시 후 다시 시도해 주세요.',
      }
    default:
      return {
        title: '로그인에 실패했습니다',
        body: desc || `오류 코드: ${code}`,
        hint: '문제가 반복되면 다른 로그인 방법을 시도해 보세요.',
      }
  }
}

// ── 에러 배너 ──────────────────────────────────────────────────────────────
function ErrorBanner({ code, desc }: { code: string; desc?: string }) {
  const msg = getErrorMessage(code, desc)
  return (
    <div className="bg-red-50 border border-red-200 rounded-2xl p-4 mb-6">
      <div className="flex items-start gap-2.5">
        <span className="text-lg flex-shrink-0 mt-0.5">❌</span>
        <div>
          <p className="text-sm font-bold text-red-800 mb-1">{msg.title}</p>
          <p className="text-xs text-red-600 leading-relaxed">{msg.body}</p>
          {msg.hint && (
            <p className="text-xs text-red-500 mt-2 leading-relaxed">💡 {msg.hint}</p>
          )}
        </div>
      </div>
    </div>
  )
}

// ── 인앱 브라우저 경고 배너 ────────────────────────────────────────────────
function InAppBrowserBanner() {
  const [copied, setCopied] = useState(false)
  const ios = isIOS()
  const browserType = getInAppBrowserType()

  const handleOpenExternal = () => {
    const url = window.location.href
    if (browserType === 'kakao' && ios) {
      window.location.href = `kakaotalk://web/openExternal?url=${encodeURIComponent(url)}`
      setTimeout(() => {
        navigator.clipboard.writeText(url).then(() => {
          setCopied(true)
          setTimeout(() => setCopied(false), 3000)
        })
      }, 500)
      return
    }
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 3000)
    })
  }

  return (
    <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 mb-6">
      <div className="flex items-start gap-2.5">
        <span className="text-xl flex-shrink-0 mt-0.5">⚠️</span>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-amber-800 mb-1.5">
            인앱 브라우저에서는 로그인이 작동하지 않아요
          </p>
          {ios ? (
            <p className="text-xs text-amber-700 leading-relaxed mb-3">
              아래 버튼으로 Safari에서 열거나,<br />
              주소를 복사해 Safari 주소창에 붙여넣어 주세요.
            </p>
          ) : (
            <p className="text-xs text-amber-700 leading-relaxed mb-3">
              상단 오른쪽 <strong>⋮ 메뉴</strong> → <strong>&quot;다른 앱으로 열기&quot;</strong> 또는<br />
              <strong>&quot;기본 브라우저로 열기&quot;</strong>를 선택해 주세요.
            </p>
          )}
          <div className="space-y-2">
            {ios && (
              <button
                onClick={handleOpenExternal}
                className="w-full py-2.5 bg-amber-500 text-white rounded-xl text-sm font-bold hover:bg-amber-600 active:scale-[0.98] transition-all"
              >
                🌐 Safari로 열기
              </button>
            )}
            <button
              onClick={() => {
                navigator.clipboard.writeText(window.location.href).then(() => {
                  setCopied(true)
                  setTimeout(() => setCopied(false), 3000)
                })
              }}
              className="w-full py-2.5 border border-amber-300 bg-white text-amber-700 rounded-xl text-sm font-semibold hover:bg-amber-50 active:scale-[0.98] transition-all"
            >
              {copied ? '✓ 복사 완료! 브라우저에 붙여넣어 주세요' : '🔗 주소 복사하기'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── 로그인 페이지 ───────────────────────────────────────────────────────────
function LoginContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const redirect = searchParams.get('redirect') ?? '/main'
  const errorCode = searchParams.get('error')
  const errorDesc = searchParams.get('desc') ?? undefined
  const supabase = createClient()
  const [inAppBrowserType, setInAppBrowserType] = useState<string | null>(null)

  useEffect(() => {
    setInAppBrowserType(getInAppBrowserType())
  }, [])

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

  const isInApp = !!inAppBrowserType

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
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-primary-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-primary-200">
            <span className="text-white text-2xl font-black">M</span>
          </div>
          <h1 className="text-2xl font-black text-gray-900 mb-2">로그인</h1>
          <p className="text-sm text-gray-500 leading-relaxed">
            소셜 계정으로 1초 만에 시작하세요
          </p>
        </div>

        {/* 에러 배너 (OAuth 실패 시) */}
        {errorCode && <ErrorBanner code={errorCode} desc={errorDesc} />}

        {/* 인앱 브라우저 경고 배너 */}
        {!errorCode && isInApp && <InAppBrowserBanner />}

        {/* 혜택 (정상 상태일 때만 표시) */}
        {!errorCode && !isInApp && (
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
        )}

        {/* 로그인 버튼 */}
        <div className={`space-y-3 ${isInApp && !errorCode ? 'opacity-30 pointer-events-none select-none' : ''}`}>
          <button
            onClick={handleKakaoLogin}
            disabled={isInApp && !errorCode}
            className="w-full py-4 bg-[#FEE500] text-[#3C1E1E] font-bold rounded-2xl text-sm hover:opacity-90 transition-opacity flex items-center justify-center gap-2 shadow-md"
          >
            <span className="text-xl">💬</span>
            카카오로 로그인
          </button>

          <button
            onClick={handleGoogleLogin}
            disabled={isInApp && !errorCode}
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
        {!isInApp && (
          <p className="text-xs text-gray-400 text-center mt-6 leading-relaxed">
            로그인 시 <span className="underline">이용약관</span> 및{' '}
            <span className="underline">개인정보처리방침</span>에 동의합니다
          </p>
        )}
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
