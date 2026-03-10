import OpenAI from 'openai'
import type { SupabaseClient } from '@supabase/supabase-js'

const getOpenAI = () => new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

export async function generateEmbedding(text: string): Promise<number[]> {
  const response = await getOpenAI().embeddings.create({
    model: 'text-embedding-3-small',
    input: text,
  })
  return response.data[0].embedding
}

export interface SimilarCase {
  id: string
  initial_symptom: string
  final_result: {
    causes: Array<{ name: string; enName?: string; probability: number }>
    urgency: string
  }
  actual_repair: {
    repair_name: string
    actual_cost?: number
    ai_correct?: boolean
  }
  similarity: number
}

export async function findSimilarCases(
  supabase: SupabaseClient,
  symptomText: string,
  limit = 3,
): Promise<SimilarCase[]> {
  try {
    const embedding = await generateEmbedding(symptomText)

    const { data, error } = await supabase.rpc('match_conversations', {
      query_embedding: embedding,
      match_count: limit,
    })

    if (error || !data) return []
    return data as SimilarCase[]
  } catch {
    return []
  }
}

export function formatSimilarCasesContext(cases: SimilarCase[]): string {
  if (cases.length === 0) return ''

  const formatted = cases
    .filter(c => c.similarity > 0.75)  // 유사도 75% 이상만 사용
    .map(c => {
      const aiDiagnosis = c.final_result?.causes?.[0]?.name ?? '미상'
      const actualRepair = c.actual_repair?.repair_name ?? '미상'
      const correct = c.actual_repair?.ai_correct

      return `- 증상: "${c.initial_symptom}"
  AI 진단: ${aiDiagnosis}
  실제 수리: ${actualRepair}${correct === false ? ' ⚠️ (AI 오진)' : correct === true ? ' ✅ (AI 정확)' : ''}`
    })

  if (formatted.length === 0) return ''

  return `\n\n**유사 과거 사례 (참고용)**:\n${formatted.join('\n')}`
}
