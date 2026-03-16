import type { SupabaseClient } from '@supabase/supabase-js'

export interface RepairCostItem {
  id: string
  repair_item: string
  category: string | null
  car_maker: string | null
  car_model: string | null
  parts_min: number
  parts_max: number
  labor_min: number
  labor_max: number
  labor_hours_min: number | null  // 표준공임시간 (카포스/블루핸즈 기준)
  labor_hours_max: number | null
  sample_count: number
}

// 증상 텍스트 → DB 키워드 매핑 (증상에서 관련 수리 항목 추출)
const SYMPTOM_KEYWORD_MAP: Array<{ patterns: string[]; dbKeywords: string[] }> = [
  { patterns: ['브레이크', '제동', '밟으면', '끽', '끼익', '덜컹', '밀림'], dbKeywords: ['브레이크', '패드', '디스크'] },
  { patterns: ['엔진오일', '오일', '연기', '타는냄새'], dbKeywords: ['엔진오일', '오일'] },
  { patterns: ['과열', '오버히트', '온도', '수온', '냉각수'], dbKeywords: ['워터펌프', '써모스탯', '냉각수'] },
  { patterns: ['점화', '시동', '떨림', '부조', '공회전'], dbKeywords: ['점화플러그', '인젝터'] },
  { patterns: ['배터리', '방전', '시동꺼짐', '시동안걸림'], dbKeywords: ['배터리', '알터네이터', '스타터'] },
  { patterns: ['타이어', '공기압', 'TPMS', '펑크', '마모'], dbKeywords: ['타이어', 'TPMS', '얼라인먼트'] },
  { patterns: ['핸들', '조향', '쏠림', '떨림'], dbKeywords: ['얼라인먼트', '볼조인트', '파워스티어링'] },
  { patterns: ['서스펜션', '충격', '덜컹', '소음', '범핑'], dbKeywords: ['쇼크업소버', '스태빌라이저', '볼조인트'] },
  { patterns: ['에어컨', '냉방', '냉매', '시원하지않'], dbKeywords: ['에어컨', '컴프레서', '냉매'] },
  { patterns: ['변속', '기어', '미션', '충격'], dbKeywords: ['ATF', '변속기'] },
  { patterns: ['배기', '매연', '촉매', 'DPF', '요소수'], dbKeywords: ['촉매', 'DPF', 'EGR'] },
  { patterns: ['타이밍', '벨트', '체인'], dbKeywords: ['타이밍벨트', '타이밍체인'] },
]

export async function findRepairCosts(
  supabase: SupabaseClient,
  symptomText: string,
  vehicleInfo?: { maker?: string; model?: string },
): Promise<RepairCostItem[]> {
  try {
    // 증상에서 관련 키워드 추출
    const symptomLower = symptomText.toLowerCase()
    const matchedKeywords: string[] = []

    for (const entry of SYMPTOM_KEYWORD_MAP) {
      if (entry.patterns.some(p => symptomLower.includes(p.toLowerCase()))) {
        matchedKeywords.push(...entry.dbKeywords)
      }
    }

    if (matchedKeywords.length === 0) return []

    // GIN 인덱스로 키워드 배열 검색
    const { data } = await supabase
      .from('repair_costs')
      .select('*')
      .overlaps('keywords', matchedKeywords)
      .order('sample_count', { ascending: false })
      .limit(15)

    if (!data || data.length === 0) return []

    // 차종 맞는 항목 우선 정렬
    const maker = vehicleInfo?.maker
    const model = vehicleInfo?.model
    return (data as RepairCostItem[]).sort((a, b) => {
      const aScore = (a.car_maker === maker ? 2 : 0) + (a.car_model === model ? 3 : 0)
      const bScore = (b.car_maker === maker ? 2 : 0) + (b.car_model === model ? 3 : 0)
      return bScore - aScore
    }).slice(0, 8)

  } catch {
    return []
  }
}

export function formatRepairCostsContext(costs: RepairCostItem[]): string {
  if (costs.length === 0) return ''

  const lines = costs.map(c => {
    const totalMin = c.parts_min + c.labor_min
    const totalMax = c.parts_max + c.labor_max
    const sampleNote = c.sample_count > 1 ? ` (실제 ${c.sample_count}건 평균)` : ''

    // 표준공임시간이 있으면 괄호로 표시 (출처: 카포스/블루핸즈 표준정비시간)
    let hoursNote = ''
    if (c.labor_hours_min != null && c.labor_hours_max != null) {
      hoursNote = c.labor_hours_min === c.labor_hours_max
        ? `(표준 ${c.labor_hours_min}시간)`
        : `(표준 ${c.labor_hours_min}~${c.labor_hours_max}시간)`
    }

    return `- ${c.repair_item}: 부품 ${c.parts_min.toLocaleString()}~${c.parts_max.toLocaleString()}원 / 공임 ${c.labor_min.toLocaleString()}~${c.labor_max.toLocaleString()}원${hoursNote ? ' ' + hoursNote : ''} / 합계 ${totalMin.toLocaleString()}~${totalMax.toLocaleString()}원${sampleNote}`
  })

  return `\n\n**수리비 참고 데이터**:\n${lines.join('\n')}\n\n⚠️ cost 필드 산정 시 위 데이터를 참고하여 현실적인 범위로 추정하세요. DB에 없는 항목은 일반적인 시장 평균으로 추정하세요.`
}

// 피드백으로 수리비 DB 업데이트 (실제 수리 결과 반영)
export async function updateRepairCostFromFeedback(
  supabase: SupabaseClient,
  repairName: string,
  actualCost: number,
): Promise<void> {
  try {
    // 기존 항목 검색
    const { data: existing } = await supabase
      .from('repair_costs')
      .select('*')
      .ilike('repair_item', `%${repairName}%`)
      .limit(1)
      .single()

    if (existing) {
      // 기존 항목 업데이트: 가중 평균으로 min/max 범위 조정
      const newPartsMin = Math.min(existing.parts_min, Math.round(actualCost * 0.4))
      const newPartsMax = Math.max(existing.parts_max, Math.round(actualCost * 0.6))
      const newLaborMin = Math.min(existing.labor_min, Math.round(actualCost * 0.3))
      const newLaborMax = Math.max(existing.labor_max, Math.round(actualCost * 0.5))

      await supabase
        .from('repair_costs')
        .update({
          parts_min: newPartsMin,
          parts_max: newPartsMax,
          labor_min: newLaborMin,
          labor_max: newLaborMax,
          sample_count: existing.sample_count + 1,
          source: 'user_feedback',
          updated_at: new Date().toISOString(),
        })
        .eq('id', existing.id)
    } else {
      // 새 항목 추가
      await supabase
        .from('repair_costs')
        .insert({
          repair_item: repairName,
          parts_min: Math.round(actualCost * 0.4),
          parts_max: Math.round(actualCost * 0.6),
          labor_min: Math.round(actualCost * 0.3),
          labor_max: Math.round(actualCost * 0.5),
          source: 'user_feedback',
          sample_count: 1,
          keywords: [repairName],
        })
    }
  } catch {
    // 피드백 저장 실패해도 메인 흐름에 영향 없음
  }
}
