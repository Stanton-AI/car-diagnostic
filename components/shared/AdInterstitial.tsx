'use client'

import { useState, useEffect, useCallback } from 'react'
import { track } from '@/lib/amplitude'

interface Props {
  /** 광고 표시 여부 */
  isOpen: boolean
  /** 광고 시청 완료 후 호출 */
  onComplete: () => void
  /** 카운트다운 초 (기본 5초) */
  countdownSeconds?: number
}

declare global {
  interface Window {
    adsbygoogle?: Array<Record<string, unknown>>
  }
}

export default function AdInterstitial({ isOpen, onComplete, countdownSeconds = 5 }: Props) {
  const [countdown, setCountdown] = useState(countdownSeconds)
  const [adLoaded, setAdLoaded] = useState(false)

  // 카운트다운 타이머
  useEffect(() => {
    if (!isOpen) {
      setCountdown(countdownSeconds)
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

  // AdSense 광고 슬롯 활성화
  useEffect(() => {
    if (!isOpen) return
    try {
      ;(window.adsbygoogle = window.adsbygoogle || []).push({})
      setAdLoaded(true)
    } catch {
      // AdSense 미승인 상태에서는 에러 발생 — 무시
      setAdLoaded(false)
    }
  }, [isOpen])

  const handleUnlock = useCallback(() => {
    track('ad_interstitial_completed', { watched_seconds: countdownSeconds })
    onComplete()
  }, [onComplete, countdownSeconds])

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-up">
      <div className="bg-white rounded-2xl shadow-2xl mx-4 max-w-[420px] w-full overflow-hidden">
        {/* 헤더 */}
        <div className="bg-gradient-to-r from-primary-600 to-primary-500 px-5 py-4 text-white">
          <p className="text-sm font-bold flex items-center gap-2">
            🔍 진단 리포트가 준비되었습니다!
          </p>
          <p className="text-xs opacity-90 mt-1">
            광고를 잠시 확인해 주시면 진단 결과를 바로 보실 수 있어요
          </p>
        </div>

        {/* 광고 영역 */}
        <div className="px-5 py-4">
          <div className="bg-gray-50 border border-gray-200 rounded-xl min-h-[250px] flex items-center justify-center relative overflow-hidden">
            {/* AdSense 광고 슬롯 */}
            <ins
              className="adsbygoogle"
              style={{ display: 'block', width: '100%', height: '250px' }}
              data-ad-client="ca-pub-2199747031677342"
              data-ad-slot="XXXXXXXXXX"
              data-ad-format="auto"
              data-full-width-responsive="true"
            />

            {/* AdSense 미로드 시 플레이스홀더 */}
            {!adLoaded && (
              <div className="absolute inset-0 flex flex-col items-center justify-center text-gray-400 bg-gray-50">
                <div className="w-16 h-16 bg-gray-200 rounded-xl flex items-center justify-center mb-3">
                  <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v12a2 2 0 01-2 2z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 2v4M8 2v4M3 10h18" />
                  </svg>
                </div>
                <p className="text-sm font-medium">광고 영역</p>
                <p className="text-xs mt-1">파트너 광고가 곧 표시됩니다</p>
              </div>
            )}
          </div>
        </div>

        {/* 하단 CTA */}
        <div className="px-5 pb-5">
          {countdown > 0 ? (
            <button
              disabled
              className="w-full py-3.5 bg-gray-200 text-gray-500 rounded-xl text-sm font-semibold cursor-not-allowed transition-all"
            >
              {countdown}초 후 진단 결과 확인 가능
            </button>
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
    </div>
  )
}
