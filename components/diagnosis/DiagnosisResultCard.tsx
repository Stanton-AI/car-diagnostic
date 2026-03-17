'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { DiagnosisResult, SelfCheckItem } from '@/types'
import { formatKRW, getShareUrl, urgencyLabel } from '@/lib/utils'
import { CauseNameWithExplain } from './TermTooltip'

interface Props {
  result: DiagnosisResult
  conversationId: string
  onSelfCheckSubmit?: (results: string) => void
  defaultExpanded?: boolean   // false면 접힌 채로 시작
  isRediagnosis?: boolean     // 재진단 카드 여부 (비용 변동 안내 표시)
}

// 주요 원인 신뢰도가 이 값 이상이면 추가 자가진단 불필요로 판단
const CONFIDENT_THRESHOLD = 70

// 차량 건강 점수 계산 (urgency + 최고 확률 기반)
function calcHealthScore(result: DiagnosisResult): number {
  const topProb = result.causes[0]?.probability ?? 50
  if (result.urgency === 'HIGH') return Math.max(15, 50 - Math.round(topProb / 3))
  if (result.urgency === 'MID')  return Math.max(45, 75 - Math.round(topProb / 3))
  return Math.max(70, 95 - Math.round(topProb / 5))
}

function HealthScoreBadge({ score }: { score: number }) {
  const color = score >= 70 ? 'text-green-600 bg-green-50 border-green-200'
    : score >= 45 ? 'text-amber-600 bg-amber-50 border-amber-200'
    : 'text-red-600 bg-red-50 border-red-200'
  return (
    <div className={`flex items-center gap-1 px-2 py-0.5 rounded-full border text-xs font-bold ${color}`}>
      <span>❤️</span>
      <span>건강점수 {score}/100</span>
    </div>
  )
}

