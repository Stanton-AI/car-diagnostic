// ─── 차량 ──────────────────────────────────────────────────────────────
export type FuelType = 'gasoline' | 'diesel' | 'hybrid' | 'electric' | 'lpg'

export interface Vehicle {
  id: string
  userId: string
  maker: string
  model: string
  year: number
  mileage: number
  fuelType: FuelType
  plateNumber?: string
  nickname?: string
  createdAt: string
  updatedAt: string
}

// ─── 진단 질문 DB ───────────────────────────────────────────────────────
export interface DiagnosticQuestion {
  id: string
  level: string
  question: string
  choices: string[]
  input_type: string
  logic?: string
  causes?: string
  /** 적용 연료타입 배열 (없거나 빈 배열이면 모든 연료타입에 적용) */
  fuel_filter?: string[]
  /** 특정 질문의 답변 키워드가 매칭될 때만 이 질문을 표시 */
  conditional_on?: {
    question_id: string
    answer_keywords: string[]
  }
  /** 선택지 인덱스(0-based) → 다음 질문 ID 매핑 (D01 등에서 사용) */
  conditional_next?: Record<string, string>
}

export interface DiagnosticCategory {
  id: string
  label: string
  emoji: string
  keywords: string[]
  questions: DiagnosticQuestion[]
}

export interface DiagnosticQuestionsDB {
  /** META01 등 범용 분류 질문 (카테고리 미감지 시 fallback) */
  meta?: DiagnosticQuestion[]
  common: DiagnosticQuestion[]
  categories: DiagnosticCategory[]
}

// ─── 대화 메시지 ────────────────────────────────────────────────────────
export type MessageRole = 'user' | 'assistant' | 'system'
export type MessageType =
  | 'text'
  | 'image'
  | 'question'       // AI가 추가 질문할 때
  | 'answer'         // 사용자가 선택지로 답변할 때
  | 'result'         // 최종 진단 결과
  | 'self_check'     // 자가점검 팁
  | 'self_check_input' // 자가점검 결과 입력
  | 're_diagnosis'   // 재진단 결과

export interface ChatMessage {
  id: string
  role: MessageRole
  type: MessageType
  content: string
  metadata?: {
    questionId?: string
    choices?: string[]
    selectedChoice?: string
    images?: string[]
    result?: DiagnosisResult
    selfCheckItems?: SelfCheckItem[]
  }
  timestamp: string
}

// ─── 진단 결과 ─────────────────────────────────────────────────────────
export type UrgencyLevel = 'HIGH' | 'MID' | 'LOW'

export interface DiagnosisCause {
  name: string           // 한국어 원인명
  enName?: string        // 영문명 (예: Spark Plug Failure)
  probability: number    // 0~100 (%)
  description: string    // 설명
}

export interface DiagnosisCost {
  parts: number          // 부품비 (원)
  labor: number          // 공임비 (원)
  total: number          // 합계
  note?: string          // 추가 설명
}

export interface SelfCheckItem {
  id: string
  tip: string            // 자가점검 팁
  checked?: boolean      // 사용자가 체크했는지
  result?: string        // 자가점검 후 입력한 결과
}

export interface DiagnosisResult {
  category: string
  summary: string        // 주요 증상 요약 (1줄)
  causes: DiagnosisCause[]
  cost: DiagnosisCost
  urgency: UrgencyLevel
  urgencyReason: string
  selfCheck: SelfCheckItem[]
  shopTip: string        // 정비소 방문 시 전달 사항
  disclaimer: string
}

// ─── 대화 세션 ─────────────────────────────────────────────────────────
export interface Conversation {
  id: string
  userId?: string
  guestSessionId?: string
  vehicleId?: string
  vehicle?: Vehicle
  messages: ChatMessage[]
  initialSymptom: string
  symptomImages?: string[]
  finalResult?: DiagnosisResult
  selfCheckResult?: DiagnosisResult
  isPublic: boolean
  createdAt: string
  updatedAt: string
}

// ─── 사용자 프로필 ──────────────────────────────────────────────────────
export interface UserProfile {
  id: string
  email: string
  displayName?: string
  avatarUrl?: string
  role: 'user' | 'admin'
  provider: 'kakao' | 'google'
  agreedToTerms: boolean
  agreedAt?: string
  createdAt: string
}

// ─── 파트너 정비소 ──────────────────────────────────────────────────────
export interface Workshop {
  id: string
  name: string
  address: string
  phone: string
  categories: string[]
  rating?: number
  reviewCount?: number
  distanceKm?: number    // 사용자 위치 기반 (런타임 계산)
  isActive: boolean
  joinedAt: string
}

// ─── 마켓플레이스 ────────────────────────────────────────────────────────

