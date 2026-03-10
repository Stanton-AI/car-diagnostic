import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'
import { v4 as uuidv4 } from 'uuid'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Guest session ID 관리
export const GUEST_SESSION_KEY = 'car_diag_guest_id'

export function getOrCreateGuestSessionId(): string {
  if (typeof window === 'undefined') return uuidv4()
  const existing = localStorage.getItem(GUEST_SESSION_KEY)
  if (existing) return existing
  const newId = uuidv4()
  localStorage.setItem(GUEST_SESSION_KEY, newId)
  return newId
}

// 비용 포맷
export function formatKRW(amount: number): string {
  if (amount >= 10000) {
    return `${(amount / 10000).toFixed(0)}만원`
  }
  return `${amount.toLocaleString()}원`
}

export function formatKRWRange(min: number, max: number): string {
  return `${formatKRW(min)} ~ ${formatKRW(max)}`
}

// 주행거리 포맷
export function formatMileage(km: number): string {
  return `${km.toLocaleString()}km`
}

// 날짜 포맷
export function formatDate(dateStr: string): string {
  const date = new Date(dateStr)
  const now = new Date()
  const diff = now.getTime() - date.getTime()
  const days = Math.floor(diff / (1000 * 60 * 60 * 24))

  if (days === 0) {
    const hours = Math.floor(diff / (1000 * 60 * 60))
    if (hours === 0) {
      const mins = Math.floor(diff / (1000 * 60))
      return `${mins}분 전`
    }
    return `${hours}시간 전`
  }
  if (days === 1) return '어제'
  if (days < 7) return `${days}일 전`

  return date.toLocaleDateString('ko-KR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

// 새 메시지 생성 헬퍼
export function createMessage(
  role: 'user' | 'assistant',
  content: string,
  type: string = 'text',
  metadata?: Record<string, unknown>
) {
  return {
    id: uuidv4(),
    role,
    type,
    content,
    metadata,
    timestamp: new Date().toISOString(),
  }
}

// 긴급도 한국어 변환
export function urgencyLabel(urgency: string) {
  const map: Record<string, { label: string; color: string; bg: string }> = {
    HIGH: { label: '즉시 점검 필요', color: 'text-red-600', bg: 'bg-red-50 border-red-200' },
    MID:  { label: '빠른 점검 필요해요', color: 'text-amber-600', bg: 'bg-amber-50 border-amber-200' },
    LOW:  { label: '3개월 내 점검 권장', color: 'text-green-600', bg: 'bg-green-50 border-green-200' },
  }
  return map[urgency] ?? map.MID
}

// 공유 URL 생성
export function getShareUrl(conversationId: string): string {
  const base = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
  return `${base}/results/${conversationId}`
}

// 카카오 공유 (클라이언트 사이드)
export function shareToKakao(url: string, title: string, description: string) {
  if (typeof window === 'undefined' || !(window as Window & { Kakao?: { isInitialized: () => boolean; Share: { sendDefault: (opts: Record<string, unknown>) => void } } }).Kakao) return
  const Kakao = (window as unknown as { Kakao: { isInitialized: () => boolean; Share: { sendDefault: (opts: Record<string, unknown>) => void } } }).Kakao
  if (!Kakao.isInitialized()) return
  Kakao.Share.sendDefault({
    objectType: 'feed',
    content: {
      title,
      description,
      imageUrl: `${process.env.NEXT_PUBLIC_APP_URL}/og-default.png`,
      link: { mobileWebUrl: url, webUrl: url },
    },
  })
}
