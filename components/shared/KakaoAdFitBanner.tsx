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
 * 카카오 애드핏 배너 광고
 *
 * 구현 포인트:
 * - 카카오 AdFit SDK(ba.min.js)는 로드 시점에만 DOM의 `.kakao_ad_area` 를 스캔한다.
 *   따라서 React에서 `<ins>` 를 나중에 주입하면 스캔 대상이 되지 않아 광고가 안 뜸.
 * - 해결: 컴포넌트가 마운트될 때마다 `<ins>` 와 `<script>` 를 세트로 재삽입하여
 *   스크립트가 실행되면서 바로 옆 `<ins>` 를 스캔하도록 한다.
 * - 이는 카카오 공식 가이드 HTML 구조(<ins> + <script> 이웃)와 동일한 패턴.
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

    // 기존 내용 초기화
    container.innerHTML = ''

    // 1) ins 엘리먼트 생성
    const ins = document.createElement('ins')
    ins.className = 'kakao_ad_area'
    ins.style.display = 'none'
    ins.setAttribute('data-ad-unit', adUnit)
    ins.setAttribute('data-ad-width', String(width))
    ins.setAttribute('data-ad-height', String(height))

    // 2) 스크립트 엘리먼트 생성 (매번 재주입 → SDK가 옆 ins를 스캔하도록)
    const script = document.createElement('script')
    script.type = 'text/javascript'
    script.src = 'https://t1.kakaocdn.net/kas/static/ba.min.js'
    script.async = true

    // 3) 순서: ins 먼저 → script (공식 가이드와 동일 순서)
    container.appendChild(ins)
    container.appendChild(script)

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
