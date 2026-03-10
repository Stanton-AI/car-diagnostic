'use client'
import { useState, useRef, useEffect } from 'react'
import type { DiagnosisResult, SelfCheckItem } from '@/types'
import { formatKRW, getShareUrl, urgencyLabel } from '@/lib/utils'

interface Props {
  result: DiagnosisResult
  conversationId: string
  onSelfCheckSubmit?: (results: string) => void
  defaultExpanded?: boolean   // false면 접힌 채로 시작
  isRediagnosis?: boolean     // 재진단 카드 여부 (비용 변동 안내 표시)
}

// 주요 원인 신뢰도가 이 값 이상이면 추가 자가진단 불필요로 판단
const CONFIDENT_THRESHOLD = 70

export default function DiagnosisResultCard({
  result,
  conversationId,
  onSelfCheckSubmit,
  defaultExpanded = true,
  isRediagnosis = false,
}: Props) {
  const [expanded, setExpanded] = useState(defaultExpanded)
  const [selfCheckItems, setSelfCheckItems] = useState<SelfCheckItem[]>(
    result.selfCheck.map(item => ({ ...item, checked: false, result: '' }))
  )
  const [showSelfCheckInput, setShowSelfCheckInput] = useState(false)
  const [selfCheckNote, setSelfCheckNote] = useState('')
  const [copied, setCopied] = useState(false)

  // ② 결과 채팅 상태
  type ChatMsg = { role: 'user' | 'assistant'; content: string }
  const [chatMessages, setChatMessages] = useState<ChatMsg[]>([])
  const [chatInput, setChatInput] = useState('')
  const [chatLoading, setChatLoading] = useState(false)
  const chatBottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [chatMessages])

  const diagnosisContext = `
진단 결과 요약: ${result.summary}
예상 원인:
${result.causes.map((c, i) => `${i + 1}. ${c.name} (${c.enName ?? ''}) - ${c.description}`).join('\n')}
긴급도: ${result.urgency} - ${result.urgencyReason}
예상 비용: 부품비 ${result.cost.parts.toLocaleString()}원 + 공임비 ${result.cost.labor.toLocaleString()}원 = 합계 ${result.cost.total.toLocaleString()}원
`.trim()

  const handleChatSubmit = async () => {
    const msg = chatInput.trim()
    if (!msg || chatLoading) return

    const newHistory: ChatMsg[] = [...chatMessages, { role: 'user', content: msg }]
    setChatMessages(newHistory)
    setChatInput('')
    setChatLoading(true)

    try {
      const res = await fetch('/api/assist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'result_chat',
          userMessage: msg,
          diagnosisContext,
          chatHistory: chatMessages,
        }),
      })
      const data = await res.json()
      setChatMessages([...newHistory, { role: 'assistant', content: data.answer ?? '답변을 불러오지 못했어요.' }])
    } catch {
      setChatMessages([...newHistory, { role: 'assistant', content: '오류가 발생했어요. 다시 시도해 주세요.' }])
    } finally {
      setChatLoading(false)
    }
  }

  const urgency = urgencyLabel(result.urgency)
  const shareUrl = getShareUrl(conversationId)

  const topProbability = result.causes[0]?.probability ?? 0
  const isConfident = topProbability >= CONFIDENT_THRESHOLD

  const handleCopyLink = async () => {
    await navigator.clipboard.writeText(shareUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
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
            <span className="text-white text-xs font-black">M</span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[11px] text-gray-400 font-medium leading-none mb-0.5">
              {isRediagnosis ? '이전 진단' : 'MIKY AI 진단 리포트'}
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
          <span className="text-white text-xs font-black">M</span>
        </div>
        <span className="text-sm font-semibold text-gray-700">MIKY AI 진단 리포트</span>
        <div className="ml-auto flex items-center gap-1">
          <button
            onClick={handleCopyLink}
            className="text-gray-400 hover:text-primary-500 transition-colors p-1"
            title="링크 복사"
          >
            {copied ? (
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
            <div key={i} className="cause-card mx-3 mb-3 rounded-xl border border-gray-100">
              <div className="flex items-start justify-between gap-2 mb-2">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-gray-900 text-sm">{cause.name}</span>
                    {cause.enName && (
                      <span className="text-xs text-gray-400">{cause.enName}</span>
                    )}
                  </div>
                  <p className="text-xs text-gray-500 mt-1 leading-relaxed">{cause.description}</p>
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
              <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-700 ${i === 0 ? 'bg-primary-500' : i === 1 ? 'bg-amber-400' : 'bg-gray-300'}`}
                  style={{ width: `${cause.probability}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 예상 수리 비용 */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
        <h4 className="font-bold text-gray-900 text-sm mb-3">표준 정비 견적</h4>
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
              <span>공임비 (예상)</span>
            </div>
            <span className="font-semibold text-gray-800">{formatKRW(result.cost.labor)}</span>
          </div>
          <div className="border-t border-gray-100 pt-2 flex items-center justify-between">
            <span className="font-bold text-gray-900">최종 예상 견적</span>
            <span className="text-xl font-black text-primary-600">{formatKRW(result.cost.total)}</span>
          </div>
        </div>
        {result.cost.note && (
          <p className="text-xs text-gray-400 mt-2 leading-relaxed">* {result.cost.note}</p>
        )}

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

      {/* 권장 조치 사항 */}
      <div className="bg-primary-50 rounded-2xl border border-primary-100 p-4">
        <h4 className="font-bold text-primary-800 text-sm mb-2">💡 권장 조치 사항</h4>
        <p className="text-sm text-primary-700 leading-relaxed">{result.shopTip}</p>
      </div>

      {/* 자가점검 섹션 */}
      {/* onSelfCheckSubmit 미정의 = 구버전 카드 → 자가점검 섹션 전체 숨김 */}
      {result.selfCheck.length > 0 && !!onSelfCheckSubmit && (
        isConfident ? (
          /* 신뢰도가 높아 추가 자가진단 불필요 */
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
          /* 추가 자가진단 가능 */
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

      {/* 면책 조항 */}
      <p className="text-xs text-gray-400 leading-relaxed px-1">{result.disclaimer}</p>

      {/* ② 결과 채팅 */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-4 pt-4 pb-2 border-b border-gray-50">
          <h4 className="font-bold text-gray-900 text-sm">💬 결과가 궁금하다면 물어보세요</h4>
          <p className="text-xs text-gray-400 mt-0.5">전문 용어나 수리 방법 등 무엇이든 질문해 보세요</p>
        </div>

        {/* 채팅 메시지 목록 */}
        {chatMessages.length > 0 && (
          <div className="px-4 py-3 space-y-3 max-h-64 overflow-y-auto">
            {chatMessages.map((msg, i) => (
              <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[85%] px-3 py-2 rounded-2xl text-xs leading-relaxed ${
                  msg.role === 'user'
                    ? 'bg-primary-600 text-white rounded-tr-sm'
                    : 'bg-gray-50 text-gray-700 rounded-tl-sm'
                }`}>
                  {msg.content}
                </div>
              </div>
            ))}
            {chatLoading && (
              <div className="flex justify-start">
                <div className="bg-gray-50 px-3 py-2 rounded-2xl rounded-tl-sm flex items-center gap-1">
                  <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                  <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                  <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
              </div>
            )}
            <div ref={chatBottomRef} />
          </div>
        )}

        {/* 입력창 */}
        <div className="px-4 pb-4 pt-2">
          <div className="flex gap-2">
            <input
              type="text"
              value={chatInput}
              onChange={e => setChatInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleChatSubmit() }}
              placeholder="예: 피스톤링 마모가 뭔가요?"
              className="flex-1 px-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:border-primary-400 bg-white"
              disabled={chatLoading}
            />
            <button
              onClick={handleChatSubmit}
              disabled={!chatInput.trim() || chatLoading}
              className="px-4 py-2.5 bg-primary-600 text-white rounded-xl text-sm font-medium hover:bg-primary-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              전송
            </button>
          </div>
        </div>
      </div>

      {/* CTA */}
      <button className="w-full py-4 bg-primary-600 text-white rounded-2xl font-bold text-sm hover:bg-primary-700 transition-all active:scale-[0.98] shadow-lg shadow-primary-200 flex items-center justify-center gap-2">
        <span>📅</span>
        <span>내 주변 정비소 예약하기</span>
      </button>
    </div>
  )
}
