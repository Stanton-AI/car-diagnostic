import Anthropic from '@anthropic-ai/sdk'
import type { ChatMessage, DiagnosisResult, Vehicle, DiagnosticQuestion } from '@/types'
import { CATEGORY_PROMPT_SECTION } from '@/lib/categoryTaxonomy'

const getClient = () => new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

// ─── 시스템 프롬프트 ──────────────────────────────────────────────────
const SYSTEM_PROMPT = `당신은 '정비톡 AI'입니다. 15년 경력의 자동차 정비사 출신 AI예요. 동네 단골 정비사가 친한 친구에게 차 상태를 설명해 주듯, 따뜻하고 편안한 말투로 이야기합니다. 차를 전혀 모르는 분도 "아, 그렇구나!" 하고 이해할 수 있도록 비유와 쉬운 표현을 씁니다. 전문 판단은 절대 타협하지 않지만, 겁주는 말은 하지 않습니다.

## 말투 원칙 (반드시 지킬 것)
- **~합니다/~입니다** 체 금지 → **~요/~거든요/~어요** 체 사용
- 전문 용어 뒤에는 반드시 쉬운 비유나 풀어쓰기 추가
  예) "산소센서(배기가스 냄새를 맡는 코 역할이에요)"
- 걱정되는 내용은 먼저 안심시키고 설명
  예) "당장 위험한 건 아니에요. 다만 ~"
- 권고 문장은 친구처럼 자연스럽게
  예) "2~3주 안에 한번 봐주세요" (O) / "2-3주 내 점검 필요합니다" (X)
- 숫자·통계보다 상황 묘사로 설명
  예) "기름이 조금씩 더 타고 있는 상태예요" (O) / "연비 악화 가능성" (X)

## 응답 원칙
1. 항상 한국어로 응답합니다
2. 확률 데이터는 일반적인 정비 통계 기반으로 현실적으로 제시합니다 (합계가 반드시 100%일 필요 없음)
3. 비용은 일반적인 정비 시장 평균 수준으로 산정합니다. 차종·지역·정비소에 따라 실제 비용은 달라질 수 있습니다.
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
  symptomImages?: Array<{data: string; mediaType: string}>,
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

  const imgCtx = (symptomImages && symptomImages.length > 0)
    ? '\n\n**[중요] 첨부 이미지 분석**: 위 이미지를 먼저 분석하여 경고등 종류, 손상 부위, 오일/냉각수 상태 등을 직접 파악하세요. 이미지에서 확인된 정보를 진단의 핵심 근거로 사용하세요.'
    : ''

  const userPrompt = `${vehicleCtx}${knownIssuesCtx}${imgCtx}

**대화 내역**:
${conversationCtx}${reDiagCtx}

${CATEGORY_PROMPT_SECTION}
위 정보를 바탕으로 차량 진단 결과를 다음 JSON 형식으로만 반환하세요 (마크다운 없이):

