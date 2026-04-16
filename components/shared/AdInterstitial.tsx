'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { track } from '@/lib/amplitude'

interface Props {
  /** 광고 표시 여부 */
  isOpen: boolean
  /** 광고 시청 완료 후 호출 */
  onComplete: () => void
  /** 광고 카운트다운 초 (기본 30초) */
  countdownSeconds?: number
}

declare global {
  interface Window {
    adsbygoogle?: Array<Record<string, unknown>>
  }
}

/** AdSense 스크립트를 한 번만 동적으로 로드 */
let adsenseLoading = false
function loadAdSenseScript(): Promise<void> {
  return new Promise((resolve) => {
    if (typeof window === 'undefined') { resolve(); return }
    if (document.querySelector('script[src*="adsbygoogle"]')) { resolve(); return }
    if (adsenseLoading) { resolve(); return }
    adsenseLoading = true
    const script = document.createElement('script')
    script.src = 'https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-2199747031677342'
    script.async = true
    script.crossOrigin = 'anonymous'
    script.onload = () => resolve()
    script.onerror = () => resolve()
    document.head.appendChild(script)
  })
}

/** 자체 프로모션 팁 (AdSense 미승인 동안 표시) */
const PROMO_TIPS = [
  { icon: '🔧', title: '정기 점검의 중요성', desc: '6개월마다 엔진오일을 교환하면 엔진 수명이 최대 2배 연장됩니다.' },
  { icon: '🚗', title: '타이어 공기압 체크', desc: '적정 공기압을 유지하면 연비가 3~5% 개선되고 안전성이 높아집니다.' },
  { icon: '💡', title: '경고등이 켜졌다면?', desc: '경고등 무시는 소액 수리를 대형 사고로 키울 수 있습니다. 바로 점검하세요.' },
  { icon: '🛡️', title: '겨울철 냉각수 관리', desc: '부동액 비율이 낮으면 엔진 동파 위험! 겨울 전 꼭 점검하세요.' },
  { icon: '⚡', title: '배터리 수명 관리', desc: '배터리는 보통 3~5년. 시동이 약해지면 교체 시기입니다.' },
  { icon: '🌡️', title: '여름철 에어컨 관리', desc: '에어컨 필터는 1년마다 교체! 악취와 세균 번식을 예방합니다.' },
  { icon: '🔋', title: '하이브리드 배터리', desc: '하이브리드 배터리 교체비는 200~400만원. 정기 점검으로 수명을 연장하세요.' },
]

