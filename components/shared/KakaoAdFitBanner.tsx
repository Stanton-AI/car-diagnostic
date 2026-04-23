'use client'

import { useEffect, useRef } from 'react'

interface Props {
  /** 카카오 애드핏 광고 단위 ID (예: DAN-OJrsyYqfdTZfTyOB) */
  adUnit: string
  /** 광고 너비 (기본 320) */
  width?: number
  /** 광고 높이 (기본 50) */
  height?: number
  /** 추가 클래스명 */
  className?: string
}

/**
 * 카카오 애드핏 SDK 스크립트를 한 번만 로드
 * AdSense 로더(AdInterstitial.tsx)와 동일한 싱글톤 패턴
 */
let kakaoAdScriptLoading = false
function loadKakaoAdScript(): Promise<void> {
  return new Promise((resolve) => {
    if (typeof window === 'undefined') { resolve(); return }
    if (document.querySelector('script[src*="t1.kakaocdn.net/kas/static/ba.min.js"]')) {
      resolve(); return
    }
    if (kakaoAdScriptLoading) { resolve(); return }
    kakaoAdScriptLoading = true

    const script = document.createElement('script')
    script.src = 'https://t1.kakaocdn.net/kas/static/ba.min.js'
    script.async = true
    script.onload = () => resolve()
    script.onerror = () => resolve()
    document.head.appendChild(script)
  })
}

/**
 * 카카오 애드핏 배너 광고
 *
 * 사용 예:
 *   <KakaoAdFitBanner adUnit="DAN-OJrsyYqfdTZfTyOB" />
 *
 * 주의:
 * - 리워드/게이트 용도로 사용 금지 (카카오 정책 위반)
 * - 단순 수익용 디스플레이 배너로만 사용
 * - 스크립트 최초 설치 후 광고 송출까지 최대 30분 대기 가능
 */
export default function KakaoAdFitBanner({
  adUnit,
  width = 320,
  height = 50,
  className = '',
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    // React 리렌더 시 중복 삽입 방지 위해 ins 엘리먼트를 매번 새로 생성
    const ins = document.createElement('ins')
    ins.className = 'kakao_ad_area'
    ins.style.display = 'none'
    ins.setAttribute('data-ad-unit', adUnit)
    ins.setAttribute('data-ad-width', String(width))
    ins.setAttribute('data-ad-height', String(height))

    container.innerHTML = ''
    container.appendChild(ins)

    // SDK 로드 (이미 로드됐으면 즉시 resolve)
    // 스크립트는 DOM 내의 .kakao_ad_area 요소를 자동 스캔함
    loadKakaoAdScript()

    return () => {
      if (container) container.innerHTML = ''
    }
  }, [adUnit, width, height])

  return (
    <div
      ref={containerRef}
      className={`flex justify-center items-center ${className}`}
      style={{ minHeight: height, minWidth: width }}
      aria-label="광고"
    />
  )
}
