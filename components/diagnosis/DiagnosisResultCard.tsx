'use client'
import { useState } from 'react'
import type { DiagnosisResult, SelfCheckItem } from '@/types'
import { formatKRW, getShareUrl, urgencyLabel } from '@/lib/utils'

interface Props {
  result: DiagnosisResult
  conversationId: string
  onSelfCheckSubmit?: (results: string) => void
}

export default function DiagnosisResultCard({ result, conversationId, onSelfCheckSubmit }: Props) {
  const [selfCheckItems, setSelfCheckItems] = useState<SelfCheckItem[]>(
    result.selfCheck.map(item => ({ ...item, checked: false, result: '' }))
  )
  const [showSelfCheckInput, setShowSelfCheckInput] = useState(false)
  const [selfCheckNote, setSelfCheckNote] = useState('')
  const [copied, setCopied] = useState(false)

  const urgency = urgencyLabel(result.urgency)
  const shareUrl = getShareUrl(conversationId)

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

  return (
    <div className="space-y-3 animate-fade-up">
      {/* AI 아바타 + 헤더 라벨 */}
      <div className="flex items-center gap-2 px-1">
        <div className="w-8 h-8 bg-primary-600 rounded-xl flex-shrink-0 flex items-center justify-center shadow-sm">
          <span className="text-white text-xs font-black">M</span>
        </div>
        <span className="text-sm font-semibold text-gray-700">MIKY AI 진단 리포트</span>
        <button onClick={handleCopyLink} className="ml-auto text-gray-400 hover:text-primary-500 transition-colors p-1">
          {copied ? <span className="text-xs text-green-500 font-medium">복사됨!</span> : (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/>
              <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>
            </svg>
          )}
        </button>
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
        <div className="px-4 pt-4 pb-2 flex items-center justify-between">
          <h4 className="font-bold text-gray-900 text-sm">예상 원인 분석</h4>
          <span className="text-xs text-gray-400">신뢰도순</span>
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
                  <span className={`text-lg font-black ${i === 0 ? 'text-primary-600' : 'text-gray-400'}`}>
                    {cause.probability}%
                  </span>
                </div>
              </div>
              {/* 확률 바 */}
              <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-700 ${i === 0 ? 'bg-primary-500' : 'bg-gray-300'}`}
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
      </div>

      {/* 권장 조치 사항 */}
      <div className="bg-primary-50 rounded-2xl border border-primary-100 p-4">
        <h4 className="font-bold text-primary-800 text-sm mb-2">💡 권장 조치 사항</h4>
        <p className="text-sm text-primary-700 leading-relaxed">{result.shopTip}</p>
      </div>

      {/* 자가점검 팁 */}
      {result.selfCheck.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
          <h4 className="font-bold text-gray-900 text-sm mb-3">🏠 집에서 먼저 확인해보세요</h4>
          <div className="space-y-3">
            {selfCheckItems.map((item, i) => (
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

      {/* CTA */}
      <button className="w-full py-4 bg-primary-600 text-white rounded-2xl font-bold text-sm hover:bg-primary-700 transition-all active:scale-[0.98] shadow-lg shadow-primary-200 flex items-center justify-center gap-2">
        <span>📅</span>
        <span>내 주변 정비소 예약하기</span>
      </button>
    </div>
  )
}
