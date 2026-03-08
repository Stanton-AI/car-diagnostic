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

  const question = questions[currentIdx]
  if (!question) return null

  const allChoices = [...question.choices, '모름', '기타 (직접 입력)']

  const handleChoice = (choice: string) => {
    if (choice === '기타 (직접 입력)') {
      setShowCustom(true)
      return
    }
    setSelected(choice)
    setTimeout(() => {
      onAnswer(question.id, choice)
      setSelected(null)
      setShowCustom(false)
    }, 200)
  }

  const handleCustomSubmit = () => {
    if (!customInput.trim()) return
    onAnswer(question.id, customInput.trim())
    setCustomInput('')
    setShowCustom(false)
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

        {/* 선택지 */}
        {!showCustom ? (
          <div className="space-y-2">
            {allChoices.map((choice, i) => (
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
          </div>
        ) : (
          <div className="flex gap-2">
            <input
              type="text"
              value={customInput}
              onChange={e => setCustomInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleCustomSubmit()}
              placeholder="직접 입력해 주세요..."
              className="flex-1 px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-primary-400 bg-white"
              autoFocus
            />
            <button
              onClick={handleCustomSubmit}
              className="px-4 py-3 bg-primary-600 text-white rounded-xl text-sm font-medium hover:bg-primary-700 transition-colors"
            >
              확인
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