export default function AdInterstitial({ isOpen, onComplete, countdownSeconds = 30 }: Props) {
  const [mode, setMode] = useState<'choose' | 'ad'>('choose')
  const [countdown, setCountdown] = useState(countdownSeconds)
  const [adLoaded, setAdLoaded] = useState(false)
  const [promoIndex, setPromoIndex] = useState(0)
  const [showPayToast, setShowPayToast] = useState(false)
  const adPushed = useRef(false)

  // 리셋
  useEffect(() => {
    if (!isOpen) {
      setMode('choose')
      setCountdown(countdownSeconds)
      adPushed.current = false
      setPromoIndex(0)
      setShowPayToast(false)
      return
    }
    track('ad_interstitial_shown')
  }, [isOpen, countdownSeconds])

  // 카운트다운 타이머 (광고 모드에서만)
  useEffect(() => {
    if (!isOpen || mode !== 'ad') return

    const timer = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          clearInterval(timer)
          return 0
        }
        return prev - 1
      })
    }, 1000)

    return () => clearInterval(timer)
  }, [isOpen, mode])

  // 프로모션 팁 순환 (5초마다)
  useEffect(() => {
    if (!isOpen || mode !== 'ad' || adLoaded) return

    const tipTimer = setInterval(() => {
      setPromoIndex(prev => (prev + 1) % PROMO_TIPS.length)
    }, 5000)

    return () => clearInterval(tipTimer)
  }, [isOpen, mode, adLoaded])

  // AdSense 스크립트 동적 로드
  useEffect(() => {
    if (!isOpen || mode !== 'ad' || adPushed.current) return

    const activateAd = async () => {
      try {
        await loadAdSenseScript()
        await new Promise(r => setTimeout(r, 300))
        if (window.adsbygoogle) {
          window.adsbygoogle.push({})
          adPushed.current = true
          setAdLoaded(true)
        }
      } catch {
        setAdLoaded(false)
      }
    }
    activateAd()
  }, [isOpen, mode])

  const handleUnlock = useCallback(() => {
    track('ad_interstitial_completed', { method: 'ad', watched_seconds: countdownSeconds })
    onComplete()
  }, [onComplete, countdownSeconds])

  const handleChooseAd = useCallback(() => {
    track('ad_interstitial_choice', { method: 'ad' })
    setMode('ad')
  }, [])

  const handleChoosePay = useCallback(() => {
    track('ad_interstitial_choice', { method: 'pay' })
    setShowPayToast(true)
    setTimeout(() => setShowPayToast(false), 3000)
  }, [])

  if (!isOpen) return null

  const progress = mode === 'ad' ? ((countdownSeconds - countdown) / countdownSeconds) * 100 : 0
  const currentTip = PROMO_TIPS[promoIndex]

  // ── 선택 화면 ──
  if (mode === 'choose') {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-up">
        <div className="bg-white rounded-2xl shadow-2xl mx-4 max-w-[420px] w-full overflow-hidden">
          {/* 헤더 */}
          <div className="bg-gradient-to-r from-primary-600 to-primary-500 px-5 py-5 text-white text-center">
            <p className="text-2xl mb-2">🔍</p>
            <p className="text-[15px] font-extrabold">
              진단 리포트가 준비되었습니다!
            </p>
            <p className="text-xs opacity-80 mt-1">
              리포트 확인 방법을 선택해 주세요
            </p>
          </div>

          <div className="px-5 py-5 space-y-3">
            {/* 옵션 1: 즉시 결제 */}
            <button
              onClick={handleChoosePay}
              className="w-full p-4 border-2 border-primary-200 bg-primary-50/50 rounded-2xl text-left hover:border-primary-400 active:scale-[0.98] transition-all group relative"
            >
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-primary-100 rounded-xl flex items-center justify-center flex-shrink-0">
                  <span className="text-2xl">⚡</span>
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <p className="text-[14px] font-extrabold text-gray-900">바로 보기</p>
                    <span className="px-2 py-0.5 bg-primary-500 text-white text-[10px] font-bold rounded-full">추천</span>
                  </div>
                  <p className="text-[12px] text-gray-500 mt-0.5">결제 즉시 리포트를 확인할 수 있어요</p>
                </div>
                <p className="text-[16px] font-black text-primary-600">1,900원</p>
              </div>
            </button>

            {/* 옵션 2: 광고 시청 */}
            <button
              onClick={handleChooseAd}
              className="w-full p-4 border-2 border-gray-200 bg-gray-50/50 rounded-2xl text-left hover:border-gray-300 active:scale-[0.98] transition-all"
            >
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-gray-100 rounded-xl flex items-center justify-center flex-shrink-0">
                  <span className="text-2xl">🎬</span>
                </div>
                <div className="flex-1">
                  <p className="text-[14px] font-extrabold text-gray-900">무료로 보기</p>
                  <p className="text-[12px] text-gray-500 mt-0.5">30초 광고를 보면 무료로 확인할 수 있어요</p>
                </div>
                <p className="text-[14px] font-bold text-gray-400">무료</p>
              </div>
            </button>
          </div>

          <p className="text-center text-[11px] text-gray-400 pb-4">
            수익은 서비스 무료 운영에 사용됩니다
          </p>
        </div>

        {/* 결제 준비 중 토스트 */}
        {showPayToast && (
          <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-[60] animate-fade-up">
            <div className="bg-gray-900 text-white px-5 py-3 rounded-xl shadow-2xl text-sm font-medium flex items-center gap-2">
              <span>🚧</span>
              <span>결제 기능을 준비 중입니다. 광고를 통해 무료로 이용해 주세요!</span>
            </div>
          </div>
        )}
      </div>
    )
  }

  // ── 광고 시청 화면 ──
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-up">
      <div className="bg-white rounded-2xl shadow-2xl mx-4 max-w-[420px] w-full overflow-hidden">
        {/* 헤더 */}
        <div className="bg-gradient-to-r from-primary-600 to-primary-500 px-5 py-4 text-white">
          <p className="text-sm font-bold flex items-center gap-2">
            🎬 광고를 시청 중입니다
          </p>
          <p className="text-xs opacity-90 mt-1">
            잠시만 기다려 주시면 진단 결과를 무료로 보실 수 있어요
          </p>
        </div>

        {/* 프로그레스 바 */}
        <div className="h-1.5 bg-gray-200 relative">
          <div
            className="h-full bg-gradient-to-r from-primary-500 to-green-400 transition-all duration-1000 ease-linear"
            style={{ width: `${progress}%` }}
          />
        </div>

        {/* 광고 / 프로모션 영역 */}
        <div className="px-5 py-4">
          <div className="bg-gray-50 border border-gray-200 rounded-xl min-h-[280px] flex items-center justify-center relative overflow-hidden">
            {/* AdSense 광고 슬롯 */}
            <ins
              className="adsbygoogle"
              style={{ display: adLoaded ? 'block' : 'none', width: '100%', height: '280px' }}
              data-ad-client="ca-pub-2199747031677342"
              data-ad-slot="XXXXXXXXXX"
              data-ad-format="auto"
              data-full-width-responsive="true"
            />

            {/* AdSense 미승인 시: 자체 프로모션 */}
            {!adLoaded && (
              <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center">
                <div
                  className="w-20 h-20 rounded-2xl flex items-center justify-center mb-4 shadow-sm transition-all duration-500"
                  style={{ background: 'linear-gradient(135deg, #EEF2FF, #E0E7FF)' }}
                >
                  <span className="text-4xl">{currentTip.icon}</span>
                </div>

                <div className="transition-all duration-500">
                  <p className="text-[11px] text-primary-500 font-bold tracking-wider uppercase mb-1.5">
                    정비톡 TIP
                  </p>
                  <h3 className="text-[15px] font-extrabold text-gray-900 mb-2">
                    {currentTip.title}
                  </h3>
                  <p className="text-[13px] text-gray-500 leading-relaxed">
                    {currentTip.desc}
                  </p>
                </div>

                <div className="flex gap-1.5 mt-5">
                  {PROMO_TIPS.map((_, i) => (
                    <div
                      key={i}
                      className={`h-1.5 rounded-full transition-all duration-300 ${
                        i === promoIndex
                          ? 'w-6 bg-primary-500'
                          : 'w-1.5 bg-gray-300'
                      }`}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* 하단 CTA */}
        <div className="px-5 pb-5">
          {countdown > 0 ? (
            <div className="space-y-2">
              <button
                disabled
                className="w-full py-3.5 bg-gray-100 text-gray-400 rounded-xl text-sm font-semibold cursor-not-allowed"
              >
                {countdown}초 후 진단 결과 확인 가능
              </button>
              {/* 광고 도중 결제 전환 유도 */}
              <button
                onClick={handleChoosePay}
                className="w-full py-2.5 text-primary-500 text-[12px] font-semibold hover:text-primary-600 transition-colors"
              >
                ⚡ 기다리기 싫다면? 1,900원으로 바로 보기
              </button>
            </div>
          ) : (
            <button
              onClick={handleUnlock}
              className="w-full py-3.5 bg-primary-600 text-white rounded-xl text-sm font-bold hover:bg-primary-700 active:scale-[0.98] transition-all shadow-lg shadow-primary-600/25"
            >
              ✅ 진단 리포트 보기
            </button>
          )}
          <p className="text-center text-[11px] text-gray-400 mt-2">
            광고 수익은 서비스 무료 운영에 사용됩니다
          </p>
        </div>
      </div>

      {/* 결제 준비 중 토스트 */}
      {showPayToast && (
        <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-[60] animate-fade-up">
          <div className="bg-gray-900 text-white px-5 py-3 rounded-xl shadow-2xl text-sm font-medium flex items-center gap-2">
            <span>🚧</span>
            <span>결제 기능을 준비 중입니다. 광고를 통해 무료로 이용해 주세요!</span>
          </div>
        </div>
      )}
    </div>
  )
}
