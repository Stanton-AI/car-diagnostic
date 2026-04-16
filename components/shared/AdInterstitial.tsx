'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { track } from '@/lib/amplitude'

interface Props {
  /** 광고 표시 여부 */
  isOpen: boolean
  /** 광고 시청 완료 후 호출 */
  onComplete: () => void
  /** 카운트다운 초 (기본 15초) */
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
]

export default function AdInterstitial({ isOpen, onComplete, countdownSeconds = 15 }: Props) {
  const [countdown, setCountdown] = useState(countdownSeconds)
  const [adLoaded, setAdLoaded] = useState(false)
  const [promoIndex, setPromoIndex] = useState(0)
  const adPushed = useRef(false)

  // 카운트다운 타이머
  useEffect(() => {
    if (!isOpen) {
      setCountdown(countdownSeconds)
      adPushed.current = false
      setPromoIndex(0)
      return
    }

    track('ad_interstitial_shown')

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
  }, [isOpen, countdownSeconds])

  // 프로모션 팁 순환 (5초마다)
  useEffect(() => {
    if (!isOpen || adLoaded) return

    const tipTimer = setInterval(() => {
      setPromoIndex(prev => (prev + 1) % PROMO_TIPS.length)
    }, 5000)

    return () => clearInterval(tipTimer)
  }, [isOpen, adLoaded])

  // AdSense 스크립트 동적 로드 + 광고 슬롯 활성화
  useEffect(() => {
    if (!isOpen || adPushed.current) return

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
  }, [isOpen])

  const handleUnlock = useCallback(() => {
    track('ad_interstitial_completed', { watched_seconds: countdownSeconds })
    onComplete()
  }, [onComplete, countdownSeconds])

  if (!isOpen) return null

  const progress = ((countdownSeconds - countdown) / countdownSeconds) * 100
  const currentTip = PROMO_TIPS[promoIndex]

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-up">
      <div className="bg-white rounded-2xl shadow-2xl mx-4 max-w-[420px] w-full overflow-hidden">
        {/* 헤더 */}
        <div className="bg-gradient-to-r from-primary-600 to-primary-500 px-5 py-4 text-white">
          <p className="text-sm font-bold flex items-center gap-2">
            🔍 진단 리포트가 준비되었습니다!
          </p>
          <p className="text-xs opacity-90 mt-1">
            잠시만 기다려 주시면 진단 결과를 바로 보실 수 있어요
          </p>
        </div>

        {/* 프로그레스 바 */}
        <div className="h-1 bg-gray-200 relative">
          <div
            className="h-full bg-gradient-to-r from-primary-500 to-primary-400 transition-all duration-1000 ease-linear"
            style={{ width: `${progress}%` }}
          />
        </div>

        {/* 광고 / 프로모션 영역 */}
        <div className="px-5 py-4">
          <div className="bg-gray-50 border border-gray-200 rounded-xl min-h-[280px] flex items-center justify-center relative overflow-hidden">
            {/* AdSense 광고 슬롯 (승인 후 활성화) */}
            <ins
              className="adsbygoogle"
              style={{ display: adLoaded ? 'block' : 'none', width: '100%', height: '280px' }}
              data-ad-client="ca-pub-2199747031677342"
              data-ad-slot="XXXXXXXXXX"
              data-ad-format="auto"
              data-full-width-responsive="true"
            />

            {/* AdSense 미승인 시: 자체 프로모션 (자동차 관리 팁) */}
            {!adLoaded && (
              <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center">
                {/* 팁 아이콘 */}
                <div
                  className="w-20 h-20 rounded-2xl flex items-center justify-center mb-4 shadow-sm transition-all duration-500"
                  style={{ background: 'linear-gradient(135deg, #EEF2FF, #E0E7FF)' }}
                >
                  <span className="text-4xl">{currentTip.icon}</span>
                </div>

                {/* 팁 카드 */}
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

                {/* 팁 인디케이터 */}
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
            <button
              disabled
              className="w-full py-3.5 bg-gray-100 text-gray-400 rounded-xl text-sm font-semibold cursor-not-allowed transition-all relative overflow-hidden"
            >
              <span className="relative z-10">{countdown}초 후 진단 결과 확인 가능</span>
            </button>
          ) : (
            <button
              onClick={handleUnlock}
              className="w-full py-3.5 bg-primary-600 text-white rounded-xl text-sm font-bold hover:bg-primary-700 active:scale-[0.98] transition-all shadow-lg shadow-primary-600/25 animate-pulse-gentle"
            >
              ✅ 진단 리포트 보기
            </button>
          )}
          <p className="text-center text-[11px] text-gray-400 mt-2">
            광고 수익은 서비스 무료 운영에 사용됩니다
          </p>
        </div>
      </div>
    </div>
  )
}
