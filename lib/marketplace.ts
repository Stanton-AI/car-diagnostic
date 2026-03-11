import type { SupabaseClient } from '@supabase/supabase-js'
import type { PartnerShop, RepairRequest, ShopBid, RepairJob } from '@/types'

// ─── 딜러 기준가 계산 (앵커 가격) ──────────────────────────────────────
// 공임나라 독립정비소 기준 × 2.0~2.5배 → 블루핸즈/오토큐 수준
export function calcDealerPrice(
  indieMin: number,
  indieMax: number,
  multiplier = 2.2,
): { min: number; max: number } {
  return {
    min: Math.round(indieMin * multiplier / 10000) * 10000,
    max: Math.round(indieMax * multiplier / 10000) * 10000,
  }
}

// ─── 절감액 계산 ──────────────────────────────────────────────────────────
export function calcSavings(
  dealerTotal: number,
  bidTotal: number,
): { amount: number; percent: number } {
  const amount = dealerTotal - bidTotal
  const percent = Math.round((amount / dealerTotal) * 100)
  return { amount, percent }
}

// ─── 카테고리 라벨 ──────────────────────────────────────────────────────
export const SHOP_CATEGORIES: Record<string, string> = {
  brake:        '브레이크',
  engine:       '엔진',
  transmission: '변속기',
  suspension:   '서스펜션',
  ac:           '에어컨/냉난방',
  electric:     '전기/전자',
  tire:         '타이어/휠',
  body:         '판금/도색',
  exhaust:      '배기/머플러',
  oil:          '오일교환',
  general:      '일반정비',
}

// ─── 수리 요청 상태 라벨 ────────────────────────────────────────────────
export const REQUEST_STATUS_LABEL: Record<string, { label: string; color: string }> = {
  open:        { label: '입찰 대기', color: 'text-blue-600 bg-blue-50' },
  bidding:     { label: '입찰 중',   color: 'text-amber-600 bg-amber-50' },
  accepted:    { label: '낙찰 완료', color: 'text-green-600 bg-green-50' },
  in_progress: { label: '수리 중',   color: 'text-purple-600 bg-purple-50' },
  completed:   { label: '완료',      color: 'text-gray-600 bg-gray-100' },
  cancelled:   { label: '취소됨',    color: 'text-gray-400 bg-gray-50' },
}

// ─── 입찰 상태 라벨 ─────────────────────────────────────────────────────
export const BID_STATUS_LABEL: Record<string, { label: string; color: string }> = {
  pending:  { label: '검토 중', color: 'text-blue-600 bg-blue-50' },
  accepted: { label: '낙찰!',   color: 'text-green-600 bg-green-50' },
  rejected: { label: '미선택', color: 'text-gray-500 bg-gray-50' },
  expired:  { label: '만료됨', color: 'text-gray-400 bg-gray-50' },
}

// ─── API 헬퍼: 수리 요청 생성 ────────────────────────────────────────────
export async function createRepairRequest(
  payload: {
    conversationId?: string
    symptomSummary: string
    diagnosisCategory?: string
    urgencyLevel?: string
    dealerPartsMin?: number
    dealerPartsMax?: number
    dealerLaborMin?: number
    dealerLaborMax?: number
    contactPhone?: string
    preferredLocation: string
    preferredDate?: string
    consumerNotes?: string
    vehicleMaker?: string
    vehicleModel?: string
    vehicleYear?: number
    vehicleMileage?: number
  },
): Promise<{ id: string } | null> {
  try {
    const res = await fetch('/api/repair-requests', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    if (!res.ok) return null
    const data = await res.json()
    return data
  } catch {
    return null
  }
}

// ─── API 헬퍼: 입찰 목록 조회 ────────────────────────────────────────────
export async function fetchBids(requestId: string): Promise<ShopBid[]> {
  try {
    const res = await fetch(`/api/shop-bids?requestId=${requestId}`)
    if (!res.ok) return []
    return await res.json()
  } catch {
    return []
  }
}

// ─── API 헬퍼: 입찰 수락 ─────────────────────────────────────────────────
export async function acceptBid(bidId: string): Promise<boolean> {
  try {
    const res = await fetch(`/api/shop-bids/${bidId}/accept`, { method: 'PUT' })
    return res.ok
  } catch {
    return false
  }
}

// ─── DB 헬퍼: 내 파트너샵 조회 ───────────────────────────────────────────
export async function getMyShop(supabase: SupabaseClient): Promise<PartnerShop | null> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data } = await supabase
    .from('partner_shops')
    .select('*')
    .eq('user_id', user.id)
    .single()

  return data ? mapShop(data) : null
}