{
  "category": "대분류 > 중분류 (위 목록 중 하나)",
  "summary": "주요 증상 1줄 요약",
  "causes": [
    {
      "name": "원인명(한국어)",
      "enName": "Cause Name in English",
      "probability": 75,
      "description": "정비톡 AI 말투로: 이 부품이 하는 역할을 쉬운 비유로 먼저 설명하고, 지금 어떤 상태인지, 차주가 체감할 수 있는 변화가 있는지 친구처럼 이야기해 주세요. ~요/~거든요 체 사용. 확률 숫자나 % 절대 포함 금지. 2~3문장."
    }
  ],
  "cost": {
    "parts": 58000,
    "labor": 155000,
    "total": 213000,
    "note": ""
  },
  "urgency": "MID",
  "urgencyReason": "정비톡 AI 말투로: 먼저 안심 또는 경각심을 한 줄로 전달하고, 왜 그 타이밍에 점검해야 하는지 친근하게 설명해 주세요. ~요 체 사용. 1~2문장. 예) '당장 세우실 필요는 없어요. 다만 2~3주 안에는 꼭 한번 봐주세요 — 이대로 두면 기름이 조금씩 더 타거든요.'",
  "selfCheck": [
    {
      "id": "sc1",
      "tip": "정비톡 AI 말투로: 집에서 직접 할 수 있는 확인 방법을 친구가 알려주듯 2~3단계로 설명. ~요 체 사용."
    }
  ],
  "shopTip": "정비톡 AI 말투로: '정비소 가시면 이렇게 말씀해 보세요 —' 로 시작해서 차주가 그대로 전달할 수 있는 자연스러운 말로 작성. ~요 체 사용.",
  "disclaimer": "본 진단은 AI가 증상 정보를 바탕으로 예측한 결과예요. 실제 정비사의 직접 점검이 최종 판단이며, 비용은 지역·차종·정비소에 따라 달라질 수 있어요."
}`

  // 이미지가 있으면 멀티모달 — 브라우저에서 변환된 base64 직접 사용
  type ContentBlock = { type: 'text'; text: string } | { type: 'image'; source: { type: 'base64'; media_type: string; data: string } }
  const content: ContentBlock[] = []

  if (symptomImages && symptomImages.length > 0) {
    for (const img of symptomImages.slice(0, 3)) {
      content.push({ type: 'image', source: { type: 'base64', media_type: img.mediaType, data: img.data } })
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
  imageDescription?: string        // 이미지 첨부 첫 Q&A 시: 이미지 분석 설명
  question?: AIGeneratedQuestion   // sufficient=false일 때만 존재
}

export async function checkAndGenerateQuestion(
  symptomText: string,
  vehicleInfo?: Partial<Vehicle>,
  existingQAs?: Array<{ question: string; answer: string }>,
  questionCount = 0,
  symptomImages?: Array<{data: string; mediaType: string}>,
): Promise<AIQuestionCheckResponse> {
  const vehicleCtx = vehicleInfo
    ? `차량: ${vehicleInfo.maker ?? ''} ${vehicleInfo.model ?? ''} ${vehicleInfo.year ?? ''}년식, ${vehicleInfo.mileage?.toLocaleString() ?? '?'}km, 연료: ${vehicleInfo.fuelType ?? '미상'}`
    : '차량 정보 없음'

  const qaCtx = existingQAs && existingQAs.length > 0
    ? `\n\n기존 질문/답변:\n${existingQAs.map((qa, i) => `Q${i + 1}: ${qa.question}\nA${i + 1}: ${qa.answer}`).join('\n')}`
    : ''

  // 이미지 첨부 여부 및 첫 번째 Q&A 여부
  const hasImage = (symptomImages?.length ?? 0) > 0
  const isFirstQAWithImage = hasImage && questionCount === 0

  // 이미지만 첨부된 경우 symptomText placeholder 처리
  const effectiveSymptomText = (symptomText === '이미지를 첨부했습니다.' || !symptomText)
    ? '[이미지 첨부됨 — 아래 이미지에서 증상 직접 파악]'
    : symptomText

  // 이미지 첨부 첫 Q&A 전용 지시
  const imageFirstQANote = isFirstQAWithImage ? `
[⚠️ 이미지 첨부 + 첫 번째 질문 — 반드시 읽을 것]
1) imageDescription 필드: 이미지에서 파악한 내용을 정비톡 AI 말투(~요 체)로 1문장 작성.
   예) "타이어 저압 경고등이 켜져 있네요 🔵"
   - 틀릴 수 있으니 단정하지 말고 "~처럼 보이네요" 같은 표현 사용 가능
   - 경고등 이름·색깔·위치 등 이미지에서 보이는 것만 서술
2) question: 이미지에서 파악한 내용을 제외하고, 진단에 필요한 컨텍스트 1가지 질문
   (언제부터인지 / 이미 어떤 조치를 했는지 / 증상 패턴 등)
3) choices: 질문에 맞는 선택지 3~4개 + 반드시 마지막에 "기타 (직접 입력)" 추가
4) sufficient 판단 기준: confidence >= 90 이어야만 sufficient: true 허용
   (이미지 봤어도 컨텍스트 없으면 90% 넘기 어려움 → 거의 항상 질문 생성)

JSON 형식 (imageDescription 필드 포함):
{
  "sufficient": false,
  "confidence": 40,
  "imageDescription": "타이어 저압 경고등이 켜져 있는 것처럼 보이네요 🔵",
  "question": {
    "id": "ai_q_XXX",
    "question": "이 경고등이 켜진 지 얼마나 됐나요?",
    "choices": ["방금 켜졌어요", "며칠 됐어요", "몇 주 이상 됐어요", "기타 (직접 입력)"]
  }
}` : ''

  const prompt = `당신은 자동차 정비 전문가입니다. 실제 정비사처럼 계통별 가설 검증 방식으로 진단합니다.

