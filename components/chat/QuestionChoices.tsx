'use client'
import { useState } from 'react'
import type { DiagnosticQuestion } from '@/types'

interface Props {
  questions: DiagnosticQuestion[]
  onAnswer: (questionId: string, answer: string) => void
}

export default function QuestionChoices({ questions, onAnswer }: Props) {
  const [currentIdx, setCurrentIdx] = useState(0)
  const [selected, setSelected] = useState<string | null>(null)
  const [explanation, setExplanation] = useState<string | null>(null)
  const [loadingExplain, setLoadingExplain] = useState(false)

  const question = questions[currentIdx]
  if (!question) return null

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

  const handleExplain = async () => {
    if (loadingExplain || explanation) {
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
        <span className="text-white text-xs font-black">정</span>
      </div>

      <div className="flex-1 max-w-[90%]">
        {/* 질문 텍스트 */}
        <div className="bubble-question mb-2">
          <p className="text-sm font-medium text-gray-800 leading-relaxed">{question.question}</p>
          {questions.length > 1 && (
            <p className="text-xs text-primary-500 mt-1">{currentIdx + 1} / {questions.length}</p>
          )}
        </div>

        {/* 질문 설명 버블 */}
        {(explanation || loadingExplain) && (
          <div className="mb-2 px-3 py-2.5 bg-blue-50 border border-blue-100 rounded-xl">
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

        {/* 선택지 버튼들 */}
        <div className="space-y-1.5">
          {/* 설명 버튼 */}
          <button
            onClick={handleExplain}
            disabled={loadingExplain}
            className="w-full px-3 py-2 rounded-xl border border-blue-100 text-xs text-blue-500 hover:bg-blue-50 transition-colors text-center disabled:opacity-50"
          >
            {loadingExplain ? '설명 불러오는 중...' : explanation ? '❓ 설명 닫기' : '❓ 이 질문이 뭔 뜻이에요?'}
          </button>

          {/* 주요 선택지 */}
          {question.choices.map((choice, i) => (
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

          {/* 잘 모르겠어요 */}
          <button
            onClick={handleDontKnow}
            className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-500 hover:bg-gray-50 transition-colors text-center"
          >
            잘 모르겠어요
          </button>

          {/* 자유 입력 안내 힌트 */}
          <p className="text-xs text-gray-400 text-center pt-0.5">
            또는 아래 입력창에 자유롭게 입력하세요
          </p>
        </div>
      </div>
    </div>
  )
}
