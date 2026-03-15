import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import Anthropic from '@anthropic-ai/sdk'

const getClient = () => new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { imageUrl } = await req.json()
    if (!imageUrl) return NextResponse.json({ error: 'imageUrl 필요' }, { status: 400 })

    // 파트너 소유 확인
    const { data: job, error: jobErr } = await supabase
      .from('repair_jobs')
      .select('id, partner_shops!inner(user_id)')
      .eq('id', params.id)
      .single()

    if (jobErr || !job) return NextResponse.json({ error: '작업을 찾을 수 없습니다' }, { status: 404 })
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if ((job as any).partner_shops?.user_id !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const prompt = `이 이미지는 한국 자동차 정비소의 정비 명세서(수리 명세서)입니다.
아래 정보를 추출해 JSON으로만 반환하세요 (설명 없이):

{
  "replacedParts": [
    {"name": "부품명", "partNumber": "부품번호(없으면 null)", "qty": 1, "unitCost": 50000, "totalCost": 50000}
  ],
  "actionItems": [
    {"action": "작업명", "description": "설명(없으면 null)", "laborCost": 30000}
  ],
  "partsTotal": 50000,
  "laborTotal": 30000,
  "finalTotal": 80000,
  "rawText": "명세서에서 읽은 주요 텍스트 (줄바꿈 포함)"
}

규칙:
- 금액은 원(KRW) 단위 정수 (콤마/기호 없이)
- 찾을 수 없는 항목은 빈 배열([]) 또는 0으로
- 합계가 명시된 경우 그 값을 finalTotal로 사용
- 부품비와 공임비가 구분된 경우 각각 partsTotal/laborTotal로 분리`

    // URL → base64 변환 (SDK가 url 타입 미지원)
    const imgRes = await fetch(imageUrl)
    const imgBuffer = await imgRes.arrayBuffer()
    const imgBase64 = Buffer.from(imgBuffer).toString('base64')
    const imgMediaType = (imgRes.headers.get('content-type') ?? 'image/jpeg') as 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp'

    const response = await getClient().messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1500,
      messages: [{
        role: 'user',
        content: [
          { type: 'image', source: { type: 'base64', media_type: imgMediaType, data: imgBase64 } },
          { type: 'text', text: prompt },
        ],
      }],
    })

    const text = response.content[0].type === 'text' ? response.content[0].text : '{}'
    const clean = text.replace(/```json|```/g, '').trim()
    const parsed = JSON.parse(clean)

    return NextResponse.json({ ok: true, data: parsed })
  } catch (e: unknown) {
    console.error('[invoice-ocr]', e)
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: 'OCR 처리 실패', detail: msg }, { status: 500 })
  }
}
