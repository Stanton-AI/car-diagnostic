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
}

export interface DiagnosticCategory {
  id: string
  label: string
  emoji: string
  keywords: string[]
  questions: DiagnosticQuestion[]
}

export interface DiagnosticQuestionsDB {
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
  result: DiagnosisResult
  needsMoreInfo: boolean
  additionalQuestions?: DiagnosticQuestion[]
}
