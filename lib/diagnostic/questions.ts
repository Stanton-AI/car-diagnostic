import questionsDB from '@/data/diagnostic-questions.json'
import type { DiagnosticQuestionsDB, DiagnosticCategory, DiagnosticQuestion, ChatMessage } from '@/types'

const db = questionsDB as DiagnosticQuestionsDB

// 카테고리 키워드 기반으로 증상 카테고리 추론
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

// 대화 내역 기반으로 이미 답변한 질문 ID 추출
export function getAnsweredQuestionIds(messages: ChatMessage[]): Set<string> {
  const answered = new Set<string>()
  for (const msg of messages) {
    if (msg.metadata?.questionId) {
      answered.add(msg.metadata.questionId)
    }
  }
  return answered
}

// 카테고리에서 아직 묻지 않은 질문 선별 (우선순위 순, 최대 n개)
export function selectNextQuestions(
  categoryId: string,
  answeredIds: Set<string>,
  maxCount = 3
): DiagnosticQuestion[] {
  const cat = db.categories.find(c => c.id === categoryId)
  if (!cat) return []

  // L1 → L2 → L3 순서 우선
  const sorted = [...cat.questions].sort((a, b) => {
    const lvA = parseInt(a.level) || 1
    const lvB = parseInt(b.level) || 1
    return lvA - lvB
  })

  return sorted.filter(q => !answeredIds.has(q.id)).slice(0, maxCount)
}

// 공통 질문 (주행거리, 연식) 중 아직 안 물은 것
export function getUnansweredCommonQuestions(answeredIds: Set<string>): DiagnosticQuestion[] {
  return db.common.filter(q => !answeredIds.has(q.id))
}

// 질문 ID로 질문 찾기
export function findQuestionById(id: string): DiagnosticQuestion | undefined {
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
