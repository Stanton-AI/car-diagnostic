// ====================================================================
// 토스페이먼츠 결제 모듈 스켈레톤 (Phase 2~3)
// 실 적용 시: https://docs.tosspayments.com 참고
// 필요한 환경변수:
//   TOSS_CLIENT_KEY=test_ck_...   (프론트엔드용)
//   TOSS_SECRET_KEY=test_sk_...   (서버용, 절대 노출 금지)
// ====================================================================

export const TOSS_CLIENT_KEY = process.env.NEXT_PUBLIC_TOSS_CLIENT_KEY ?? ''
export const TOSS_SECRET_KEY = process.env.TOSS_SECRET_KEY ?? ''
export const TOSS_API_BASE   = 'https://api.tosspayments.com/v1'

// ─── 결제 수수료 계산 ────────────────────────────────────────────────────
export function calcCommission(totalCost: number, rate = 0.10): number {
  return Math.round(totalCost * rate)
}

// ─── 주문 ID 생성 ─────────────────────────────────────────────────────────
export function generateOrderId(requestId: string): string {
  const ts = Date.now().toString(36).toUpperCase()
  const suffix = Math.random().toString(36).slice(2, 6).toUpperCase()
  return `MIKY-${ts}-${suffix}`
}

// ─── 결제 요청 파라미터 생성 (프론트엔드) ────────────────────────────────
export interface TossPaymentParams {
  amount: number
  orderId: string
  orderName: string        // "브레이크 패드 교체 외 1건"
  customerName: string
  customerEmail?: string
  successUrl: string       // 결제 성공 시 리다이렉트 URL
  failUrl: string          // 결제 실패 시 리다이렉트 URL
}

export function buildPaymentParams(
  jobId: string,
  amount: number,
  orderName: string,
  customerName: string,
  customerEmail?: string,
): TossPaymentParams {
  const orderId = generateOrderId(jobId)
  const base = process.env.NEXT_PUBLIC_APP_URL ?? 'https://car-diagnostic-one.vercel.app'
  return {
    amount,
    orderId,
    orderName,
    customerName,
    customerEmail,
    successUrl: `${base}/repair/payment/success?jobId=${jobId}&orderId=${orderId}`,
    failUrl:    `${base}/repair/payment/fail?jobId=${jobId}`,
  }
}

// ─── 서버: 결제 승인 (토스 API 호출) ────────────────────────────────────
export interface TossConfirmPayload {
  paymentKey: string
  orderId: string
  amount: number
}

export interface TossConfirmResult {
  paymentKey: string
  orderId: string
  status: string
  totalAmount: number
  method: string
  approvedAt: string
}

export async function confirmPayment(
  payload: TossConfirmPayload,
): Promise<TossConfirmResult | null> {
  if (!TOSS_SECRET_KEY) {
    // 개발용 mock 응답
    console.warn('[payments] TOSS_SECRET_KEY not set — returning mock response')
    return {
      paymentKey: payload.paymentKey,
      orderId: payload.orderId,
      status: 'DONE',
      totalAmount: payload.amount,
      method: 'card',
      approvedAt: new Date().toISOString(),
    }
  }

  try {
    const encoded = Buffer.from(`${TOSS_SECRET_KEY}:`).toString('base64')
    const res = await fetch(`${TOSS_API_BASE}/payments/confirm`, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${encoded}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    })
    if (!res.ok) {
      const err = await res.json()
      console.error('[payments] Toss confirm error:', err)
      return null
    }
    return await res.json()
  } catch (e) {
    console.error('[payments] Toss confirm exception:', e)
    return null
  }
}

// ─── 서버: 환불 (취소) ──────────────────────────────────────────────────
export async function cancelPayment(
  paymentKey: string,
  cancelReason: string,
  cancelAmount?: number,
): Promise<boolean> {
  if (!TOSS_SECRET_KEY) {
    console.warn('[payments] Mock cancel — always succeeds in dev')
    return true
  }

  try {
    const encoded = Buffer.from(`${TOSS_SECRET_KEY}:`).toString('base64')
    const res = await fetch(`${TOSS_API_BASE}/payments/${paymentKey}/cancel`, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${encoded}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        cancelReason,
        ...(cancelAmount != null ? { cancelAmount } : {}),
      }),
    })
    return res.ok
  } catch {
    return false
  }
}

// ─── Phase 3: 구독 플랜 가격 ─────────────────────────────────────────────
export const SUBSCRIPTION_PLANS = {
  free:  { price: 0,       label: '무료',   features: ['월 5건 입찰', '기본 프로필'] },
  basic: { price: 29000,   label: '베이직', features: ['월 30건 입찰', '우선 노출', '통계 대시보드'] },
  pro:   { price: 59000,   label: '프로',   features: ['무제한 입찰', '최상단 노출', '전담 CS', '수수료 7%'] },
} as const

export type SubscriptionPlanKey = keyof typeof SUBSCRIPTION_PLANS
