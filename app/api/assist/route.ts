import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
const MODEL = 'claude-haiku-4-5-20251001'

// ─── 질문 설명 ─────────────────────────────────────────────────────────
async function explainQuestion(question: string): Promise<string> {
  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 300,
    system: `당신은 자동차 진단 서비스의 친절한 안내 AI입니다.
사용자가 진단 질문의 의미를 물어보면, 자동차 비전문가도 이해할 수 있도록 쉽고 간결하게 설명해 주세요.
- 2~3문장 이내로 간결하게
- 전문 용어는 쉬운 말로 풀어서
- 예시를 하나 들어주면 좋음
- 마크다운 없이 평문으로`,
    messages: [
      {
        role: 'user',
        content: `진단 질문: "${question}"\n\n이 질문이 무슨 뜻인지 쉽게 설명해 주세요.`,
      },
    ],
  })
  return response.content[0].type === 'text' ? response.content[0].text : ''
}

// ─── 용어 설명 (툴팁용) ────────────────────────────────────────────────
async function explainTerm(term: string, enName?: string): Promise<string> {
  const context = enName ? `한국어: ${term} (영어: ${enName})` : `용어: ${term}`
  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 120,
    system: `당신은 자동차 정비 용어를 초보자에게 쉽게 설명하는 AI입니다.
- 1~2문장으로 아주 짧게
- 일상적인 비유를 사용해서
- "~예요" 체로
- 마크다운 없이 평문으로`,
    messages: [{ role: 'user', content: `${context}\n이 자동차 부품/용어를 자동차를 잘 모르는 사람에게 한 줄로 쉽게 설명해줘.` }],
  })
  return response.content[0].type === 'text' ? response.content[0].text : ''
}

// ─── 결과 화면 채팅 ────────────────────────────────────────────────────
async function answerResultChat(
  userMessage: string,
  diagnosisContext: string,
  chatHistory: Array<{ role: 'user' | 'assistant'; content: string }>
): Promise<string> {
  const messages = [
    ...chatHistory.map(m => ({ role: m.role, content: m.content })),
    { role: 'user' as const, content: userMessage },
  ]

  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 400,
    system: `당신은 자동차 진단 결과를 쉽게 설명해 주는 AI 어시스턴트입니다.
아래 진단 결과를 바탕으로 사용자의 질문에 친절하고 명확하게 답해 주세요.

${diagnosisContext}

답변 원칙:
- 전문 용어는 반드시 쉬운 말로 풀어서 설명
- 3~4문장 이내로 간결하게
- 불필요한 단정이나 과장 없이 솔직하게
- 마크다운 없이 평문으로`,
    messages,
  })
  return response.content[0].type === 'text' ? response.content[0].text : ''
}

// ─── 라우트 핸들러 ─────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()

    if (body.type === 'question_explain') {
      const { question } = body
      if (!question) return NextResponse.json({ error: '질문이 없습니다.' }, { status: 400 })

      const answer = await explainQuestion(question)
      return NextResponse.json({ answer })
    }

    if (body.type === 'term_explain') {
      const { term, enName } = body
      if (!term) return NextResponse.json({ error: '용어가 없습니다.' }, { status: 400 })
      const answer = await explainTerm(term, enName)
      return NextResponse.json({ answer })
    }

    if (body.type === 'result_chat') {
      const { userMessage, diagnosisContext, chatHistory = [] } = body
      if (!userMessage) return NextResponse.json({ error: '메시지가 없습니다.' }, { status: 400 })

      const answer = await answerResultChat(userMessage, diagnosisContext || '', chatHistory)
      return NextResponse.json({ answer })
    }

    return NextResponse.json({ error: '알 수 없는 요청 타입입니다.' }, { status: 400 })
  } catch (err) {
    console.error('[assist]', err)
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 })
  }
}
