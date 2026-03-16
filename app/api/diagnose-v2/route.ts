import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { checkAndGenerateQuestion, requestDiagnosis } from '@/lib/claude/diagnose'
import { findKnownIssues, formatKnownIssuesContext } from '@/lib/diagnostic/knownIssues'
import { findSimilarCases, formatSimilarCasesContext, generateEmbedding } from '@/lib/embeddings'
import { findRepairCosts, formatRepairCostsContext } from '@/lib/repairCosts'
import type { DiagnoseRequest, ChatMessage } from '@/types'

// 셋업 메시지 필터 (기존과 동일)
const SETUP_PREFIXES = ['🚗 내 차', '🔍 앱에 등록되지 않은 차', '🔍 다른 분의 차', '차량 정보 입력:']

// 이미 답변된 AI 생성 질문 추출 (metadata.questionId 기반)
function getAnsweredCount(messages: ChatMessage[]): number {
  return messages.filter(m => m.type === 'answer' && m.metadata?.questionId).length
}

// 기존 Q&A 쌍 추출 (AI 질문 생성 컨텍스트용)
function extractQAPairs(messages: ChatMessage[]): Array<{ question: string; answer: string }> {
  const pairs: Array<{ question: string; answer: string }> = []
  for (let i = 0; i < messages.length; i++) {
    const msg = messages[i]
    if (msg.type === 'question') {
      const nextAnswer = messages.slice(i + 1).find(m => m.type === 'answer')
      if (nextAnswer) {
        pairs.push({ question: msg.content, answer: nextAnswer.content })
      }
    }
  }
  return pairs
}

// "모름/없음" 조기 종료 체크
const UNSURE_PHRASES = ['잘 모르겠어요', '모르겠어요', '해당없음', '없음', '모름']
function shouldForceFinish(messages: ChatMessage[], answeredCount: number): boolean {
  const answerMsgs = messages.filter(m => m.type === 'answer')
  const unsureCount = answerMsgs.filter(m =>
    UNSURE_PHRASES.some(p => m.content.includes(p))
  ).length
  return unsureCount >= 2 && answeredCount >= 1
}

const MAX_QUESTIONS = 4
const CONFIDENCE_LOW = 40

export async function POST(req: NextRequest) {
  try {
    const body: DiagnoseRequest = await req.json()
    const { conversationId, vehicleInfo, messages, symptomImages, symptomImagesB64, isReDiagnosis } = body

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    // 초기 증상 텍스트 추출
    const symptomMessage = messages.find(m =>
      m.role === 'user' &&
      m.type === 'text' &&
      !SETUP_PREFIXES.some(p => m.content.startsWith(p))
    )
    const symptomText = symptomMessage?.content ?? ''

    const answeredCount = getAnsweredCount(messages)
    const hasResult = messages.some(m => m.type === 'result')

    // 이미지만 첨부한 경우 Q&A 건너뛰고 바로 진단 (이미지가 곧 증상 정보)
    const imageOnlySymptom = (symptomImagesB64?.length ?? 0) > 0 && answeredCount === 0 &&
      (!symptomText || symptomText === '이미지를 첨부했습니다.')

    // ── 역질문 단계 (재진단/결과 없는 경우만) ──────────────────────────
    if (!hasResult && !isReDiagnosis && !imageOnlySymptom) {
      const forceFinish = shouldForceFinish(messages, answeredCount)

      if (!forceFinish && answeredCount < MAX_QUESTIONS) {
        const existingQAs = extractQAPairs(messages)

        const check = await checkAndGenerateQuestion(
          symptomText,
          vehicleInfo,
          existingQAs,
          answeredCount,
          symptomImagesB64,
        )

        if (!check.sufficient && check.question) {
          return NextResponse.json({
            success: true,
            data: {
              needsMoreInfo: true,
              additionalQuestions: [check.question],
              confidence: check.confidence,
            }
          })
        }

        // 4회 소진 후 confidence < 40%
        if (answeredCount >= MAX_QUESTIONS && check.confidence < CONFIDENCE_LOW) {
          return NextResponse.json({
            success: true,
            data: {
              needsMoreInfo: false,
              lowConfidence: true,
              confidence: check.confidence,
            }
          })
        }
      }
    }

    // ── 고질병 DB + 유사 케이스 (RAG) + 수리비 DB 병렬 조회 ──────────────────
    const matchedIssues = findKnownIssues(vehicleInfo, symptomText)
    const knownIssuesCtx = formatKnownIssuesContext(matchedIssues)

    const [similarCases, repairCosts] = await Promise.all([
      findSimilarCases(supabase, symptomText),
      findRepairCosts(supabase, symptomText, vehicleInfo),
    ])
    const similarCasesCtx = formatSimilarCasesContext(similarCases)
    const repairCostsCtx = formatRepairCostsContext(repairCosts)

    const result = await requestDiagnosis(messages, vehicleInfo, symptomImagesB64, isReDiagnosis, knownIssuesCtx + similarCasesCtx + repairCostsCtx)

    // ── 결과 저장 + 임베딩 생성 ─────────────────────────────────────────
    const guestSessionId = req.headers.get('x-guest-session-id')
    const embedding = symptomText ? await generateEmbedding(symptomText).catch(() => null) : null

    const updateData = isReDiagnosis
      ? { self_check_result: result, updated_at: new Date().toISOString() }
      : {
          final_result: result,
          category: result.category,
          urgency: result.urgency,
          cost_min: result.cost.parts,
          cost_max: result.cost.total,
          messages: messages,
          updated_at: new Date().toISOString(),
          ...(embedding ? { embedding } : {}),
        }

    if (conversationId) {
      await supabase
        .from('conversations')
        .upsert({
          id: conversationId,
          user_id: user?.id ?? null,
          guest_session_id: guestSessionId ?? null,
          initial_symptom: symptomText,
          symptom_images: symptomImages ?? [],
          variant: 'v2',
          ...updateData,
        })
    }

    return NextResponse.json({
      success: true,
      data: { result, needsMoreInfo: false }
    })

  } catch (error) {
    console.error('Diagnose-v2 API error:', error)
    return NextResponse.json(
      { success: false, error: '진단 처리 중 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}
