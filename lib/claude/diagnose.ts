import Anthropic from '@anthropic-ai/sdk'
import type { ChatMessage, DiagnosisResult, Vehicle, DiagnosticQuestion } from '@/types'

const getClient = () => new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

// ─── 시스템 프롬프트 ──────────────────────────────────────────────────
const SYSTEM_PROMPT = `당신은 한국의 자동차 중정비 전문 AI 진단 어드바이저입니다. 
15년 이상의 정비 경험을 가진 전문가처럼 응답하되, 일반 차량 오너가 이해하기 쉬운 언어를 사용합니다.

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
  detectedCategory: string
  suggestedQuestionIds: string[]  // 추가로 물어야 할 질문 ID 목록 (최대 5개)
  reasoning: string
}

export async function checkInformationSufficiency(
  symptomText: string,
  vehicleInfo?: Partial<Vehicle>,
  existingAnswers?: Record<string, string>
): Promise<InformationCheckResponse> {
  const vehicleCtx = vehicleInfo
    ? `차량: ${vehicleInfo.maker ?? ''} ${vehicleInfo.model ?? ''} ${vehicleInfo.year ?? ''}년식, ${vehicleInfo.mileage?.toLocaleString() ?? '?'}km, ${vehicleInfo.fuelType ?? ''}`
    : '차량 정보 없음'

  const answersCtx = existingAnswers && Object.keys(existingAnswers).length > 0
    ? `\n기존 답변:\n${Object.entries(existingAnswers).map(([q, a]) => `- ${q}: ${a}`).join('\n')}`
    : ''

  const prompt = `${vehicleCtx}

증상: "${symptomText}"${answersCtx}

위 증상을 진단하기 위해 추가 정보가 필요한지 판단하세요.

다음 카테고리 중 가장 관련있는 것을 선택하세요:
sound(소리), vibration(진동), warning(경고등), smell(냄새), start(시동), drive(주행성능), leak(누유누수), electric(전기전자), exterior(외관기타)

추가 질문이 필요하다면 다음 질문 ID 목록에서 가장 유용한 것을 최대 3개 선택하세요:
소리: S01,S02,S03,S04,S05,S06,S07,S08,S09,S10
진동: V01,V02,V03,V04,V05,V06,V07,V08,V09
경고등: W01,W02,W03,W04,W05,W06,W07,W08,W09
냄새: SM01,SM02,SM03,SM04,SM05,SM06,SM07,SM08
시동: ST01,ST02,ST03,ST04,ST05,ST06,ST07,ST08,ST09
주행: D01,D02,D03,D04,D05,D06,D07,D08
누유: L01,L02,L03,L04,L05,L06,L07,L08
전기: E01,E02,E03,E04,E05,E06,E07,E08
외관: O01,O02,O03,O04,O05,O06

JSON만 반환하세요 (설명 없이):
{
  "sufficient": false,
  "detectedCategory": "sound",
  "suggestedQuestionIds": ["S01", "S02"],
  "reasoning": "소리 위치와 성격을 알아야 원인을 좁힐 수 있습니다"
}`

  const response = await getClient().messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 300,
    messages: [{ role: 'user', content: prompt }],
  })

  const text = response.content[0].type === 'text' ? response.content[0].text : '{}'
  try {
    const clean = text.replace(/```json|```/g, '').trim()
    return JSON.parse(clean)
  } catch {
    return { sufficient: true, detectedCategory: 'other', suggestedQuestionIds: [], reasoning: '' }
  }
}

// ─── 최종 진단 요청 ──────────────────────────────────────────────────
export async function requestDiagnosis(
  messages: ChatMessage[],
  vehicleInfo?: Partial<Vehicle>,
  symptomImages?: string[],
  isReDiagnosis = false
): Promise<DiagnosisResult> {
  const vehicleCtx = vehicleInfo
    ? `**차량 정보**: ${vehicleInfo.maker ?? '불명'} ${vehicleInfo.model ?? ''} ${vehicleInfo.year ?? ''}년식, 주행거리 ${vehicleInfo.mileage?.toLocaleString() ?? '미상'}km, 연료: ${vehicleInfo.fuelType ?? '미상'}`
    : '**차량 정보**: 미등록'

  // 대화 내역 요약
  const conversationCtx = messages
    .filter(m => m.type !== 'result' && m.type !== 'system')
    .map(m => {
      if (m.role === 'user') return `[사용자] ${m.content}`
      if (m.type === 'question') return `[AI 질문] ${m.content}`
      if (m.type === 'answer') return `[사용자 답변] ${m.content}`
      return `[AI] ${m.content}`
    })
    .join('\n')

  const reDiagCtx = isReDiagnosis ? '\n\n**재진단**: 자가점검 결과를 반영하여 진단을 업데이트하세요.' : ''

  const userPrompt = `${vehicleCtx}

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
      "description": "이러한 증상을 보이는 75%의 차량에서 이 부품 문제가 원인이었습니다. 구체적 설명."
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
    messages: [{ role: 'user', content }],
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

// ─── 긴급도 한국어 변환 ───────────────────────────────────────────────
export function urgencyLabel(urgency: string) {
  const map: Record<string, { label: string; color: string; bg: string }> = {
    HIGH: { label: '즉시 점검 필요', color: 'text-red-600', bg: 'bg-red-50 border-red-200' },
    MID:  { label: '조기 점검 권장', color: 'text-amber-600', bg: 'bg-amber-50 border-amber-200' },
    LOW:  { label: '여유 있게 점검', color: 'text-green-600', bg: 'bg-green-50 border-green-200' },
  }
  return map[urgency] ?? map.MID
}
