import issuesDb from '@/data/known-issues.json'

interface KnownIssue {
  id: string
  makers: string[]
  modelKeywords: string[]
  yearFrom: number
  yearTo: number
  fuelTypes: string[]
  symptomKeywords: string[]
  minSymptomMatches: number
  name: string
  description: string
  fix: string
  warrantyNote: string
  severity: string
  urgency: string
}

// 제조사명 정규화 (한국어/영어 혼용 대응)
const MAKER_ALIASES: Record<string, string[]> = {
  현대: ['현대', 'hyundai', '현대자동차'],
  기아: ['기아', 'kia', '기아자동차'],
  BMW: ['bmw', 'BMW'],
  벤츠: ['벤츠', 'mercedes', 'mb', '메르세데스'],
  폭스바겐: ['폭스바겐', 'volkswagen', 'vw'],
  아우디: ['아우디', 'audi'],
  쉐보레: ['쉐보레', 'chevrolet', '쉐브', 'GM'],
  르노: ['르노', 'renault', '르노삼성'],
  쌍용: ['쌍용', 'ssangyong', '케이지모빌리티'],
  볼보: ['볼보', 'volvo'],
}

function normalizeMaker(input: string): string {
  const lower = input.toLowerCase().trim()
  for (const [canonical, aliases] of Object.entries(MAKER_ALIASES)) {
    if (aliases.some(a => lower.includes(a.toLowerCase()))) return canonical
  }
  return input
}

function normalizeFuelType(input: string): string {
  const lower = input.toLowerCase()
  if (lower.includes('전기') || lower.includes('ev') || lower === 'electric') return '전기'
  if (lower.includes('디젤') || lower.includes('diesel')) return '디젤'
  if (lower.includes('하이브리드') || lower.includes('hybrid')) return '하이브리드'
  if (lower.includes('lpg') || lower.includes('lpi')) return 'LPG'
  return '가솔린'
}

export interface MatchedIssue {
  id: string
  name: string
  description: string
  fix: string
  warrantyNote: string
  severity: string
  urgency: string
}

export function findKnownIssues(
  vehicleInfo: { maker?: string; model?: string; year?: number | string; fuelType?: string } | undefined,
  symptomText: string
): MatchedIssue[] {
  if (!vehicleInfo) return []

  const makerNorm = normalizeMaker(vehicleInfo.maker ?? '')
  const modelLower = (vehicleInfo.model ?? '').toLowerCase()
  const year = Number(vehicleInfo.year ?? 0)
  const fuelNorm = normalizeFuelType(vehicleInfo.fuelType ?? '')
  const symptomLower = symptomText.toLowerCase()

  const matched: MatchedIssue[] = []

  for (const issue of issuesDb.issues as KnownIssue[]) {
    // 1. 제조사 체크
    const makerMatch = issue.makers.length === 0 ||
      issue.makers.some(m => normalizeMaker(m) === makerNorm)
    if (!makerMatch) continue

    // 2. 모델 체크 (키워드가 모델명에 포함되면 통과)
    const modelMatch = issue.modelKeywords.length === 0 ||
      issue.modelKeywords.some(kw => modelLower.includes(kw.toLowerCase()))
    if (!modelMatch) continue

    // 3. 연식 체크
    if (year > 0 && (year < issue.yearFrom || year > issue.yearTo)) continue

    // 4. 연료타입 체크
    const fuelMatch = issue.fuelTypes.length === 0 ||
      issue.fuelTypes.some(f => f === fuelNorm || f.toLowerCase() === fuelNorm.toLowerCase())
    if (!fuelMatch) continue

    // 5. 증상 키워드 매칭
    const symptomMatches = issue.symptomKeywords.filter(kw =>
      symptomLower.includes(kw.toLowerCase())
    ).length

    if (symptomMatches >= issue.minSymptomMatches) {
      matched.push({
        id: issue.id,
        name: issue.name,
        description: issue.description,
        fix: issue.fix,
        warrantyNote: issue.warrantyNote,
        severity: issue.severity,
        urgency: issue.urgency,
      })
    }
  }

  return matched
}

// Claude 프롬프트에 삽입할 컨텍스트 문자열 생성
export function formatKnownIssuesContext(issues: MatchedIssue[]): string {
  if (issues.length === 0) return ''

  const lines = issues.map(issue =>
    `• [${issue.name}] ${issue.description}\n  → 조치: ${issue.fix}\n  → 보증: ${issue.warrantyNote}`
  ).join('\n')

  return `\n\n📋 참고: 유사 차종·증상에서 보고된 알려진 패턴 (해당 여부는 실제 증상 맥락으로 판단)\n${lines}\n실제 증상과 패턴이 명확히 일치할 때만 진단에 반영하세요. 증상 맥락이 맞지 않으면 무시해도 됩니다.`
}
