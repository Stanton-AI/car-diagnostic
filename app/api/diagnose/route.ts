import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requestDiagnosis, checkAndGenerateQuestion } from '@/lib/claude/diagnose'
import { findKnownIssues, formatKnownIssuesContext } from '@/lib/diagnostic/knownIssues'
import { findSimilarCases, formatSimilarCasesContext, generateEmbedding } from '@/lib/embeddings'
import { findRepairCosts, formatRepairCostsContext } from '@/lib/repairCosts'
import type { DiagnoseRequest, ChatMessage } from '@/types'

const SETUP_PREFIXES = ['🚗 내 차', '🔍 앱에 등록되지 않은 차', '🔍 다른 분의 차', '차량 정보 입력:']

function getAnsweredCount(messages: ChatMessage[]): number {
  return messages.filter(m => m.type === 'answer' && m.metadata?.questionId).length
}

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

const UNSURE_PHRASES = ['잘 모르겠어요', '모르겠어요', '해당없음', '없음', '모름']

function shouldForceFinish(messages: ChatMessage[], answeredCount: number): boolean {
  const answerMsgs = messages.filter(m => m.type === 'answer')
  const unsureCount = answerMsgs.filter(m =>
    UNSURE_PHRASES.some(p => m.content.includes(p))
  ).length
  return unsureCount >= 2 && answeredCount >= 1
}

const MAX_QUESTIONS = 4
const CONFIDENCE_LOW = 50

export async function POST(req: NextRequest) {
  try {
    const body: DiagnoseRequest = await req.json()
    const { conversationId, vehicleInfo, messages, symptomImages, symptomImagesB64, isReDiagnosis } = body

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    // 관리자 설정 조회 (과금 모드 확인)
    const { data: config } = await supabase
      .from('admin_config')
      .select('diagnosis_mode, guest_max_diagnosis, user_daily_limit')
      .single()

    // 비로그인 사용자 진단 횟수 체크
    if (!user && config?.guest_max_diagnosis) {
      const guestSessionId = req.headers.get('x-guest-session-id')
      if (guestSessionId) {
        const { count } = await supabase
          .from('conversations')
          .select('*', { count: 'exact', head: true })
          .eq('guest_session_id', guestSessionId)
          .not('final_result', 'is', null)

        if ((count ?? 0) >= config.guest_max_diagnosis) {
          return NextResponse.json(
            { success: false, error: 'GUEST_LIMIT_REACHED' },
            { status: 429 }
          )
        }
      }
    }

    // 초기 증상 텍스트 추출
    const symptomMessage = messages.find(m =>
      m.role === 'user' &&
      m.type === 'text' &&
      !SETUP_PREFIXES.some(p => m.content.startsWith(p))
    )
    const symptomText = symptomMessage?.content ?? ''

    const answeredCount = getAnsweredCount(messages)
    const hasResult = messages.some(m => m.type === 'result')

    console.log('[diagnose] symptomImagesB64 count:', symptomImagesB64?.length ?? 0,
      '| answeredCount:', answeredCount,
      '| symptomText:', symptomText?.slice(0, 30))

    // ── 역질문 단계 (재진단/결과 없는 경우만) ──────────────────────────────
    if (!hasResult && !isReDiagnosis) {
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

        // AI가 계통 좁히기에 의미 있는 질문이 있다고 판단한 경우에만 질문
        const needsQuestion = check.question && !check.sufficient

        if (needsQuestion && check.question) {
          return NextResponse.json({
            success: true,
            data: {
              needsMoreInfo: true,
              additionalQuestions: [check.question],
              confidence: check.confidence,
            }
          })
        }

        // MAX 소진 후 confidence < 50%
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

    // ── 최종 진단 실행 ──────────────────────────────────────────────────────
    const result = await requestDiagnosis(messages, vehicleInfo, symptomImagesB64, isReDiagnosis, knownIssuesCtx + similarCasesCtx + repairCostsCtx)

    // ── 결과 저장 + 임베딩 생성 ─────────────────────────────────────────────
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
          ...updateData,
        })
    }

    return NextResponse.json({
      success: true,
      data: { result, needsMoreInfo: false }
    })

  } catch (error) {
    console.error('Diagnose API error:', error)
    return NextResponse.json(
      { success: false, error: '진단 처리 중 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}
