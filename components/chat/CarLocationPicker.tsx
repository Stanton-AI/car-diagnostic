'use client'
import { useState } from 'react'
import type { DiagnosticQuestion } from '@/types'

type ZoneId = 'fl' | 'fr' | 'rl' | 'rr' | 'front' | 'cabin' | 'rear'

const ZONE_META: Record<ZoneId, { label: string; sub: string; keywords: string[] }> = {
  fl:    { label: '앞 왼쪽',   sub: '운전석',    keywords: ['앞 왼', '앞쪽 왼', '운전석 앞', '운전석쪽', 'FL', '1번'] },
  fr:    { label: '앞 오른쪽', sub: '조수석',    keywords: ['앞 오른', '앞쪽 오른', '조수석 앞', '조수석쪽', 'FR', '2번'] },
  rl:    { label: '뒤 왼쪽',   sub: '운전석 뒤', keywords: ['뒤 왼', '뒤쪽 왼', '운전석 뒤', 'RL', '3번'] },
  rr:    { label: '뒤 오른쪽', sub: '조수석 뒤', keywords: ['뒤 오른', '뒤쪽 오른', '조수석 뒤', 'RR', '4번'] },
  front: { label: '앞쪽',      sub: '엔진/보닛', keywords: ['앞쪽', '전방', '보닛', '엔진', '후드'] },
  cabin: { label: '실내',      sub: '핸들/시트', keywords: ['실내', '내부', '핸들', '시트', '대시', '운전석'] },
  rear:  { label: '뒤쪽',      sub: '트렁크',    keywords: ['뒤쪽', '후방', '트렁크', '배기', '머플러'] },
}

/** choices 배열에서 해당 존과 가장 잘 맞는 선택지를 찾는다 */
function findMatchingChoice(zone: ZoneId, choices: string[]): string | null {
  const { keywords } = ZONE_META[zone]
  return choices.find(c => keywords.some(k => c.includes(k))) ?? null
}

interface Props {
  question: DiagnosticQuestion
  onSelect: (answer: string) => void
}

