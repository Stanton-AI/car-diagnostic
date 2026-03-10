import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requestDiagnosis, checkInformationSufficiency } from '@/lib/claude/diagnose'
import {
  selectNextQuestions,
  findQuestionById,
  getAnsweredQuestionIds,
  getAnsweredAnswers,
  inferCategory,
  getMetaQuestion,
  mapMeta01ToCategory,
  getCategoryById,
} from '@/lib/diagnostic/questions'
import { findKnownIssues, formatKnownIssuesContext } from '@/lib/diagnostic/knownIssues'
import type { DiagnoseRequest, ChatMessage } from '@/types'

// ─── 연료타입 감지 ───────────────────────────────────────────────────────
// vehicleInfo.fuelType 우선, 없으면 증상 텍스트 + 모델명으로 추론
function detectFuelType(
  vehicleInfo: Partial<{ fuelType: string; model: string }> | undefined,
  symptomLower: string,
  modelLower: string
): string {
  if (vehicleInfo?.fuelType) return vehicleInfo.fuelType

  const EV_KEYWORDS = [
    '전기차', '전기자동차', '아이오닉', 'ioniq', 'ev6', 'ev9',
    '코나ev', '니로ev', '볼트ev', 'tesla', '테슬라', '리프', 'leaf',
    '모델3', 'model 3', 'model s', 'model y', 'model x',
  ]
  const DIESEL_KEYWORDS = ['디젤', 'diesel', 'crdi', 'dci', 'tdi', 'cdti', 'd4']
  const HYBRID_KEYWORDS = ['하이브리드', 'hybrid', 'phev', 'hev']
  const LPG_KEYWORDS = ['lpg', 'lpi', '가스차']

  const combinedText = `${symptomLower} ${modelLower}`

  if (EV_KEYWORDS.some(k => combinedText.includes(k)))     return 'electric'
  if (DIESEL_KEYWORDS.some(k => combinedText.includes(k))) return 'diesel'
  if (HYBRID_KEYWORDS.some(k => combinedText.includes(k))) return 'hybrid'
  if (LPG_KEYWORDS.some(k => combinedText.includes(k)))    return 'lpg'
  return 'gasoline'  // 기본값
}

// ─── 세부 증상 힌트 (drive 카테고리에서 Claude가 올바른 질문 선택하도록) ──
const SUB_SYMPTOM_HINTS: Array<{ keywords: string[]; hint: string }> = [
  {
    keywords: ['조향', '타이어', '미끌림', '슬립', '그립', '미끄러', '핸들'],
    hint: '조향·타이어·트랙션 증상 → D04(쏠림 방향/조건), D08(타이어 작업 이력) 우선. D02·D03·D06·D07은 이 증상과 무관하므로 제외.',
  },
  {
    keywords: ['가속', '출력', '힘이 없', '힘없'],
    hint: '출력·가속 저하 증상 → D02(출력저하 조건) 우선. 조향·변속 관련 질문은 제외.',
  },
  {
    keywords: ['변속', '충격', '기어'],
    hint: '변속 이상 증상 → D03(변속 증상 유형) 우선. 조향·출력 관련 질문은 제외.',
  },
  {
    keywords: ['브레이크', '제동', '밀림'],
    hint: '제동 이상 증상 → D05(브레이크 이상 유형) 우선. 가속·변속 관련 질문은 제외.',
  },
]

