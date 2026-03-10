import Anthropic from '@anthropic-ai/sdk'
import type { ChatMessage, DiagnosisResult, Vehicle, DiagnosticQuestion } from '@/types'

const getClient = () => new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

// ─── 시스템 프롬프트 ──────────────────────────────────────────────────
const SYSTEM_PROMPT = `당신은 'MIKY(미키)'입니다. 15년 경력의 자동차 정비사 출신 AI로, 따뜻하고 신뢰감 있는 말투로 차주에게 솔직하게 차 상태를 설명해 드립니다. 차를 잘 모르는 분도 쉽게 이해할 수 있도록 설명하되, 전문적인 판단은 절대 타협하지 않습니다.

## 응답 원칙
1. 항상 한국어로 응답합니다
2. 확률 데이터는 일반적인 정비 통계 기반으로 현실적으로 제시합니다 (합계가 반드시 100%일 필요 없음)
3. 비용은 한국 수도권 독립 정비소 기준 (부품비 + 공임비 포함)
4. 긴급도가 HIGH인 경우 즉시 운행 중단을 권고합니다
5. 자가점검 팁은 실제로 집에서 쉽게 할 수 있는 것만 제시합니다

## 면책 조항
진단 결과는 증상 기반 AI 예측이며, 실제 정비사의 직접 점검이 최종 판단입니다.`

// ─── 1차 분석: 정보 충분 여부 판단 + 추가 질문 선택 ─────────────────
interface InformationCheckResponse {
  sufficient: boolean
  confidence: number            // 0~100: 지금 진단 시 최고 원인 예상 확률
  detectedCategory: string
  suggestedQuestionIds: string[]  // 추가로 물어야 할 질문 ID 목록
  reasoning: string
}

export async function checkInformationSufficiency(
  symptomText: string,
  vehicleInfo?: Partial<Vehicle>,
  existingAnswers?: Record<string, string>,
  candidateQuestions?: DiagnosticQuestion[],  // 카테고리 필터링된 후보 질문
  categoryHint?: string,                       // 감지된 카테고리 ID
  fuelType?: string,                           // 차량 연료타입 (gasoline/diesel/hybrid/electric/lpg)
  subSymptomHint?: string                      // 세부 증상 분류 힌트 (예: 조향 vs 변속)
): Promise<InformationCheckResponse> {
  const vehicleCtx = vehicleInfo
    ? `차량: ${vehicleInfo.maker ?? ''} ${vehicleInfo.model ?? ''} ${vehicleInfo.year ?? ''}년식, ${vehicleInfo.mileage?.toLocaleString() ?? '?'}km, ${vehicleInfo.fuelType ?? fuelType ?? ''}`
    : '차량 정보 없음'

  const answersCtx = existingAnswers && Object.keys(existingAnswers).length > 0
    ? `\n기존 답변:\n${Object.entries(existingAnswers).map(([q, a]) => `- ${q}: ${a}`).join('\n')}`
    : ''

  // 연료타입별 주의사항 (Claude에게 컨텍스트 제공)
  const fuelNote = fuelType === 'electric'
    ? '\n\n⚠️ 전기차(EV): 연료필터·엔진오일·변속기오일·점화플러그·크랭킹·겉벨트 등 내연기관 전용 항목은 해당 없습니다. 관련 질문은 절대 선택하지 마세요.'
    : fuelType === 'diesel'
    ? '\n\n🔧 디젤 차량: DPF·요소수·글로우플러그·EGR 등 디젤 특유 부품을 고려하세요.'
    : fuelType === 'hybrid'
    ? '\n\n🔋 하이브리드: 전기모터·고전압배터리·회생제동 관련 증상 가능성을 함께 고려하세요.'
    : fuelType === 'lpg'
    ? '\n\n⛽ LPG 차량: 베이퍼라이저·솔레노이드밸브·가스계통 특유 증상을 고려하세요.'
    : ''

  // 세부 증상 분류 힌트 (drive 카테고리 내 세부 방향 지시)
  const subHint = subSymptomHint
    ? `\n\n🎯 세부 증상 분류: ${subSymptomHint}`
    : ''

  let prompt: string

  if (candidateQuestions && candidateQuestions.length > 0) {
    // ── 카테고리 잠금 모드: 해당 카테고리·연료타입 필터링된 질문만 제공 ──
    const questionList = candidateQuestions
      .map(q => `- ${q.id}: "${q.question}"\n  선택지: ${q.choices.slice(0, 5).join(' / ')}`)
      .join('\n')

    prompt = `${vehicleCtx}

증상: "${symptomText}"${answersCtx}${fuelNote}${subHint}

당신은 자동차 정비 전문가입니다. 위 증상과 수집된 정보를 바탕으로 판단하세요.

[판단 기준]
- 지금 바로 진단한다면 가장 유력한 원인의 예상 확률(confidence)을 0~100으로 추정하세요.
- confidence >= 65: 진단하기 충분 → sufficient: true, suggestedQuestionIds: []
- confidence < 65: 아래 후보 질문 중 원인 특정에 가장 중요한 것 1개만 선택하세요.
(자동차 메커닉 및 전기전자 관점에서 증상 원인 특정에 직접적으로 유용한 질문 우선)

후보 질문:
${questionList}

JSON만 반환하세요 (설명 없이):
{
  "sufficient": false,
  "confidence": 40,
  "detectedCategory": "${categoryHint ?? 'unknown'}",
  "suggestedQuestionIds": ["ID1"],
  "reasoning": "이 질문이 필요한 이유"
}`
  } else {
    // ── 폴백: 후보 질문이 없으면 현재 정보로 진단 진행 ──────────────────
    // (카테고리 미감지 시 META01이 먼저 처리되므로 이 분기는 드물게 도달)
    prompt = `${vehicleCtx}

증상: "${symptomText}"${answersCtx}${fuelNote}

현재 수집된 정보만으로 진단을 진행합니다.

JSON만 반환하세요 (설명 없이):
{
  "sufficient": true,
  "confidence": 70,
  "detectedCategory": "${categoryHint ?? 'other'}",
  "suggestedQuestionIds": [],
  "reasoning": "현재 정보로 진단 가능"
}`
  }

  const response = await getClient().messages.create({
    model: 'claude-haiku-4-5-20251001',  // 질문 선택은 Haiku로 충분 (비용 ~10x 절감)
    max_tokens: 400,
    messages: [{ role: 'user', content: prompt }],
  })

  const text = response.content[0].type === 'text' ? response.content[0].text : '{}'
  try {
    const clean = text.replace(/```json|```/g, '').trim()
    return JSON.parse(clean)
  } catch {
    return { sufficient: true, confidence: 70, detectedCategory: categoryHint ?? 'other', suggestedQuestionIds: [], reasoning: '' }
  }
}

