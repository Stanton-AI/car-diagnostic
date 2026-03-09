import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requestDiagnosis, checkInformationSufficiency } from '@/lib/claude/diagnose'
import { selectNextQuestions, findQuestionById, getAnsweredQuestionIds, inferCategory } from '@/lib/diagnostic/questions'
import type { DiagnoseRequest, ChatMessage } from '@/types'

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
    // "🚗 내 차", "🔍 다른 분의 차", "차량 정보 입력:" 등 셋업 메시지를 제외하고
    // 실제 증상 설명 메시지를 찾습니다
    const SETUP_PREFIXES = ['🚗 내 차', '🔍 다른 분의 차', '차량 정보 입력:']
    const symptomMessage = messages.find(m =>
      m.role === 'user' &&
      m.type === 'text' &&
      !SETUP_PREFIXES.some(p => m.content.startsWith(p))
    )
    const symptomText = symptomMessage?.content ?? ''

    // 이미 답변된 질문 ID 추출
    const answeredIds = getAnsweredQuestionIds(messages)

    // 1단계: 정보 충분 여부 판단 (아직 진단 결과 없고 재진단도 아닌 경우)
    const hasResult = messages.some(m => m.type === 'result')
    if (!hasResult && !isReDiagnosis) {
      const existingAnswers: Record<string, string> = {}
      for (const msg of messages) {
        if (msg.type === 'answer' && msg.metadata?.questionId) {
          existingAnswers[msg.metadata.questionId] = msg.content
        }
      }

      // ── EV 여부 감지 ────────────────────────────────────────────────────
      // 차량 연료 타입, 모델명, 증상 텍스트 키워드로 전기차 판별
      const symptomLower = symptomText.toLowerCase()
      const EV_FUEL_KEYWORDS = ['전기', 'ev', 'bev']
      const EV_MODEL_KEYWORDS = ['아이오닉', 'ioniq', 'ev6', 'ev9', '코나ev', '니로ev', '볼트ev', 'tesla', '테슬라', '리프', 'leaf', '모델3', 'model 3', 'model s', 'model y', 'model x']
      const isEV = (
        EV_FUEL_KEYWORDS.some(k => (vehicleInfo?.fuelType ?? '').toLowerCase().includes(k)) ||
        EV_MODEL_KEYWORDS.some(k => (vehicleInfo?.model ?? '').toLowerCase().includes(k)) ||
        symptomLower.includes('전기차') ||
        symptomLower.includes('전기자동차')
      )

      // EV에서 의미 없는 질문 ID (내연기관 전용: 연료필터·엔진오일·변속기오일)
      const EV_INCOMPATIBLE_IDS = new Set(['D06', 'D07', 'V09', 'W07'])

      // ── 카테고리 자동 감지 및 후보 질문 필터링 (L1→L2→L3 순서) ──────────
      // 키워드 기반으로 카테고리 감지 → 해당 카테고리 질문만 Claude에게 제공
      // → Claude가 전체 질문 풀에서 무관한 카테고리 질문을 고르는 문제 방지
      const localCategory = inferCategory(symptomText)
      const CANDIDATE_COUNT = 6  // Claude에게 제공할 후보 질문 수 (level 순 정렬)
      let candidateQuestions = localCategory
        ? selectNextQuestions(localCategory.id, answeredIds, CANDIDATE_COUNT)
        : []

      // EV이면 내연기관 전용 질문 제거
      if (isEV && candidateQuestions.length > 0) {
        candidateQuestions = candidateQuestions.filter(q => !EV_INCOMPATIBLE_IDS.has(q.id))
      }

      // ── 세부 증상 힌트 (drive 카테고리 등에서 Claude에게 방향 제시) ────────
      // → 조향/타이어 증상인데 가속·변속 질문을 선택하는 문제 방지
      const SUB_SYMPTOM_HINTS: Array<{ keywords: string[]; hint: string }> = [
        {
          keywords: ['조향', '타이어', '미끌림', '슬립', '그립', '미끄러', '핸들'],
          hint: '조향·타이어·트랙션 관련 증상 → D04(쏠림 방향/조건), D08(타이어 작업 이력) 우선. D02·D03·D06·D07은 이 증상과 무관하므로 제외.',
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
      const subSymptomHint = SUB_SYMPTOM_HINTS.find(e =>
        e.keywords.some(kw => symptomLower.includes(kw))
      )?.hint

      // 카테고리는 감지됐지만 해당 카테고리 질문이 모두 소진 → 바로 최종 진단
      const categoryExhausted = localCategory !== null
        && candidateQuestions.length === 0
        && answeredIds.size > 0

      if (!categoryExhausted) {
        const check = await checkInformationSufficiency(
          symptomText, vehicleInfo, existingAnswers,
          candidateQuestions,
          localCategory?.id,
          isEV,
          subSymptomHint
        )

        if (!check.sufficient && check.suggestedQuestionIds.length > 0) {
          // 아직 안 물은 질문만 필터링
          const newQuestions = check.suggestedQuestionIds
            .filter(id => !answeredIds.has(id))
            .map(id => findQuestionById(id))
            .filter(Boolean)
            .slice(0, 3)

          if (newQuestions.length > 0) {
            return NextResponse.json({
              success: true,
              data: {
                needsMoreInfo: true,
                detectedCategory: check.detectedCategory,
                additionalQuestions: newQuestions,
              }
            })
          }
        }
      }
    }

    // 2단계: 최종 진단 실행
    const result = await requestDiagnosis(messages, vehicleInfo, symptomImages, isReDiagnosis)

    // 3단계: 결과 저장
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
