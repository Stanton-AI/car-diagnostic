import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requestDiagnosis, checkInformationSufficiency } from '@/lib/claude/diagnose'
import { selectNextQuestions, findQuestionById, getAnsweredQuestionIds } from '@/lib/diagnostic/questions'
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
    const firstUserMessage = messages.find(m => m.role === 'user' && m.type === 'text')
    const symptomText = firstUserMessage?.content ?? ''

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

      const check = await checkInformationSufficiency(symptomText, vehicleInfo, existingAnswers)

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