${vehicleCtx}
증상: "${effectiveSymptomText}"${qaCtx}
${imageFirstQANote}
[이미지가 첨부된 경우 — 최우선 처리]
- 첨부된 이미지를 먼저 분석하여 경고등 종류, 손상 부위, 오염 상태 등을 직접 파악하세요.
- 이미지에서 경고등이 확인된 경우: "어떤 경고등인지" 다시 묻지 말고, 해당 경고등에 맞는 다음 단계 질문으로 바로 진행하세요.
- 이미지로 이미 파악된 정보는 이미 알고 있는 것으로 처리하고 재질문 금지.

[진단 사고 순서 — 반드시 이 순서로 생각하세요]
1. 증상이 소음·진동·이음 계통인지 먼저 판단
   - 소음/진동/이음이면 → 2번으로
   - 그 외(경고등/냄새/성능저하 등)이면 → 3번으로
2. 소음·진동·이음 계통: 발생 조건을 먼저 파악 (계통 질문보다 우선)
   - [언제] 저속/고속/방지턱/과속방지턱/요철/선회/브레이크/가속/공회전
   - [어디서] 주차장/고속도로/특정 노면
   - [환경] 추울 때/비 온 후/항상
   - 발생 조건이 파악되면 → 계통과 원인이 동시에 좁혀짐 (허브베어링 vs 등속조인트 vs 쇼크업소버 등)
3. 발생 조건이 이미 파악됐거나 비소음 계통: 계통 → 하위계통 → 특정 원인 순으로 좁히는 질문
4. 기존 Q&A가 있다면 → 이미 좁혀진 방향을 파악하고 다음 단계 질문 생성
5. 충분히 좁혀졌다면 (이미지 첫 Q&A 전: confidence >= 90, 그 외: confidence >= 75) → sufficient: true

[질문 원칙]
- 각 질문은 "어떤 가설을 검증하는가"가 명확해야 함
- 이미 알고 있는 정보 재질문 금지: 제조사·모델·연식·주행거리·연료타입, 기존 Q&A 답변 내용
- 차주가 전문 지식 없이도 직접 확인할 수 있는 것만 질문
- 선택지 3~4개, 쉬운 용어로

[sufficient 판단]
- 원인이 특정 계통의 특정 부품/현상으로 충분히 좁혀졌다 → sufficient: true
- 아직 계통조차 불확실하거나, 같은 계통 내 전혀 다른 원인이 여럿 가능하다 → sufficient: false
- 물어볼 의미 있는 새 정보가 없다면 sufficient: true

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

  // 이미지가 있으면 멀티모달 — 브라우저에서 변환된 base64 직접 사용
  type QBlock = { type: 'text'; text: string } | { type: 'image'; source: { type: 'base64'; media_type: string; data: string } }
  const qContent: QBlock[] = []
  if (symptomImages && symptomImages.length > 0) {
    for (const img of symptomImages.slice(0, 3)) {
      qContent.push({ type: 'image', source: { type: 'base64', media_type: img.mediaType, data: img.data } })
    }
  }
  qContent.push({ type: 'text', text: prompt })

  // 이미지 있으면 vision 모델, 없으면 저렴한 Haiku로 비용 최적화
  const qModel = (symptomImages && symptomImages.length > 0)
    ? 'claude-sonnet-4-20250514'
    : 'claude-haiku-4-5-20251001'

  const response = await getClient().messages.create({
    model: qModel,
    max_tokens: 500,  // imageDescription 필드 추가로 여유 확보
    messages: [{ role: 'user', content: qContent as any }],
  })

  const text = response.content[0].type === 'text' ? response.content[0].text : '{}'
  try {
    const clean = text.replace(/```json|```/g, '').trim()
    const parsed = JSON.parse(clean)
    // 이미지 첫 Q&A: "기타 (직접 입력)" 없으면 자동 추가
    if (isFirstQAWithImage && parsed.question?.choices && !parsed.question.choices.includes('기타 (직접 입력)')) {
      parsed.question.choices.push('기타 (직접 입력)')
    }
    return parsed
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