export type ShopStatus = 'pending' | 'active' | 'suspended'
export type SubscriptionPlan = 'free' | 'basic' | 'pro'
export type RequestStatus = 'open' | 'bidding' | 'accepted' | 'in_progress' | 'completed' | 'cancelled'
export type BidStatus = 'pending' | 'accepted' | 'rejected' | 'expired'
export type JobStatus = 'scheduled' | 'in_progress' | 'completed' | 'cancelled'
export type PaymentStatus = 'pending' | 'paid' | 'refunded'

export interface PartnerShop {
  id: string
  userId: string
  name: string
  ownerName: string
  phone: string
  address: string
  latitude?: number
  longitude?: number
  categories: string[]
  description?: string
  profileImageUrl?: string
  businessNumber?: string
  status: ShopStatus
  commissionRate: number
  subscriptionPlan: SubscriptionPlan
  subscriptionExpiresAt?: string
  rating: number
  reviewCount: number
  totalJobs: number
  distanceKm?: number   // 런타임 계산
  createdAt: string
  updatedAt: string
}

export interface RepairRequest {
  id: string
  userId: string
  conversationId?: string
  symptomSummary: string
  diagnosisCategory?: string
  urgencyLevel?: 'HIGH' | 'MID' | 'LOW'
  // 딜러 앵커 가격
  dealerPartsMin?: number
  dealerPartsMax?: number
  dealerLaborMin?: number
  dealerLaborMax?: number
  dealerTotalMin?: number
  dealerTotalMax?: number
  // 소비자 입력
  contactPhone?: string
  preferredLocation: string
  preferredLatitude?: number
  preferredLongitude?: number
  preferredDate?: string
  consumerNotes?: string
  // 차량 스냅샷
  vehicleMaker?: string
  vehicleModel?: string
  vehicleYear?: number
  vehicleMileage?: number
  // 상태
  status: RequestStatus
  acceptedBidId?: string
  bidCount: number
  bidDeadline: string
  // 조인 데이터
  bids?: ShopBid[]
  createdAt: string
  updatedAt: string
}

export interface ShopBid {
  id: string
  requestId: string
  shopId: string
  partsCost: number
  laborCost: number
  totalCost: number
  estimatedDays: number
  availableDate?: string
  bidNotes?: string
  status: BidStatus
  commissionRate: number
  commissionAmount?: number
  // 조인 데이터
  shop?: PartnerShop
  createdAt: string
  updatedAt: string
}

export interface RepairJob {
  id: string
  requestId: string
  bidId: string
  shopId: string
  userId: string
  actualPartsCost?: number
  actualLaborCost?: number
  actualTotalCost?: number
  startedAt?: string
  completedAt?: string
  status: JobStatus
  paymentStatus: PaymentStatus
  paymentMethod?: string
  paymentKey?: string
  orderId?: string
  paidAt?: string
  createdAt: string
  updatedAt: string
}

export interface ShopReview {
  id: string
  jobId: string
  shopId: string
  userId: string
  rating: number
  content?: string
  isVerified: boolean
  createdAt: string
}

export interface Notification {
  id: string
  userId?: string
  shopId?: string
  type: 'new_request' | 'new_bid' | 'bid_accepted' | 'bid_rejected' | 'job_complete' | 'payment_required' | 'review_request'
  title: string
  body?: string
  data: Record<string, unknown>
  isRead: boolean
  createdAt: string
}

// ─── 관리자 설정 ────────────────────────────────────────────────────────
export type DiagnosisMode = 'free' | 'paid' | 'ab_test'

export interface AdminConfig {
  diagnosisMode: DiagnosisMode
  freeUsersRatio: number    // A/B 테스트 시 무료 사용자 비율 (0~100)
  guestMaxDiagnosis: number // 비로그인 최대 진단 횟수
  userDailyLimit: number    // 로그인 사용자 일일 한도 (0 = 무제한)
  maintenanceBanner?: string // 홈 공지 배너 텍스트
  updatedAt: string
}

// ─── API 응답 ──────────────────────────────────────────────────────────
export interface ApiResponse<T = void> {
  success: boolean
  data?: T
  error?: string
}

export interface DiagnoseRequest {
  conversationId: string
  vehicleInfo?: Partial<Vehicle>
  messages: ChatMessage[]
  symptomImages?: string[]   // Supabase Storage URLs
  isReDiagnosis?: boolean
}

export interface DiagnoseResponse {
  result?: DiagnosisResult
  needsMoreInfo: boolean
  additionalQuestions?: DiagnosticQuestion[]
  lowConfidence?: boolean   // 5회 질문 후에도 confidence < 40% → 원인 특정 불가
  confidence?: number       // 디버깅용
}