// ─── DB 행 → 타입 매핑 ───────────────────────────────────────────────────
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function mapShop(row: any): PartnerShop {
  return {
    id: row.id,
    userId: row.user_id,
    name: row.name,
    ownerName: row.owner_name,
    phone: row.phone,
    address: row.address,
    latitude: row.latitude,
    longitude: row.longitude,
    categories: row.categories ?? [],
    description: row.description,
    profileImageUrl: row.profile_image_url,
    businessNumber: row.business_number,
    status: row.status,
    commissionRate: row.commission_rate ?? 0.10,
    subscriptionPlan: row.subscription_plan ?? 'free',
    subscriptionExpiresAt: row.subscription_expires_at,
    rating: row.rating ?? 0,
    reviewCount: row.review_count ?? 0,
    totalJobs: row.total_jobs ?? 0,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function mapRequest(row: any): RepairRequest {
  return {
    id: row.id,
    userId: row.user_id,
    conversationId: row.conversation_id,
    symptomSummary: row.symptom_summary,
    diagnosisCategory: row.diagnosis_category,
    urgencyLevel: row.urgency_level,
    dealerPartsMin: row.dealer_parts_min,
    dealerPartsMax: row.dealer_parts_max,
    dealerLaborMin: row.dealer_labor_min,
    dealerLaborMax: row.dealer_labor_max,
    dealerTotalMin: row.dealer_total_min,
    dealerTotalMax: row.dealer_total_max,
    contactPhone: row.contact_phone,
    preferredLocation: row.preferred_location,
    preferredLatitude: row.preferred_latitude,
    preferredLongitude: row.preferred_longitude,
    preferredDate: row.preferred_date,
    consumerNotes: row.consumer_notes,
    vehicleMaker: row.vehicle_maker,
    vehicleModel: row.vehicle_model,
    vehicleYear: row.vehicle_year,
    vehicleMileage: row.vehicle_mileage,
    status: row.status,
    acceptedBidId: row.accepted_bid_id,
    bidCount: row.bid_count ?? 0,
    bidDeadline: row.bid_deadline,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function mapBid(row: any): ShopBid {
  return {
    id: row.id,
    requestId: row.request_id,
    shopId: row.shop_id,
    partsCost: row.parts_cost,
    laborCost: row.labor_cost,
    totalCost: row.total_cost,
    estimatedDays: row.estimated_days ?? 1,
    availableDate: row.available_date,
    bidNotes: row.bid_notes,
    status: row.status,
    commissionRate: row.commission_rate ?? 0.10,
    commissionAmount: row.commission_amount,
    shop: row.partner_shops ? mapShop(row.partner_shops) : undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

// ─── 마감 남은 시간 포맷 ────────────────────────────────────────────────
export function formatDeadline(deadlineIso: string): string {
  const diff = new Date(deadlineIso).getTime() - Date.now()
  if (diff <= 0) return '마감됨'
  const hours = Math.floor(diff / 3600000)
  const mins  = Math.floor((diff % 3600000) / 60000)
  if (hours >= 24) return `${Math.floor(hours / 24)}일 ${hours % 24}시간 남음`
  if (hours > 0)   return `${hours}시간 ${mins}분 남음`
  return `${mins}분 남음`
}
