import questionsDB from '@/data/diagnostic-questions.json'
import type { DiagnosticQuestionsDB, DiagnosticCategory, DiagnosticQuestion, ChatMessage } from '@/types'

const db = questionsDB as DiagnosticQuestionsDB

// ─── 연료타입 정규화 ───────────────────────────────────────────────────────
// TypeScript FuelType 'electric' ↔ JSON fuel_filter 'ev' 매핑
function normalizeFuelType(fuelType: string): string {
  return fuelType === 'electric' ? 'ev' : fuelType
}

// fuel_filter 호환성 체크
// fuel_filter 없거나 빈 배열 → 모든 연료타입에 적용
// fuel_filter 있음 → 차량 연료타입이 해당 배열에 있어야 표시
function isFuelTypeCompatible(q: DiagnosticQuestion, fuelType?: string): boolean {
  if (!q.fuel_filter || q.fuel_filter.length === 0) return true
  if (!fuelType) return true  // 연료타입 불명 → 모든 질문 허용
  return q.fuel_filter.includes(normalizeFuelType(fuelType))
}

// conditional_on 체크
// conditional_on 없음 → 항상 표시
// conditional_on 있음 → 참조 질문이 답변됐고 키워드가 매칭돼야 표시
function isConditionalMet(
  q: DiagnosticQuestion,
  answeredAnswers?: Record<string, string>
): boolean {
  if (!q.conditional_on) return true   // 조건 없으면 항상 표시
  if (!answeredAnswers) return false   // 답변 데이터 없으면 조건 불충족 (숨김)

  const { question_id, answer_keywords } = q.conditional_on
  const answer = answeredAnswers[question_id]
  if (!answer) return false   // 참조 질문이 아직 답변되지 않음

  return answer_keywords.some(kw => answer.includes(kw))
}

// ─── 카테고리 감지 ────────────────────────────────────────────────────────
// 키워드 스코어링으로 증상 텍스트에서 카테고리 추론
export function inferCategory(symptomText: string): DiagnosticCategory | null {
  const text = symptomText.toLowerCase()
  let bestMatch: { category: DiagnosticCategory; score: number } | null = null

  for (const cat of db.categories) {
    const score = cat.keywords.filter(kw => text.includes(kw.toLowerCase())).length
    if (score > 0 && (!bestMatch || score > bestMatch.score)) {
      bestMatch = { category: cat, score }
    }
  }
  return bestMatch?.category ?? null
}

// ─── 답변 추출 ────────────────────────────────────────────────────────────
// 대화 내역에서 이미 답변한 질문 ID Set 추출
export function getAnsweredQuestionIds(messages: ChatMessage[]): Set<string> {
  const answered = new Set<string>()
  for (const msg of messages) {
    if (msg.metadata?.questionId) {
      answered.add(msg.metadata.questionId)
    }
  }
  return answered
}

// 대화 내역에서 질문ID → 답변 텍스트 맵 생성 (conditional_on 판단에 사용)
export function getAnsweredAnswers(messages: ChatMessage[]): Record<string, string> {
  const answers: Record<string, string> = {}
  for (const msg of messages) {
    if (msg.type === 'answer' && msg.metadata?.questionId) {
      answers[msg.metadata.questionId] = msg.content
    }
  }
  return answers
}

// ─── 질문 선택 ────────────────────────────────────────────────────────────
// 카테고리에서 아직 묻지 않은 질문 선별 (L1 → L2 → L3 순서, 최대 n개)
// - fuelType: 차량 연료타입 (fuel_filter 필터링에 사용)
// - answeredAnswers: 질문ID→답변 맵 (conditional_on 판단에 사용)
export function selectNextQuestions(
  categoryId: string,
  answeredIds: Set<string>,
  maxCount = 3,
  fuelType?: string,
  answeredAnswers?: Record<string, string>
): DiagnosticQuestion[] {
  const cat = db.categories.find(c => c.id === categoryId)
  if (!cat) return []

  // L1 → L2 → L3 순서 우선
  const sorted = [...cat.questions].sort((a, b) => {
    const lvA = parseInt(a.level) || 1
    const lvB = parseInt(b.level) || 1
    return lvA - lvB
  })

  return sorted
    .filter(q => !answeredIds.has(q.id))                         // 이미 답변한 질문 제외
    .filter(q => isFuelTypeCompatible(q, fuelType))              // 연료타입 호환 질문만
    .filter(q => isConditionalMet(q, answeredAnswers))           // 조건 충족 질문만
    .slice(0, maxCount)
}

// ─── META01 범용 분류 질문 ────────────────────────────────────────────────
// 카테고리 미감지 시 사용하는 범용 분류 질문 가져오기
export function getMetaQuestion(id: string): DiagnosticQuestion | undefined {
  return db.meta?.find(q => q.id === id)
}

// META01 선택지 텍스트 → 카테고리 ID 매핑
const META01_CATEGORY_MAP: Array<{ keywords: string[]; categoryId: string }> = [
  { keywords: ['소리', '이음'],                               categoryId: 'sound' },
  { keywords: ['진동', '떨림'],                               categoryId: 'vibration' },
  { keywords: ['경고등'],                                     categoryId: 'warning' },
  { keywords: ['냄새'],                                       categoryId: 'smell' },
  { keywords: ['시동'],                                       categoryId: 'start' },
  { keywords: ['주행', '가속', '변속', '브레이크', '조향'],  categoryId: 'drive' },
  { keywords: ['누출', '냉각수', '오일'],                     categoryId: 'leak' },
  { keywords: ['전기', '전자'],                               categoryId: 'electric' },
  { keywords: ['외관', '소모품'],                             categoryId: 'exterior' },
]

export function mapMeta01ToCategory(answerContent: string): string | null {
  for (const entry of META01_CATEGORY_MAP) {
    if (entry.keywords.some(kw => answerContent.includes(kw))) {
      return entry.categoryId
    }
  }
  return null
}

// ─── 기타 헬퍼 ───────────────────────────────────────────────────────────
// 공통 질문 (주행거리, 연식) 중 아직 안 물은 것
export function getUnansweredCommonQuestions(answeredIds: Set<string>): DiagnosticQuestion[] {
  return db.common.filter(q => !answeredIds.has(q.id))
}

// 질문 ID로 질문 찾기 (meta → categories → common 순서)
export function findQuestionById(id: string): DiagnosticQuestion | undefined {
  // META 질문 먼저 검색 (META01 등)
  const metaQ = db.meta?.find(q => q.id === id)
  if (metaQ) return metaQ

  for (const cat of db.categories) {
    const q = cat.questions.find(q => q.id === id)
    if (q) return q
  }
  return db.common.find(q => q.id === id)
}

// 카테고리 목록 반환
export function getAllCategories(): DiagnosticCategory[] {
  return db.categories
}

// 특정 카테고리 반환
export function getCategoryById(id: string): DiagnosticCategory | undefined {
  return db.categories.find(c => c.id === id)
}

export { db as diagnosticQuestionsDB }
