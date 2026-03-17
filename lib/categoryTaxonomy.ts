// 자동차 진단 카테고리 분류 체계 (대/중 2단계)

export const CATEGORY_TAXONOMY = {
  '엔진 계통': {
    icon: '🔧',
    color: 'bg-orange-400',
    textColor: 'text-orange-700',
    lightBg: 'bg-orange-50',
    borderColor: 'border-orange-200',
    hex: '#f97316',
    sub: ['엔진 본체', '연료 계통', '흡배기 계통', '냉각·윤활 계통', '점화 계통'],
  },
  '동력전달 계통': {
    icon: '⚙️',
    color: 'bg-purple-400',
    textColor: 'text-purple-700',
    lightBg: 'bg-purple-50',
    borderColor: 'border-purple-200',
    hex: '#a855f7',
    sub: ['변속기', '구동축·차축', '클러치'],
  },
  '전기·전자 계통': {
    icon: '⚡',
    color: 'bg-yellow-400',
    textColor: 'text-yellow-700',
    lightBg: 'bg-yellow-50',
    borderColor: 'border-yellow-200',
    hex: '#eab308',
    sub: ['ECU·전자제어', '센서 계통', '배터리·시동 계통', '조명·편의장치'],
  },
  '타이어·제동·조향': {
    icon: '🛞',
    color: 'bg-blue-400',
    textColor: 'text-blue-700',
    lightBg: 'bg-blue-50',
    borderColor: 'border-blue-200',
    hex: '#3b82f6',
    sub: ['타이어·휠·TPMS', '제동 계통', '조향 계통', '서스펜션·현가'],
  },
  '차체·공조': {
    icon: '🌡️',
    color: 'bg-cyan-400',
    textColor: 'text-cyan-700',
    lightBg: 'bg-cyan-50',
    borderColor: 'border-cyan-200',
    hex: '#06b6d4',
    sub: ['에어컨·히터', '차체·도장', '내장·편의'],
  },
  '전기차·하이브리드': {
    icon: '🔋',
    color: 'bg-green-400',
    textColor: 'text-green-700',
    lightBg: 'bg-green-50',
    borderColor: 'border-green-200',
    hex: '#22c55e',
    sub: ['구동 모터', '고전압 배터리', '충전 계통', '하이브리드 시스템'],
  },
  '기타': {
    icon: '🔩',
    color: 'bg-gray-400',
    textColor: 'text-gray-700',
    lightBg: 'bg-gray-50',
    borderColor: 'border-gray-200',
    hex: '#9ca3af',
    sub: ['경정비', '외판·도장', '기타'],
  },
} as const

export type MajorCategory = keyof typeof CATEGORY_TAXONOMY
export const MAJOR_CATEGORIES = Object.keys(CATEGORY_TAXONOMY) as MajorCategory[]

// ── 키워드 기반 대분류 정규화 ────────────────────────────────────────────
// AI가 자유롭게 생성한 카테고리명 → 표준 대분류로 매핑
const KEYWORD_MAP: Array<{ keywords: string[]; major: MajorCategory }> = [
  {
    keywords: ['전기차', '하이브리드', '고전압', '구동 모터', '인버터', '배터리·충전', '충전시스템', '충전 시스템', '배터리·충전', 'ev', 'hev'],
    major: '전기차·하이브리드',
  },
  {
    keywords: ['엔진', '연료', '흡배기', '냉각', '점화', '윤활', '오일', '배기', '연소', '벨트계통', '누유', '과열'],
    major: '엔진 계통',
  },
  {
    keywords: ['변속기', '변속', '구동축', '드라이브샤프트', '클러치', '동력전달'],
    major: '동력전달 계통',
  },
  {
    keywords: ['전기계통', '전자', 'ecu', '센서', '시동계통', '배터리', '경고등', '전기시스템', '전장'],
    major: '전기·전자 계통',
  },
  {
    keywords: ['타이어', '휠', 'tpms', '공기압', '브레이크', '제동', '조향', '서스펜션', '현가', '스티어링'],
    major: '타이어·제동·조향',
  },
  {
    keywords: ['에어컨', '히터', '공조', '냉매', '차체', '도장', '내장', '시트', '트렁크', '블로워'],
    major: '차체·공조',
  },
]

export function normalizeMajorCategory(raw: string | null | undefined): MajorCategory {
  if (!raw) return '기타'
  const lower = raw.toLowerCase()
  for (const { keywords, major } of KEYWORD_MAP) {
    if (keywords.some(k => lower.includes(k.toLowerCase()))) return major
  }
  // 직접 대분류명과 일치하는지 확인
  for (const major of MAJOR_CATEGORIES) {
    if (lower.includes(major.toLowerCase())) return major
  }
  return '기타'
}

// ── AI 프롬프트용 카테고리 목록 ─────────────────────────────────────────
export const CATEGORY_PROMPT_SECTION = `
## 카테고리 분류 규칙 (반드시 아래 목록 중 하나만 사용)
category 필드는 반드시 아래 대분류 > 중분류 형식 중 하나로만 작성하세요:

엔진 계통 > 엔진 본체
엔진 계통 > 연료 계통
엔진 계통 > 흡배기 계통
엔진 계통 > 냉각·윤활 계통
엔진 계통 > 점화 계통
동력전달 계통 > 변속기
동력전달 계통 > 구동축·차축
동력전달 계통 > 클러치
전기·전자 계통 > ECU·전자제어
전기·전자 계통 > 센서 계통
전기·전자 계통 > 배터리·시동 계통
전기·전자 계통 > 조명·편의장치
타이어·제동·조향 > 타이어·휠·TPMS
타이어·제동·조향 > 제동 계통
타이어·제동·조향 > 조향 계통
타이어·제동·조향 > 서스펜션·현가
차체·공조 > 에어컨·히터
차체·공조 > 차체·도장
차체·공조 > 내장·편의
전기차·하이브리드 > 구동 모터
전기차·하이브리드 > 고전압 배터리
전기차·하이브리드 > 충전 계통
전기차·하이브리드 > 하이브리드 시스템
기타 > 경정비
기타 > 외판·도장
기타 > 기타
`

// ── 중분류 파싱 유틸 ────────────────────────────────────────────────────
export function parseCategoryHierarchy(raw: string | null | undefined): {
  major: MajorCategory
  sub: string
} {
  if (!raw) return { major: '기타', sub: '기타' }
  if (raw.includes(' > ')) {
    const [majorRaw, sub] = raw.split(' > ', 2)
    const major = (MAJOR_CATEGORIES.find(m => m === majorRaw.trim()) ?? normalizeMajorCategory(majorRaw)) as MajorCategory
    return { major, sub: sub.trim() }
  }
  return { major: normalizeMajorCategory(raw), sub: raw }
}