// ─── 최종 진단 요청 ──────────────────────────────────────────────────
export async function requestDiagnosis(
  messages: ChatMessage[],
  vehicleInfo?: Partial<Vehicle>,
  symptomImages?: string[],
  isReDiagnosis = false,
  knownIssuesCtx = ''   // 고질병 DB 매칭 컨텍스트 (선택)
): Promise<DiagnosisResult> {
  const vehicleCtx = vehicleInfo
    ? `**차량 정보**: ${vehicleInfo.maker ?? '불명'} ${vehicleInfo.model ?? ''} ${vehicleInfo.year ?? ''}년식, 주행거리 ${vehicleInfo.mileage?.toLocaleString() ?? '미상'}km, 연료: ${vehicleInfo.fuelType ?? '미상'}`
    : '**차량 정보**: 미등록'

  // 대화 내역 요약
  const conversationCtx = messages
    .filter(m => m.type !== 'result' && (m.type as string) !== 'system')
    .map(m => {
      if (m.role === 'user') return `[사용자] ${m.content}`
      if (m.type === 'question') return `[AI 질문] ${m.content}`
      if (m.type === 'answer') return `[사용자 답변] ${m.content}`
      return `[AI] ${m.content}`
    })
    .join('\n')

  const reDiagCtx = isReDiagnosis ? '\n\n**재진단**: 자가점검 결과를 반영하여 진단을 업데이트하세요.' : ''

  const userPrompt = `${vehicleCtx}${knownIssuesCtx}

**대화 내역**:
${conversationCtx}${reDiagCtx}

위 정보를 바탕으로 차량 진단 결과를 다음 JSON 형식으로만 반환하세요 (마크다운 없이):

{
  "category": "카테고리명(한국어)",
  "summary": "주요 증상 1줄 요약",
  "causes": [
    {
      "name": "원인명(한국어)",
      "enName": "Cause Name in English",
      "probability": 75,
      "description": "이 증상에서 가장 흔히 발견되는 원인입니다. 구체적 설명. (설명에 확률 숫자나 %를 절대 포함하지 마세요)"
    }
  ],
  "cost": {
    "parts": 58000,
    "labor": 155000,
    "total": 213000,
    "note": "순정 부품 기준. 사제 부품 사용 시 30~40% 절감 가능"
  },
  "urgency": "MID",
  "urgencyReason": "즉각적인 위험은 없으나 2주 내 점검을 권장합니다.",
  "selfCheck": [
    {
      "id": "sc1",
      "tip": "집에서 직접 확인할 수 있는 구체적인 자가점검 방법 (2~3단계로 설명)"
    }
  ],
  "shopTip": "정비소에서 이렇게 설명하세요: 구체적인 전달 사항",
  "disclaimer": "본 진단은 AI가 증상 정보를 바탕으로 예측한 결과입니다. 실제 정비사의 직접 점검이 최종 판단이며, 비용은 지역/차종/정비소에 따라 달라질 수 있습니다."
}`

  // 이미지가 있으면 멀티모달로
  type ContentBlock = { type: 'text'; text: string } | { type: 'image'; source: { type: 'url'; url: string } }
  const content: ContentBlock[] = []

  if (symptomImages && symptomImages.length > 0) {
    for (const imgUrl of symptomImages.slice(0, 3)) {
      content.push({ type: 'image', source: { type: 'url', url: imgUrl } })
    }
  }
  content.push({ type: 'text', text: userPrompt })

  const response = await getClient().messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 1500,
    system: SYSTEM_PROMPT,
    messages: [{ role: 'user', content: content as any }],
  })

  const text = response.content[0].type === 'text' ? response.content[0].text : '{}'
  const clean = text.replace(/```json|```/g, '').trim()
  const parsed = JSON.parse(clean)

  // selfCheck에 checked/result 필드 추가
  if (parsed.selfCheck) {
    parsed.selfCheck = parsed.selfCheck.map((item: { id: string; tip: string }) => ({
      ...item,
      checked: false,
      result: undefined,
    }))
  }

  return parsed as DiagnosisResult
}

