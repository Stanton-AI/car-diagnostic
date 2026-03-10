'use client'
import { useState } from 'react'
import type { DiagnosticQuestion } from '@/types'

interface Props {
  questions: DiagnosticQuestion[]
  onAnswer: (questionId: string, answer: string) => void
}

export default function QuestionChoices({ questions, onAnswer }: Props) {
  const [currentIdx, setCurrentIdx] = useState(0)
  const [customInput, setCustomInput] = useState('')
  const [showCustom, setShowCustom] = useState(false)
  const [selected, setSelected] = useState<string | null>(null)

  // ① 질문 설명 상태
  const [explanation, setExplanation] = useState<string | null>(null)
  const [loadingExplain, setLoadingExplain] = useState(false)

  const question = questions[currentIdx]
  if (!question) return null

  const mainChoices = question.choices

  const handleChoice = (choice: string) => {
    setSelected(choice)
    setTimeout(() => {
      onAnswer(question.id, choice)
      setSelected(null)
      setExplanation(null)
    }, 200)
  }

  const handleDontKnow = () => {
    onAnswer(question.id, '잘 모르겠어요')
    setExplanation(null)
  }

  const handleCustomSubmit = () => {
    if (!customInput.trim()) return
    onAnswer(question.id, customInput.trim())
    setCustomInput('')
    setShowCustom(false)
    setExplanation(null)
  }

  const handleExplain = async () => {
    if (loadingExplain || explanation) {
      // 이미 설명 있으면 토글로 닫기
      setExplanation(null)
      return
    }
    setLoadingExplain(true)
    try {
      const res = await fetch('/api/assist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'question_explain', question: question.question }),
      })
      const data = await res.json()
      setExplanation(data.answer ?? '설명을 불러오지 못했어요.')
    } catch {
      setExplanation('설명을 불러오지 못했어요.')
    } finally {
      setLoadingExplain(false)
    }
  }

  return (
    <div className="flex items-start gap-2 animate-fade-up">
      <div className="w-8 h-8 bg-primary-600 rounded-xl flex-shrink-0 flex items-center justify-center shadow-sm mt-1">
        <span className="text-white text-xs font-black">M</span>
      </div>

      <div className="flex-1 max-w-[90%]">
        {/* 질문 텍스트 */}
        <div className="bubble-question mb-3">
          <p className="text-sm font-medium text-gray-800 leading-relaxed">{question.question}</p>
          {questions.length > 1 && (
            <p className="text-xs text-primary-500 mt-1">{currentIdx + 1} / {questions.length}</p>
          )}
        </div>

        {/* ① 질문 설명 버블 */}
        {(explanation || loadingExplain) && (
          <div className="mb-3 px-3 py-2.5 bg-blue-50 border border-blue-100 rounded-xl">
            <p className="text-xs text-blue-500 font-semibold mb-1">💡 질문 설명</p>
            {loadingExplain ? (
              <div className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            ) : (
              <p className="text-xs text-blue-700 leading-relaxed">{explanation}</p>
            )}
          </div>
        )}

        {!showCustom ? (
          <div className="space-y-2">
            {/* 주요 선택지 */}
            {mainChoices.map((choice, i) => (
              <button
                key={i}
                onClick={() => handleChoice(choice)}
                className={`choice-btn ${selected === choice ? 'selected' : ''}`}
              >
                <span className="w-5 h-5 rounded-full border border-primary-300 bg-white flex-shrink-0 flex items-center justify-center text-xs text-primary-600 font-bold">
                  {String.fromCharCode(65 + i)}
                </span>
                <span className="flex-1 text-sm">{choice}</span>
              </button>
            ))}

            {/* 구분선 */}
            <div className="flex items-center gap-2 py-1">
              <div className="flex-1 h-px bg-gray-200" />
              <span className="text-xs text-gray-400">또는</span>
              <div className="flex-1 h-px bg-gray-200" />
            </div>

            {/* 보조 선택지 */}
            <div className="flex gap-2">
              <button
                onClick={handleDontKnow}
                className="flex-1 px-3 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-500 hover:bg-gray-50 transition-colors text-center"
              >
                잘 모르겠어요
              </button>
              <button
                onClick={() => setShowCustom(true)}
                className="flex-1 px-3 py-2.5 rounded-xl border border-primary-200 text-sm text-primary-600 font-medium hover:bg-primary-50 transition-colors text-center"
              >
                ✏️ 직접 입력
              </button>
            </div>

            {/* ① 질문 설명 버튼 */}
            <button
              onClick={handleExplain}
              disabled={loadingExplain}
              className="w-full px-3 py-2 rounded-xl border border-blue-100 text-xs text-blue-500 hover:bg-blue-50 transition-colors text-center disabled:opacity-50"
            >
              {loadingExplain ? '설명 불러오는 중...' : explanation ? '❓ 설명 닫기' : '❓ 이 질문이 뭔 뜻이에요?'}
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            {/* 힌트 텍스트 */}
            <p className="text-xs text-gray-500 leading-relaxed">
              해당하는 선택지가 없다면 자유롭게 설명해 주세요.<br />
              다른 증상이나 추가 정보도 함께 입력하시면 더 정확한 진단이 가능해요.
            </p>

            {/* 텍스트 입력 */}
            <textarea
              value={customInput}
              onChange={e => setCustomInput(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  handleCustomSubmit()
                }
              }}
              placeholder="예: 엔진룸 쪽에서 나는 것 같고, 비 온 다음 날에 더 심해지는 것 같아요..."
              rows={3}
              className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-primary-400 bg-white resize-none leading-relaxed"
              autoFocus
            />

            {/* 버튼 행 */}
            <div className="flex gap-2">
              <button
                onClick={() => { setShowCustom(false); setCustomInput('') }}
                className="px-4 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-500 hover:bg-gray-50 transition-colors"
              >
                돌아가기
              </button>
              <button
                onClick={handleCustomSubmit}
                disabled={!customInput.trim()}
                className="flex-1 py-2.5 bg-primary-600 text-white rounded-xl text-sm font-medium hover:bg-primary-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                이대로 진단하기 →
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