export default function DiagnosisResultCard({
  result,
  conversationId,
  onSelfCheckSubmit,
  defaultExpanded = true,
  isRediagnosis = false,
}: Props) {
  const router = useRouter()
  const [expanded, setExpanded] = useState(defaultExpanded)
  const [selfCheckItems, setSelfCheckItems] = useState<SelfCheckItem[]>(
    result.selfCheck.map(item => ({ ...item, checked: false, result: '' }))
  )
  const [showSelfCheckInput, setShowSelfCheckInput] = useState(false)
  const [selfCheckNote, setSelfCheckNote] = useState('')
  const [shared, setShared] = useState(false)

  // 정비 결과 피드백
  const [showFeedback, setShowFeedback] = useState(false)
  const [feedbackRepairName, setFeedbackRepairName] = useState('')
  const [feedbackCost, setFeedbackCost] = useState('')
  const [feedbackAiCorrect, setFeedbackAiCorrect] = useState<boolean | null>(null)
  const [feedbackSubmitting, setFeedbackSubmitting] = useState(false)
  const [feedbackDone, setFeedbackDone] = useState(false)

  const urgency = urgencyLabel(result.urgency)
  const shareUrl = getShareUrl(conversationId)
  const healthScore = calcHealthScore(result)

  const topProbability = result.causes[0]?.probability ?? 0
  const isConfident = topProbability >= CONFIDENT_THRESHOLD

  // 방치 시 예상 비용 (현재 견적의 2~3배)
  const neglectCost = formatKRW(result.cost.total * 2)

  const handleShare = async () => {
    try {
      if (navigator.share) {
        await navigator.share({ title: '정비톡 자동차 진단 결과', text: result.summary, url: shareUrl })
      } else {
        await navigator.clipboard.writeText(shareUrl)
        setShared(true)
        setTimeout(() => setShared(false), 2000)
      }
    } catch { /* user cancelled share */ }
  }

  const handleFeedbackSubmit = async () => {
    if (!feedbackRepairName.trim()) return
    setFeedbackSubmitting(true)
    try {
      await fetch(`/api/conversations/${conversationId}/feedback`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          repair_name: feedbackRepairName.trim(),
          actual_cost: feedbackCost ? parseInt(feedbackCost.replace(/,/g, '')) : undefined,
          ai_correct: feedbackAiCorrect,
        }),
      })
      setFeedbackDone(true)
      setShowFeedback(false)
    } catch {
      // 저장 실패해도 UX 방해 않음
    } finally {
      setFeedbackSubmitting(false)
    }
  }

  const handleSelfCheckSubmit = () => {
    const checkedItems = selfCheckItems.filter(i => i.checked)
    const summary = checkedItems.map(i => `${i.tip}: ${i.result || '확인함'}`).join(', ')
    const full = selfCheckNote ? `${summary}. 추가: ${selfCheckNote}` : summary
    onSelfCheckSubmit?.(full || selfCheckNote)
    setShowSelfCheckInput(false)
  }

  // ── 접힌 상태 (미니 요약 카드) ─────────────────────────────────────────
  if (!expanded) {
    return (
      <button
        onClick={() => setExpanded(true)}
        className="w-full text-left bg-white rounded-2xl border border-gray-200 p-3.5 hover:border-primary-300 hover:shadow-sm transition-all animate-fade-up"
      >
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 bg-primary-600 rounded-xl flex-shrink-0 flex items-center justify-center shadow-sm">
            <span className="text-white text-xs font-black">정</span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[11px] text-gray-400 font-medium leading-none mb-0.5">
              {isRediagnosis ? '이전 진단' : '정비톡 AI 진단 리포트'}
            </p>
            <p className="text-sm font-bold text-gray-700 truncate">{result.summary}</p>
          </div>
          <div className="flex items-center gap-1.5 flex-shrink-0">
            <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full border ${urgency.bg} ${urgency.color}`}>
              {urgency.label}
            </span>
            <span className="text-gray-400 text-xs">▼ 펼치기</span>
          </div>
        </div>
      </button>
    )
  }

  // ── 펼친 상태 (전체 카드) ──────────────────────────────────────────────
  return (
    <div className="space-y-3 animate-fade-up">
      {/* AI 아바타 + 헤더 */}
      <div className="flex items-center gap-2 px-1">
        <div className="w-8 h-8 bg-primary-600 rounded-xl flex-shrink-0 flex items-center justify-center shadow-sm">
          <span className="text-white text-xs font-black">정</span>
        </div>
        <span className="text-sm font-semibold text-gray-700">정비톡 AI 진단 리포트</span>
        <div className="ml-auto flex items-center gap-1.5">
          <HealthScoreBadge score={healthScore} />
          <button
            onClick={handleShare}
            className="text-gray-400 hover:text-primary-500 transition-colors p-1"
            title="공유"
          >
            {shared ? (
              <span className="text-xs text-green-500 font-medium">복사됨!</span>
            ) : (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/>
                <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>
              </svg>
            )}
          </button>
          {/* 접기 버튼 */}
          <button
            onClick={() => setExpanded(false)}
            className="text-gray-400 hover:text-gray-600 transition-colors p-1 text-xs font-medium"
            title="접기"
          >
            ▲ 접기
          </button>
        </div>
      </div>

      {/* P1: 면책 문구 — 결과 위에 먼저 표시 (솔직함 = 신뢰) */}
      <div className="flex items-start gap-2 px-1">
        <span className="text-gray-400 text-xs mt-0.5">ℹ️</span>
        <p className="text-[11px] text-gray-400 leading-relaxed">
          이 결과는 AI가 증상 정보를 바탕으로 추정한 진단입니다. 실제 정비사 점검이 최종 판단이며, 참고용으로 활용해 주세요.
        </p>
      </div>

      {/* 주요 증상 카드 */}
      <div className={`rounded-2xl p-4 border ${urgency.bg}`}>
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1">
            <p className="text-xs font-semibold text-gray-500 mb-1">주요 증상</p>
            <h3 className="text-lg font-bold text-gray-900 leading-tight">{result.summary}</h3>
            <p className={`text-xs font-semibold mt-2 ${urgency.color}`}>⚠ {urgency.label}</p>
            <p className="text-xs text-gray-500 mt-0.5">{result.urgencyReason}</p>
          </div>
        </div>
      </div>

      {/* 원인 분석 */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-4 pt-4 pb-2">
          <div className="flex items-center justify-between">
            <h4 className="font-bold text-gray-900 text-sm">예상 원인 분석</h4>
            <span className="text-xs text-gray-400">가능성 높은 순</span>
          </div>
          <p className="text-xs text-gray-500 mt-0.5 flex items-center gap-1">
            <span>📊</span>
            <span>막대 길이가 길수록 해당 증상과 일치 가능성이 높음</span>
          </p>
        </div>
        <div className="divide-y divide-gray-50">
          {result.causes.map((cause, i) => (
            <div key={i} className={`mx-3 mb-3 rounded-xl border ${i === 0 ? 'border-primary-100 bg-primary-50/30' : 'border-gray-100'} p-3`}>
              <div className="flex items-start justify-between gap-2 mb-2">
                <div className="flex-1">
                  <CauseNameWithExplain name={cause.name} enName={cause.enName} />
                  <p className="text-xs text-gray-500 mt-1 leading-relaxed">{cause.description}</p>
                  {/* P2: 방치 시나리오 — 1순위 + HIGH/MID 한정 */}
                  {i === 0 && result.urgency !== 'LOW' && (
                    <p className="text-[11px] text-orange-600 font-medium mt-1.5 flex items-center gap-1">
                      <span>⚠</span>
                      <span>방치 시 {neglectCost}+ 수리비로 번질 수 있어요</span>
                    </p>
                  )}
                </div>
                <div className="flex-shrink-0 text-right">
                  <span className={`text-sm font-bold px-2 py-0.5 rounded-full ${
                    i === 0
                      ? 'bg-primary-50 text-primary-600'
                      : i === 1
                      ? 'bg-amber-50 text-amber-600'
                      : 'bg-gray-100 text-gray-400'
                  }`}>
                    {i === 0 ? '유력' : i === 1 ? '가능' : '참고'}
                  </span>
                </div>
              </div>
              {/* P2: 게이지 바 — 1순위를 두껍게 시각적 차별화 */}
              <div className={`w-full bg-gray-100 rounded-full overflow-hidden ${i === 0 ? 'h-2.5' : 'h-1.5'}`}>
                <div
                  className={`h-full rounded-full transition-all duration-700 ${i === 0 ? 'bg-primary-500' : i === 1 ? 'bg-amber-400' : 'bg-gray-300'}`}
                  style={{ width: `${cause.probability}%` }}
                />
              </div>
              {/* 1순위와 2순위 사이 시각적 구분 강화 */}
              {i === 0 && result.causes.length > 1 && (
                <div className="mt-3 border-b border-dashed border-gray-200" />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* CTA — 방치 비용 문구 직후, 감정 피크에서 바로 행동 유도 */}
      {result.urgency !== 'LOW' && (
        <button
          onClick={() => router.push(`/repair/request/${conversationId}`)}
          className="w-full py-4 bg-primary-600 text-white rounded-2xl font-bold text-sm hover:bg-primary-700 transition-all active:scale-[0.98] shadow-lg shadow-primary-200 flex flex-col items-center justify-center gap-0.5"
        >
          <div className="flex items-center gap-2">
            <span>🔧</span>
            <span>무료 견적 받기</span>
          </div>
          <span className="text-xs font-normal opacity-90">
            최대 {formatKRW(Math.round(result.cost.total * 0.5 / 10000) * 10000)} 아낄 수 있어요
          </span>
        </button>
      )}

      {/* 예상 수리 비용 */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
        <div className="flex items-center justify-between mb-3">
          <h4 className="font-bold text-gray-900 text-sm">공식 서비스 센터 예상견적</h4>
        </div>
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-2 text-gray-600">
              <span className="w-6 h-6 bg-gray-100 rounded-lg flex items-center justify-center text-xs">🔩</span>
              <span>부품비</span>
            </div>
            <span className="font-semibold text-gray-800">{formatKRW(result.cost.parts)}</span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-2 text-gray-600">
              <span className="w-6 h-6 bg-gray-100 rounded-lg flex items-center justify-center text-xs">🔧</span>
              <span>공임비</span>
            </div>
            <span className="font-semibold text-gray-800">{formatKRW(result.cost.labor)}</span>
          </div>
          <div className="border-t border-gray-100 pt-2 flex items-center justify-between">
            <span className="font-bold text-gray-900">공식센터 예상 합계</span>
            <span className="text-xl font-black text-primary-600">{formatKRW(result.cost.total)}</span>
          </div>
        </div>
        {result.cost.note && (
          <p className="text-xs text-gray-400 mt-2 leading-relaxed">* {result.cost.note}</p>
        )}
        {/* 보호 문구 각주 */}
        <p className="text-[11px] text-gray-400 mt-2 leading-relaxed">
          ※ AI가 증상 기반으로 추정한 참고 견적입니다. 실제 금액은 차량 상태·지역·시기에 따라 다를 수 있습니다.
        </p>

        {/* 재진단 시 비용 변동 안내 */}
        {isRediagnosis && (
          <div className="mt-3 flex items-start gap-1.5 p-2.5 bg-amber-50 rounded-xl border border-amber-100">
            <span className="text-amber-500 text-xs mt-0.5 flex-shrink-0">ℹ️</span>
            <p className="text-xs text-amber-700 leading-relaxed">
              자가점검으로 주요 원인의 우선순위가 바뀌면 견적도 함께 조정됩니다.
              AI는 매 진단마다 원인별 확률을 독립적으로 추정하므로 소폭의 변동은 정상입니다.
              최종 비용은 정비소 직접 확인을 권장합니다.
            </p>
          </div>
        )}
      </div>

      {/* LOW urgency CTA (덜 긴박하게) */}
      {result.urgency === 'LOW' && (
        <button
          onClick={() => router.push(`/repair/request/${conversationId}`)}
          className="w-full py-3.5 bg-primary-600 text-white rounded-2xl font-bold text-sm hover:bg-primary-700 transition-all active:scale-[0.98] flex flex-col items-center justify-center gap-0.5"
        >
          <div className="flex items-center gap-2">
            <span>🔧</span>
            <span>무료 견적 받기</span>
          </div>
          <span className="text-xs font-normal opacity-90">
            최대 {formatKRW(Math.round(result.cost.total * 0.5 / 10000) * 10000)} 아낄 수 있어요
          </span>
        </button>
      )}

      {/* 권장 조치 사항 */}
      <div className="bg-primary-50 rounded-2xl border border-primary-100 p-4">
        <h4 className="font-bold text-primary-800 text-sm mb-2">💡 권장 조치 사항</h4>
        <p className="text-sm text-primary-700 leading-relaxed">{result.shopTip}</p>
      </div>

      {/* 자가점검 섹션 */}
      {result.selfCheck.length > 0 && !!onSelfCheckSubmit && (
        isConfident ? (
          <div className="bg-green-50 rounded-2xl border border-green-200 p-4">
            <div className="flex items-start gap-2.5">
              <span className="text-green-600 text-lg flex-shrink-0">✅</span>
              <div>
                <h4 className="font-bold text-green-800 text-sm mb-1">진단 원인이 충분히 좁혀졌습니다</h4>
                <p className="text-xs text-green-700 leading-relaxed">
                  <strong>{result.causes[0]?.name}</strong>이 유력한 원인으로 좁혀져
                  추가 자가점검의 실익이 적습니다.
                  정비소 방문을 통한 정확한 진단을 권장합니다.
                </p>
              </div>
            </div>
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
            <h4 className="font-bold text-gray-900 text-sm mb-3">🏠 집에서 먼저 확인해보세요</h4>
            <div className="space-y-3">
              {selfCheckItems.map((item) => (
                <label key={item.id} className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={item.checked}
                    onChange={e => {
                      setSelfCheckItems(prev =>
                        prev.map(it => it.id === item.id ? { ...it, checked: e.target.checked } : it)
                      )
                    }}
                    className="mt-0.5 w-4 h-4 accent-primary-600 rounded flex-shrink-0"
                  />
                  <span className="text-sm text-gray-700 leading-relaxed">{item.tip}</span>
                </label>
              ))}
            </div>

            {selfCheckItems.some(i => i.checked) && (
              <button
                onClick={() => setShowSelfCheckInput(true)}
                className="mt-4 w-full py-2.5 bg-primary-600 text-white rounded-xl text-sm font-semibold hover:bg-primary-700 transition-colors"
              >
                자가점검 결과 알려주기 → 재진단 받기
              </button>
            )}
          </div>
        )
      )}

      {/* 자가점검 결과 입력 */}
      {showSelfCheckInput && (
        <div className="bg-white rounded-2xl border border-primary-200 shadow-sm p-4 animate-fade-up">
          <h4 className="font-bold text-gray-900 text-sm mb-3">자가점검 결과를 알려주세요</h4>
          <textarea
            value={selfCheckNote}
            onChange={e => setSelfCheckNote(e.target.value)}
            placeholder="확인한 결과나 추가 증상을 입력해 주세요..."
            rows={3}
            className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:border-primary-400 resize-none"
          />
          <div className="flex gap-2 mt-3">
            <button
              onClick={() => setShowSelfCheckInput(false)}
              className="flex-1 py-2.5 border border-gray-200 text-gray-600 rounded-xl text-sm font-medium hover:bg-gray-50 transition-colors"
            >
              취소
            </button>
            <button
              onClick={handleSelfCheckSubmit}
              className="flex-1 py-2.5 bg-primary-600 text-white rounded-xl text-sm font-semibold hover:bg-primary-700 transition-colors"
            >
              재진단 요청
            </button>
          </div>
        </div>
      )}

      {/* ── 정비 결과 피드백 ─────────────────────────────────── */}
      {!feedbackDone ? (
        <div className="mt-4 pt-4 border-t border-gray-100">
          {!showFeedback ? (
            <button
              onClick={() => setShowFeedback(true)}
              className="w-full py-2.5 rounded-xl border border-gray-200 text-sm text-gray-500 hover:bg-gray-50 transition-colors text-center"
            >
              🔧 정비소 다녀오셨나요? 결과 알려주세요
            </button>
          ) : (
            <div className="bg-gray-50 rounded-xl p-4 space-y-3">
              <p className="text-sm font-semibold text-gray-800">실제 수리 결과</p>

              {/* AI 예측 일치 여부 */}
              <div className="flex gap-2">
                <button
                  onClick={() => setFeedbackAiCorrect(true)}
                  className={`flex-1 py-2 rounded-xl border text-xs font-medium transition-colors ${feedbackAiCorrect === true ? 'bg-green-50 border-green-400 text-green-700' : 'border-gray-200 text-gray-500 hover:bg-gray-100'}`}
                >
                  ✅ AI 예측이 맞았어요
                </button>
                <button
                  onClick={() => setFeedbackAiCorrect(false)}
                  className={`flex-1 py-2 rounded-xl border text-xs font-medium transition-colors ${feedbackAiCorrect === false ? 'bg-red-50 border-red-400 text-red-700' : 'border-gray-200 text-gray-500 hover:bg-gray-100'}`}
                >
                  ❌ 달랐어요
                </button>
              </div>

              {/* 실제 수리명 */}
              <input
                type="text"
                value={feedbackRepairName}
                onChange={e => setFeedbackRepairName(e.target.value)}
                placeholder="실제 수리 내역 (예: 워터펌프 교체)"
                className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:border-primary-400 bg-white"
              />

              {/* 실제 비용 */}
              <input
                type="text"
                value={feedbackCost}
                onChange={e => setFeedbackCost(e.target.value)}
                placeholder="실제 수리비 (선택, 예: 250000)"
                className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:border-primary-400 bg-white"
              />

              <div className="flex gap-2">
                <button
                  onClick={() => setShowFeedback(false)}
                  className="px-4 py-2.5 border border-gray-200 text-sm text-gray-500 rounded-xl hover:bg-gray-100 transition-colors"
                >
                  취소
                </button>
                <button
                  onClick={handleFeedbackSubmit}
                  disabled={!feedbackRepairName.trim() || feedbackSubmitting}
                  className="flex-1 py-2.5 bg-primary-600 text-white rounded-xl text-sm font-semibold hover:bg-primary-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {feedbackSubmitting ? '저장 중...' : '결과 제출'}
                </button>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="mt-4 pt-4 border-t border-gray-100">
          <p className="text-center text-sm text-green-600 font-medium py-2">
            ✅ 정비 결과를 알려주셔서 감사합니다! AI 개선에 도움이 됩니다.
          </p>
        </div>
      )}
    </div>
  )
}