// ─── V2: AI가 질문 직접 생성 ─────────────────────────────────────────
export interface AIGeneratedQuestion {
  id: string               // 고유 ID (타임스탬프 기반)
  question: string         // 질문 텍스트
  choices: string[]        // 선택지 (3~4개)
}

export interface AIQuestionCheckResponse {
  sufficient: boolean
  confidence: number
  question?: AIGeneratedQuestion   // sufficient=false일 때만 존재
}

export async function checkAndGenerateQuestion(
  symptomText: string,
  vehicleInfo?: Partial<Vehicle>,
  existingQAs?: Array<{ question: string; answer: string }>,
  questionCount = 0,
): Promise<AIQuestionCheckResponse> {
  const vehicleCtx = vehicleInfo
    ? `차량: ${vehicleInfo.maker ?? ''} ${vehicleInfo.model ?? ''} ${vehicleInfo.year ?? ''}년식, ${vehicleInfo.mileage?.toLocaleString() ?? '?'}km, 연료: ${vehicleInfo.fuelType ?? '미상'}`
    : '차량 정보 없음'

  const qaCtx = existingQAs && existingQAs.length > 0
    ? `\n\n기존 질문/답변:\n${existingQAs.map((qa, i) => `Q${i + 1}: ${qa.question}\nA${i + 1}: ${qa.answer}`).join('\n')}`
    : ''

  const prompt = `당신은 자동차 정비 전문가입니다.

${vehicleCtx}
증상: "${symptomText}"${qaCtx}

[판단 기준]
- 지금까지 수집된 정보로 진단 가능한 confidence(0~100)를 추정하세요.
- confidence >= 65이거나 질문을 이미 ${questionCount}회 했으면: sufficient: true
- 그렇지 않으면: 원인 특정에 가장 중요한 질문 1개를 직접 생성하세요.

[질문 생성 규칙]
- 차량 연료타입에 맞는 질문만 생성 (전기차에 엔진오일 질문 금지)
- 이미 답변된 내용과 중복 금지
- 선택지는 실제 차주가 직접 확인할 수 있는 것으로 3~4개
- 질문은 쉽고 구체적으로 (전문 용어 최소화)

JSON만 반환하세요 (설명 없이):
{
  "sufficient": false,
  "confidence": 45,
  "question": {
    "id": "ai_q_${Date.now()}",
    "question": "소리가 언제 주로 납니까?",
    "choices": ["저속 주행 시", "고속 주행 시", "브레이크 밟을 때", "항상"]
  }
}`

  const response = await getClient().messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 400,
    messages: [{ role: 'user', content: prompt }],
  })

  const text = response.content[0].type === 'text' ? response.content[0].text : '{}'
  try {
    const clean = text.replace(/```json|```/g, '').trim()
    return JSON.parse(clean)
  } catch {
    return { sufficient: true, confidence: 70 }
  }
}

// ─── 긴급도 한국어 변환 ───────────────────────────────────────────────
export function urgencyLabel(urgency: string) {
  const map: Record<string, { label: string; color: string; bg: string }> = {
    HIGH: { label: '즉시 점검 필요', color: 'text-red-600', bg: 'bg-red-50 border-red-200' },
    MID:  { label: '조기 점검 권장', color: 'text-amber-600', bg: 'bg-amber-50 border-amber-200' },
    LOW:  { label: '여유 있게 점검', color: 'text-green-600', bg: 'bg-green-50 border-green-200' },
  }
  return map[urgency] ?? map.MID
}
