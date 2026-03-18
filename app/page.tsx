'use client'
import { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

const BETA_LIMIT = 50
const PEEK = 40
const GAP = 12

// ─── 슬라이드 1: 공감 ────────────────────────────────────────────────────────
function Slide1() {
  return (
    <div className="flex flex-col h-full pl-4 pr-12 pt-4 pb-4 select-none">
      <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-5 flex-shrink-0"
        style={{ background: 'rgba(239,68,68,0.15)' }}>
        <span className="text-3xl">🛡️</span>
      </div>
      <p className="text-[13px] font-medium mb-2 flex-shrink-0" style={{ color: 'rgba(255,255,255,0.45)' }}>
        많은 분들이 이런 상황이에요
      </p>
      <h2 className="text-[22px] font-black text-white leading-tight mb-6 flex-shrink-0">
        차에서 이상한 소리,<br />
        뭔지 몰라서{' '}
        <span style={{ color: '#FBBF24' }}>그냥 타고 계셨죠?</span>
      </h2>
      <div className="space-y-3">
        {[
          '정비소 가면 바가지 쓸 것 같아서 무서워요',
          '뭐가 문제인지 몰라서 설명도 못 하겠어요',
          '얼마 나올지 몰라서 그냥 미루게 돼요',
        ].map((text, i) => (
          <div key={i} className="flex items-center gap-3 rounded-xl px-4 py-3.5"
            style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}>
            <span className="text-base flex-shrink-0" style={{ color: '#EF4444' }}>●</span>
            <p className="text-sm leading-relaxed" style={{ color: 'rgba(255,255,255,0.8)' }}>{text}</p>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── 진단 예시 카드 (공통 컴포넌트) ──────────────────────────────────────────
function DiagCard({ symptom, cause, gauge, cost, warning }: {
  symptom: string
  cause: string
  gauge: number
  cost: string
  warning: string
}) {
  return (
    <div className="rounded-xl p-2.5"
      style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}>
      {/* 사용자 말풍선 */}
      <div className="flex justify-end mb-1.5">
        <div className="rounded-2xl rounded-tr-sm px-2.5 py-1 max-w-[90%]"
          style={{ background: 'rgba(251,191,36,0.15)', border: '1px solid rgba(251,191,36,0.25)' }}>
          <p className="text-[11px]" style={{ color: 'rgba(255,255,255,0.85)' }}>"{symptom}"</p>
        </div>
      </div>
      {/* 진단 결과 */}
      <div className="rounded-lg p-2" style={{ background: 'rgba(255,255,255,0.05)' }}>
        <div className="flex items-center justify-between mb-1">
          <p className="text-white text-[11px] font-bold">{cause}</p>
          <span className="text-[9px] font-bold rounded-full px-1.5 py-0.5"
            style={{ background: 'rgba(251,191,36,0.2)', color: '#FBBF24', border: '1px solid rgba(251,191,36,0.3)' }}>유력</span>
        </div>
        <div className="h-1 rounded-full mb-1" style={{ background: 'rgba(255,255,255,0.1)' }}>
          <div className="h-full rounded-full" style={{ width: `${gauge}%`, background: '#FBBF24' }} />
        </div>
        <div className="flex items-center justify-between">
          <p className="text-[10px]" style={{ color: 'rgba(255,255,255,0.5)' }}>
            예상 수리비 <span className="text-white font-semibold">{cost}</span>
          </p>
          <div className="pl-2" style={{ borderLeft: '2px solid #EF4444' }}>
            <p className="text-[9px] leading-tight" style={{ color: '#F87171' }}>{warning}</p>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── 슬라이드 2: 가치 (중앙 — 균등 패딩) ───────────────────────────────────
function Slide2() {
  return (
    <div className="flex flex-col h-full px-5 pt-4 pb-4 select-none">
      <div className="w-12 h-12 rounded-2xl flex items-center justify-center mb-3 flex-shrink-0"
        style={{ background: 'rgba(96,165,250,0.15)' }}>
        <span className="text-2xl">🔍</span>
      </div>
      <p className="text-[12px] font-medium mb-1.5 flex-shrink-0" style={{ color: 'rgba(255,255,255,0.45)' }}>
        정비톡이 해드리는 것
      </p>
      <h2 className="text-[19px] font-black text-white leading-tight mb-3 flex-shrink-0">
        증상만 말씀해 주시면{' '}
        <span style={{ color: '#FBBF24' }}>3분이면</span><br />
        원인을 알 수 있어요
      </h2>
      {/* 진단 예시 카드 3개 — 스크롤 없이 한 화면 */}
      <div className="space-y-2 w-full flex-1 flex flex-col justify-between">
        <DiagCard
          symptom="출발할 때마다 끼익 소리가 나요"
          cause="브레이크 패드 마모"
          gauge={75}
          cost="8 ~ 15만원"
          warning="방치 시 디스크 손상 30~60만원"
        />
        <DiagCard
          symptom="신호 대기 중에 차가 덜덜 떨려요"
          cause="점화플러그 불량 (엔진부조)"
          gauge={68}
          cost="15 ~ 25만원"
          warning="방치 시 촉매변환기 손상 80~150만원"
        />
        <DiagCard
          symptom="코너 돌 때마다 찌걱 소리가 나요"
          cause="스태빌라이저 부싱 마모"
          gauge={72}
          cost="5 ~ 10만원"
          warning="방치 시 서스펜션 링크 손상 40~80만원"
        />
      </div>
    </div>
  )
}

// ─── 슬라이드 3: 신뢰 (우측 — 왼쪽 패딩 크게) ──────────────────────────────
function Slide3() {
  return (
    <div className="flex flex-col h-full pl-12 pr-4 pt-4 pb-4 select-none">
      <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-5 flex-shrink-0"
        style={{ background: 'rgba(52,211,153,0.15)' }}>
        <span className="text-3xl">✅</span>
      </div>
      <p className="text-[13px] font-medium mb-2 flex-shrink-0" style={{ color: 'rgba(255,255,255,0.45)' }}>
        이미 많은 분들이 쓰고 있어요
      </p>
      <h2 className="text-[22px] font-black text-white leading-tight mb-5 flex-shrink-0">
        정비소 가기 전{' '}
        <span style={{ color: '#FBBF24' }}>미리 아는 것</span>만으로<br />
        달라져요
      </h2>
      {/* 통계 그리드 */}
      <div className="grid grid-cols-2 gap-3 mb-4 w-full">
        {[
          { value: '1,247건', label: '누적 진단 완료' },
          { value: '3분', label: '평균 진단 시간' },
        ].map((stat, i) => (
          <div key={i} className="rounded-xl p-3 text-center"
            style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}>
            <p className="text-xl font-black" style={{ color: '#FBBF24' }}>{stat.value}</p>
            <p className="text-xs mt-0.5" style={{ color: 'rgba(255,255,255,0.5)' }}>{stat.label}</p>
          </div>
        ))}
      </div>
      {/* 후기 카드 3개 */}
      <div className="space-y-2 w-full overflow-y-auto">
        {[
          { review: '정비소 가기 전에 미리 알고 갔더니 설명도 잘 되고 견적도 맞았어요', car: '그랜저 IG 오너 · 김**님' },
          { review: '엔진 소리가 이상해서 걱정했는데, 원인 알고 가니까 훨씬 덜 불안했어요', car: '소나타 DN8 오너 · 박**님' },
          { review: '예상 수리비가 정확해서 정비소에서 바가지 안 쓸 수 있었어요. 강추해요!', car: '아반떼 CN7 오너 · 이**님' },
        ].map((item, i) => (
          <div key={i} className="rounded-xl p-3.5"
            style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}>
            <p className="text-xs mb-1.5" style={{ color: '#FBBF24' }}>★★★★★</p>
            <p className="text-xs leading-relaxed mb-1.5" style={{ color: 'rgba(255,255,255,0.8)' }}>
              "{item.review}"
            </p>
            <p className="text-[11px]" style={{ color: 'rgba(255,255,255,0.35)' }}>{item.car}</p>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── 메인 페이지 ─────────────────────────────────────────────────────────────
export default function HomePage() {
  const router = useRouter()
  const [checking, setChecking] = useState(true)
  const [loadingKakao, setLoadingKakao] = useState(false)
  const [loadingGoogle, setLoadingGoogle] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [current, setCurrent] = useState(0)
  const [seatsLeft, setSeatsLeft] = useState<number | null>(null)
  const [isFull, setIsFull] = useState(false)
  const [dragOffset, setDragOffset] = useState(0)
  const [isDragging, setIsDragging] = useState(false)

  const containerRef = useRef<HTMLDivElement>(null)
  const touchStartX = useRef(0)
  const [slideWidth, setSlideWidth] = useState(0)

  const SLIDES = 3

  // 슬라이드 너비 측정 — checking=true 동안 스피너만 렌더해서 containerRef가 null
  // checking이 false가 된 후 실제 DOM이 마운트되면 측정
  useEffect(() => {
    if (checking) return
    const measure = () => {
      if (containerRef.current) {
        setSlideWidth(containerRef.current.offsetWidth - PEEK)
      }
    }
    measure()
    const ro = new ResizeObserver(measure)
    if (containerRef.current) ro.observe(containerRef.current)
    return () => ro.disconnect()
  }, [checking])

  // Auth 체크
  useEffect(() => {
    const check = async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setChecking(false); return }
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

  // 베타 자리 — 서버 API 경유 (서비스 롤 사용, RLS 우회)
  useEffect(() => {
    const fetchSeats = async () => {
      try {
        const res = await fetch('/api/seats', { cache: 'no-store' })
        const { count } = await res.json()
        const left = BETA_LIMIT - (count ?? 0)
        setSeatsLeft(Math.max(left, 0))
        setIsFull(left <= 0)
      } catch {
        // 실패 시 기본값 유지
      }
    }
    fetchSeats()

    // Supabase Realtime으로 새 가입자 감지 → 즉시 API 재호출
    const supabase = createClient()
    const sub = supabase
      .channel('users-count')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'users' }, fetchSeats)
      .subscribe()
    return () => { sub.unsubscribe() }
  }, [])

  // 터치 핸들러 (모바일)
  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX
    setIsDragging(true)
  }
  const handleTouchMove = (e: React.TouchEvent) => {
    const diff = e.touches[0].clientX - touchStartX.current
    setDragOffset(diff)
  }
  const handleTouchEnd = () => {
    setIsDragging(false)
    if (dragOffset < -50 && current < SLIDES - 1) setCurrent(c => c + 1)
    else if (dragOffset > 50 && current > 0) setCurrent(c => c - 1)
    setDragOffset(0)
  }

  // 마우스 드래그 핸들러 (PC)
  const handleMouseDown = (e: React.MouseEvent) => {
    touchStartX.current = e.clientX
    setIsDragging(true)
  }
  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return
    const diff = e.clientX - touchStartX.current
    setDragOffset(diff)
  }
  const handleMouseUp = () => {
    if (!isDragging) return
    setIsDragging(false)
    if (dragOffset < -50 && current < SLIDES - 1) setCurrent(c => c + 1)
    else if (dragOffset > 50 && current > 0) setCurrent(c => c - 1)
    setDragOffset(0)
  }

  // 슬라이드 이동 함수
  const goPrev = () => { if (current > 0) setCurrent(c => c - 1) }
  const goNext = () => { if (current < SLIDES - 1) setCurrent(c => c + 1) }

  // OAuth
  const handleOAuth = async (provider: 'kakao' | 'google') => {
    if (provider === 'kakao') setLoadingKakao(true)
    else setLoadingGoogle(true)
    setErrorMsg(null)
    try {
      const supabase = createClient()
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

  // 베타 배지
  const getBadge = () => {
    if (seatsLeft === null) return null
    if (seatsLeft >= 30) return { text: `🎉 얼리버드 베타 무료 · 남은 자리 ${seatsLeft}석`, color: '#FBBF24' }
    if (seatsLeft >= 10) return { text: `⚡ 마감 임박 · 남은 자리 ${seatsLeft}석`, color: '#FB923C' }
    if (seatsLeft >= 1) return { text: `🔥 거의 마감 · 남은 자리 ${seatsLeft}석`, color: '#EF4444' }
    return null
  }

  // 로딩 중
  if (checking) return (
    <div className="flex items-center justify-center min-h-screen" style={{ background: '#0D0B1A' }}>
      <div className="w-8 h-8 border-2 rounded-full animate-spin"
        style={{ borderColor: 'rgba(251,191,36,0.3)', borderTopColor: '#FBBF24' }} />
    </div>
  )

  const badge = getBadge()
  const translateX = -(current * (slideWidth + GAP)) + dragOffset

  const slides = [<Slide1 key={0} />, <Slide2 key={1} />, <Slide3 key={2} />]

  return (
    <div className="flex flex-col h-screen overflow-hidden" style={{ background: '#0D0B1A' }}>

      {/* 보라빛 배경 오버레이 */}
      <div className="absolute inset-0 pointer-events-none" style={{
        background: 'radial-gradient(ellipse 80% 40% at 50% 0%, rgba(109,40,217,0.18) 0%, transparent 70%)',
        zIndex: 0,
      }} />
      <div className="absolute inset-0 pointer-events-none" style={{
        background: 'radial-gradient(ellipse 60% 30% at 80% 60%, rgba(139,92,246,0.08) 0%, transparent 60%)',
        zIndex: 0,
      }} />

      {/* ─── 상단 고정: 로고 + 닷 + 건너뛰기 ─── */}
      <div className="flex-shrink-0 flex items-center justify-between px-5 pt-12 pb-3 relative z-10">
        {/* 로고 */}
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl overflow-hidden shadow-lg">
            <img src="/logo.png" alt="정비톡" className="w-full h-full object-cover" />
          </div>
          <span className="text-white font-black text-base tracking-tight">정비톡</span>
        </div>
        {/* 닷 + 건너뛰기 */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5">
            {Array.from({ length: SLIDES }).map((_, i) => (
              <button
                key={i}
                onClick={() => setCurrent(i)}
                className="h-1.5 rounded-full transition-all duration-300"
                style={{
                  width: i === current ? 20 : 6,
                  background: i === current ? '#FBBF24' : 'rgba(255,255,255,0.25)',
                }}
              />
            ))}
          </div>
          {current < SLIDES - 1 && (
            <button
              onClick={() => setCurrent(SLIDES - 1)}
              className="text-xs transition-colors"
              style={{ color: 'rgba(255,255,255,0.4)' }}
            >
              건너뛰기
            </button>
          )}
        </div>
      </div>

      {/* ─── 슬라이더 영역 ─── */}
      <div
        ref={containerRef}
        className="flex-1 overflow-hidden relative z-10"
      >
        {/* 왼쪽 peek — 클릭으로 이전 슬라이드 이동 (PC 지원) */}
        {current > 0 && (
          <div
            onClick={goPrev}
            className="absolute left-0 top-0 bottom-0 z-10 cursor-pointer group"
            style={{
              width: PEEK + 8,
              background: 'linear-gradient(to left, transparent 0%, rgba(251,191,36,0.18) 50%, rgba(251,191,36,0.48) 100%)',
            }}
          >
            <div className="absolute left-1.5 top-1/2 -translate-y-1/2 flex flex-col items-center gap-0.5 opacity-60 group-hover:opacity-100 transition-opacity">
              <div className="w-0.5 h-3 rounded-full" style={{ background: '#FBBF24' }} />
              <div style={{ color: '#FBBF24', fontSize: 10 }}>‹</div>
            </div>
          </div>
        )}

        {/* 오른쪽 peek — 클릭으로 다음 슬라이드 이동 (PC 지원) */}
        {current < SLIDES - 1 && (
          <div
            onClick={goNext}
            className="absolute right-0 top-0 bottom-0 z-10 cursor-pointer group"
            style={{
              width: PEEK + 8,
              background: 'linear-gradient(to right, transparent 0%, rgba(251,191,36,0.18) 50%, rgba(251,191,36,0.48) 100%)',
            }}
          >
            <div className="absolute right-1.5 top-1/2 -translate-y-1/2 flex flex-col items-center gap-0.5 opacity-60 group-hover:opacity-100 transition-opacity">
              <div className="w-0.5 h-3 rounded-full" style={{ background: '#FBBF24' }} />
              <div style={{ color: '#FBBF24', fontSize: 10 }}>›</div>
            </div>
          </div>
        )}
        <div
          className="flex h-full"
          style={{
            transform: `translateX(${translateX}px)`,
            transition: isDragging ? 'none' : 'transform 0.4s cubic-bezier(.4,0,.2,1)',
            willChange: 'transform',
            cursor: isDragging ? 'grabbing' : 'grab',
            userSelect: 'none',
          }}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
        >
          {slides.map((slide, i) => (
            <div
              key={i}
              className="flex-shrink-0 h-full overflow-y-auto"
              style={{
                width: slideWidth > 0 ? slideWidth : `calc(100vw - ${PEEK}px)`,
                marginRight: GAP,
                transform: i === current ? 'scale(1)' : 'scale(0.92)',
                opacity: i === current ? 1 : 0.6,
                transition: 'transform 0.4s ease, opacity 0.4s ease',
                transformOrigin: 'top center',
                borderRadius: 20,
                background: i === current ? 'rgba(255,255,255,0.03)' : 'transparent',
                border: i === current ? '1px solid rgba(255,255,255,0.08)' : 'none',
              }}
            >
              {slide}
            </div>
          ))}
        </div>
      </div>

      {/* ─── 하단 플로팅 CTA (슬라이드와 완전히 분리) ─── */}
      <div
        className="flex-shrink-0 relative z-10"
        style={{
          background: 'rgba(13,11,26,0.96)',
          backdropFilter: 'blur(12px)',
          borderTop: '1px solid rgba(139,92,246,0.15)',
          padding: '16px 20px 40px',
        }}
      >
        {/* 에러 메시지 */}
        {errorMsg && (
          <div className="mb-3 px-4 py-3 rounded-xl"
            style={{ background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.25)' }}>
            <p className="text-xs text-center" style={{ color: '#F87171' }}>❌ 로그인에 실패했습니다</p>
            <p className="text-xs text-center mt-0.5" style={{ color: 'rgba(255,255,255,0.35)' }}>
              💡 문제가 반복되면 다른 로그인 방법을 시도해 보세요.
            </p>
          </div>
        )}

        {isFull ? (
          /* 베타 마감 */
          <>
            <p className="text-center text-sm mb-3" style={{ color: 'rgba(255,255,255,0.6)' }}>
              베타가 마감되었어요 😢
            </p>
            <button
              className="w-full py-4 font-bold rounded-2xl text-sm"
              style={{ background: '#FBBF24', color: '#111827' }}
            >
              정식 출시 알림 받기 →
            </button>
          </>
        ) : (
          <>
            {/* 베타 배지 — 텍스트 자체 교차 깜빡임 */}
            {badge && (
              <div className="flex items-center justify-center mb-3">
                <p
                  className="text-xs font-semibold animate-pulse"
                  style={{ color: badge.color, animationDuration: '1s' }}
                >
                  {badge.text}
                </p>
              </div>
            )}

            <div className="space-y-3">
              {/* 카카오 버튼 */}
              <button
                onClick={() => handleOAuth('kakao')}
                disabled={loadingKakao || loadingGoogle}
                className="w-full py-4 font-bold rounded-2xl text-sm flex items-center justify-center gap-2 transition-opacity disabled:opacity-60"
                style={{ background: '#FEE500', color: '#3C1E1E' }}
              >
                {loadingKakao
                  ? <span className="w-5 h-5 border-2 border-[#3C1E1E]/30 border-t-[#3C1E1E] rounded-full animate-spin" />
                  : (
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="#3C1E1E">
                      <path d="M12 3C6.477 3 2 6.925 2 11.765c0 3.044 1.8 5.716 4.524 7.307l-.92 3.435c-.08.302.26.546.522.374l4.174-2.78c.55.074 1.113.114 1.7.114 5.523 0 10-3.925 10-8.765C22 6.925 17.523 3 12 3z"/>
                    </svg>
                  )}
                {loadingKakao ? '로그인 중...' : '카카오로 시작하기'}
              </button>

              {/* 구글 버튼 */}
              <button
                onClick={() => handleOAuth('google')}
                disabled={loadingKakao || loadingGoogle}
                className="w-full py-4 font-semibold rounded-2xl text-sm flex items-center justify-center gap-2 transition-colors disabled:opacity-60"
                style={{ background: 'white', color: '#374151' }}
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
                  )}
                {loadingGoogle ? '로그인 중...' : 'Google로 시작하기'}
              </button>

              {/* 이용약관 */}
              <p className="text-xs text-center" style={{ color: 'rgba(255,255,255,0.3)' }}>
                로그인 시{' '}
                <span className="underline cursor-pointer" style={{ color: 'rgba(255,255,255,0.45)' }}>이용약관</span>
                {' '}및{' '}
                <a href="/privacy" className="underline" style={{ color: 'rgba(255,255,255,0.45)' }}>
                  개인정보처리방침
                </a>
                에 동의합니다
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