export async function POST(req: NextRequest) {
  try {
    const body: DiagnoseRequest = await req.json()
    const { conversationId, vehicleInfo, messages, symptomImages, isReDiagnosis } = body

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
    // "🚗 내 차", "🔍 다른 분의 차", "차량 정보 입력:" 등 셋업 메시지 제외
    const SETUP_PREFIXES = ['🚗 내 차', '🔍 앱에 등록되지 않은 차', '차량 정보 입력:']
    const symptomMessage = messages.find(m =>
      m.role === 'user' &&
      m.type === 'text' &&
      !SETUP_PREFIXES.some(p => m.content.startsWith(p))
    )
    const symptomText = symptomMessage?.content ?? ''
    const symptomLower = symptomText.toLowerCase()
    const modelLower = (vehicleInfo?.model ?? '').toLowerCase()

    // 이미 답변된 질문 ID 추출
    const answeredIds = getAnsweredQuestionIds(messages)

    // 1단계: 정보 충분 여부 판단 (아직 진단 결과 없고 재진단도 아닌 경우)
    const hasResult = messages.some(m => m.type === 'result')
    if (!hasResult && !isReDiagnosis) {
      // 질문ID → 답변 텍스트 맵 (fuel_filter·conditional_on 판단에 사용)
      const existingAnswers = getAnsweredAnswers(messages)

      // ── 연료타입 감지 (5종: gasoline/diesel/hybrid/electric/lpg) ──────────
      const detectedFuelType = detectFuelType(vehicleInfo, symptomLower, modelLower)

      // ── 카테고리 감지 ────────────────────────────────────────────────────
      let localCategory = inferCategory(symptomText)

      // ── META01 fallback: 카테고리 미감지 시 범용 분류 질문 사용 ────────────
      if (!localCategory) {
        const meta01Answer = existingAnswers['META01']

        if (!meta01Answer) {
          // META01 아직 안 물었으면 META01 반환
          const meta01 = getMetaQuestion('META01')
          if (meta01) {
            return NextResponse.json({
              success: true,
              data: {
                needsMoreInfo: true,
                detectedCategory: 'unknown',
                additionalQuestions: [meta01],
              }
            })
          }
        } else {
          // META01 답변으로 카테고리 결정 후 계속 진행
          const mappedId = mapMeta01ToCategory(meta01Answer)
          if (mappedId) {
            localCategory = getCategoryById(mappedId) ?? null
          }
        }
      }

      // ── 후보 질문 선별: 연료타입 + conditional_on 필터 적용 ─────────────
      const CANDIDATE_COUNT = 6
      let candidateQuestions = localCategory
        ? selectNextQuestions(
            localCategory.id,
            answeredIds,
            CANDIDATE_COUNT,
            detectedFuelType,
            existingAnswers
          )
        : []

      // ── 세부 증상 힌트 (drive 카테고리에서 올바른 질문 방향 지시) ────────
      const subSymptomHint = SUB_SYMPTOM_HINTS.find(e =>
        e.keywords.some(kw => symptomLower.includes(kw))
      )?.hint

      // 카테고리는 감지됐지만 해당 카테고리 질문이 모두 소진 → 바로 최종 진단
      const categoryExhausted = localCategory !== null
        && candidateQuestions.length === 0
        && answeredIds.size > 0

      // ── confidence 기반 3-tier 진단 흐름 ────────────────────────────────
      // Tier 1: confidence >= 65% + 최소 1회 질문 완료 → 바로 진단
      // Tier 2: confidence < 65% OR 아직 1번도 질문 안 함 → 추가 질문 (최대 5회)
      // Tier 3: 5회 소진 후 confidence < 40% → 원인 특정 불가 (정비소 연결 CTA)
      const MAX_QUESTIONS = 5
      const MIN_QUESTIONS = 1      // 최소 1회는 반드시 질문 (사용자 추가 설명 기회 보장)
      const CONFIDENCE_HIGH = 65   // 이상이면 바로 진단 (단, MIN_QUESTIONS 충족 후)
      const CONFIDENCE_LOW  = 40   // 5회 후 이하면 원인 특정 불가 처리

      if (!categoryExhausted) {
        const check = await checkInformationSufficiency(
          symptomText,
          vehicleInfo,
          existingAnswers,
          candidateQuestions,
          localCategory?.id,
          detectedFuelType,
          subSymptomHint
        )
        const currentConfidence = check.confidence ?? 50

        // Tier 2: 최소 질문 미충족 OR confidence 낮음 → 추가 질문
        const needsMinQuestion = answeredIds.size < MIN_QUESTIONS
        if ((needsMinQuestion || currentConfidence < CONFIDENCE_HIGH) && answeredIds.size < MAX_QUESTIONS) {
          const newQuestions = check.suggestedQuestionIds
            .filter(id => !answeredIds.has(id))
            .map(id => findQuestionById(id))
            .filter(Boolean)
            .slice(0, 1)

          if (newQuestions.length > 0) {
            return NextResponse.json({
              success: true,
              data: {
                needsMoreInfo: true,
                detectedCategory: check.detectedCategory,
                additionalQuestions: newQuestions,
                confidence: currentConfidence,
              }
            })
          }
        }

        // Tier 3: 5회 소진 후에도 confidence < 40% → 원인 특정 불가
        if (answeredIds.size >= MAX_QUESTIONS && currentConfidence < CONFIDENCE_LOW) {
          return NextResponse.json({
            success: true,
            data: {
              needsMoreInfo: false,
              lowConfidence: true,
              confidence: currentConfidence,
            }
          })
        }
        // Tier 1 또는 (5회 소진 + confidence 40~65%) → 진단 진행
      }
    }

    // 2단계: 고질병 DB 매칭 (토큰 추가 없이 컨텍스트만 삽입)
    const matchedIssues = findKnownIssues(vehicleInfo, symptomText)
    const knownIssuesCtx = formatKnownIssuesContext(matchedIssues)

    // 3단계: 최종 진단 실행
    const result = await requestDiagnosis(messages, vehicleInfo, symptomImages, isReDiagnosis, knownIssuesCtx)

    // 4단계: 결과 저장
    const guestSessionId = req.headers.get('x-guest-session-id')
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