export default function CarLocationPicker({ question, onSelect }: Props) {
  const [active, setActive] = useState<ZoneId | null>(null)

  const handleZoneTap = (zone: ZoneId) => {
    if (active) return // prevent double-tap
    setActive(zone)
    const matched = findMatchingChoice(zone, question.choices)
    const { label, sub } = ZONE_META[zone]
    const answer = matched ?? `${label} (${sub})`
    setTimeout(() => onSelect(answer), 180)
  }

  // colour helpers
  const bodyFill  = (z: ZoneId) => active === z ? '#4C4DDC' : '#f0f0f6'
  const bodyText  = (z: ZoneId) => active === z ? '#ffffff' : '#555'
  const bodySub   = (z: ZoneId) => active === z ? 'rgba(255,255,255,0.72)' : '#bbb'
  const wheelFill = (z: ZoneId) => active === z ? '#4C4DDC' : '#9ca3af'
  const wText     = () => '#ffffff'
  const wSub      = () => 'rgba(255,255,255,0.8)'

  return (
    <div className="flex flex-col items-center gap-3">
      <p className="text-[11px] text-gray-400 font-medium tracking-wide">
        해당 위치를 탭하세요
      </p>

      <svg
        viewBox="0 0 240 400"
        width="210"
        height="350"
        className="overflow-visible touch-manipulation select-none"
        style={{ userSelect: 'none' }}
      >
        <defs>
          <clipPath id="carClip">
            <rect x="50" y="50" width="140" height="300" rx="22" />
          </clipPath>
        </defs>

        {/* ── 방향 화살표 (앞) ── */}
        <polygon points="120,6 131,26 109,26" fill="#4C4DDC" opacity="0.45" />
        <text x="120" y="40" textAnchor="middle" fontSize="9" fill="#bbb" fontFamily="system-ui">앞</text>

        {/* ── 차체 배경 ── */}
        <rect x="50" y="50" width="140" height="300" rx="22"
          fill="#e8e8f0" stroke="rgba(0,0,0,0.09)" strokeWidth="1.5" />

        {/* ── 클리핑된 존 영역 ── */}
        <g clipPath="url(#carClip)">
          {/* 앞쪽 (엔진/보닛) */}
          <rect x="50" y="50" width="140" height="95"
            fill={bodyFill('front')}
            onClick={() => handleZoneTap('front')}
            className="cursor-pointer"
          />
          {/* 실내 */}
          <rect x="50" y="145" width="140" height="115"
            fill={bodyFill('cabin')}
            onClick={() => handleZoneTap('cabin')}
            className="cursor-pointer"
          />
          {/* 뒤쪽 (트렁크) */}
          <rect x="50" y="260" width="140" height="90"
            fill={bodyFill('rear')}
            onClick={() => handleZoneTap('rear')}
            className="cursor-pointer"
          />
        </g>

        {/* ── 존 경계선 ── */}
        <line x1="52" y1="145" x2="188" y2="145" stroke="rgba(0,0,0,0.07)" strokeWidth="1" />
        <line x1="52" y1="260" x2="188" y2="260" stroke="rgba(0,0,0,0.07)" strokeWidth="1" />

        {/* ── 차체 아웃라인 (최상위, 클릭 무시) ── */}
        <rect x="50" y="50" width="140" height="300" rx="22"
          fill="none" stroke="rgba(0,0,0,0.14)" strokeWidth="2"
          pointerEvents="none"
        />

        {/* ── 앞유리 / 뒷유리 (장식) ── */}
        <rect x="67" y="78" width="106" height="50" rx="7"
          fill="rgba(180,200,255,0.3)" stroke="rgba(100,130,220,0.13)" strokeWidth="1"
          pointerEvents="none"
        />
        <rect x="67" y="268" width="106" height="46" rx="7"
          fill="rgba(180,200,255,0.3)" stroke="rgba(100,130,220,0.13)" strokeWidth="1"
          pointerEvents="none"
        />

        {/* ── 존 라벨 ── */}
        <text x="120" y="95" textAnchor="middle" fontSize="11" fontWeight="700"
          fill={bodyText('front')} pointerEvents="none">앞쪽</text>
        <text x="120" y="108" textAnchor="middle" fontSize="9"
          fill={bodySub('front')} pointerEvents="none">엔진 / 보닛</text>

        <text x="120" y="198" textAnchor="middle" fontSize="11" fontWeight="700"
          fill={bodyText('cabin')} pointerEvents="none">실내</text>
        <text x="120" y="212" textAnchor="middle" fontSize="9"
          fill={bodySub('cabin')} pointerEvents="none">핸들 / 시트</text>

        <text x="120" y="295" textAnchor="middle" fontSize="11" fontWeight="700"
          fill={bodyText('rear')} pointerEvents="none">뒤쪽</text>
        <text x="120" y="308" textAnchor="middle" fontSize="9"
          fill={bodySub('rear')} pointerEvents="none">트렁크</text>

        {/* ── 바퀴 4개 ── */}

        {/* FL — 앞 왼쪽 (운전석 앞) */}
        <rect x="8" y="65" width="42" height="64" rx="11"
          fill={wheelFill('fl')}
          onClick={() => handleZoneTap('fl')}
          className="cursor-pointer"
        />
        <text x="29" y="90" textAnchor="middle" fontSize="8" fontWeight="700" fill={wText()} pointerEvents="none">앞</text>
        <text x="29" y="101" textAnchor="middle" fontSize="7" fill={wSub()} pointerEvents="none">왼쪽</text>
        <text x="29" y="112" textAnchor="middle" fontSize="6" fill="rgba(255,255,255,0.65)" pointerEvents="none">운전석</text>

        {/* FR — 앞 오른쪽 (조수석 앞) */}
        <rect x="190" y="65" width="42" height="64" rx="11"
          fill={wheelFill('fr')}
          onClick={() => handleZoneTap('fr')}
          className="cursor-pointer"
        />
        <text x="211" y="90" textAnchor="middle" fontSize="8" fontWeight="700" fill={wText()} pointerEvents="none">앞</text>
        <text x="211" y="101" textAnchor="middle" fontSize="7" fill={wSub()} pointerEvents="none">오른쪽</text>
        <text x="211" y="112" textAnchor="middle" fontSize="6" fill="rgba(255,255,255,0.65)" pointerEvents="none">조수석</text>

        {/* RL — 뒤 왼쪽 */}
        <rect x="8" y="271" width="42" height="64" rx="11"
          fill={wheelFill('rl')}
          onClick={() => handleZoneTap('rl')}
          className="cursor-pointer"
        />
        <text x="29" y="296" textAnchor="middle" fontSize="8" fontWeight="700" fill={wText()} pointerEvents="none">뒤</text>
        <text x="29" y="307" textAnchor="middle" fontSize="7" fill={wSub()} pointerEvents="none">왼쪽</text>

        {/* RR — 뒤 오른쪽 */}
        <rect x="190" y="271" width="42" height="64" rx="11"
          fill={wheelFill('rr')}
          onClick={() => handleZoneTap('rr')}
          className="cursor-pointer"
        />
        <text x="211" y="296" textAnchor="middle" fontSize="8" fontWeight="700" fill={wText()} pointerEvents="none">뒤</text>
        <text x="211" y="307" textAnchor="middle" fontSize="7" fill={wSub()} pointerEvents="none">오른쪽</text>

        {/* ── 뒤 방향 텍스트 ── */}
        <text x="120" y="395" textAnchor="middle" fontSize="9" fill="#bbb" fontFamily="system-ui">뒤</text>
      </svg>

      {/* 잘 모르겠어요 */}
      <button
        onClick={() => { if (!active) onSelect('잘 모르겠어요') }}
        className="text-[11px] text-gray-400 border border-gray-200 bg-white px-5 py-2 rounded-xl hover:bg-gray-50 active:scale-95 transition-all"
      >
        잘 모르겠어요
      </button>
    </div>
  )
}
