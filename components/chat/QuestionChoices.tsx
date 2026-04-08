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

  const question = questions[currentIdx]
  if (!question) return null

  const handleChoice = (choice: string) => {
    if (selected) return // 중복 클릭 방지
    setSelected(choice)
    setTimeout(() => {
      onAnswer(question.id, choice)
      setSelected(null)
    }, 180)
  }

  const chips = [...question.choices, '잘 모르겠어요']

  return (
    <div className="flex items-end gap-2 animate-fade-up">
      {/* AI 아바타 */}
      <div className="w-8 h-8 rounded-xl flex-shrink-0 overflow-hidden shadow-sm mb-1">
        <img src="/miky.png" alt="정비톡 AI" className="w-full h-full object-cover" />
      </div>

      <div className="flex flex-col gap-2 max-w-[85%]">
        {/* AI 질문 말풍선 */}
        <div className="bubble-ai">
          <p className="text-sm leading-relaxed text-gray-800">{question.question}</p>
          {questions.length > 1 && (
            <p className="text-xs text-primary-400 mt-1">{currentIdx + 1} / {questions.length}</p>
          )}
        </div>

        {/* 빠른 선택 칩 — 가로 스크롤 */}
        <div className="flex flex-wrap gap-2">
          {chips.map((chip, i) => {
            const isDontKnow = chip === '잘 모르겠어요'
            const isSelected = selected === chip
            return (
              <button
                key={i}
                onClick={() => handleChoice(chip)}
                disabled={!!selected}
                className={`
                  px-3 py-1.5 rounded-full text-sm border transition-all duration-150
                  disabled:opacity-60 active:scale-95
                  ${isSelected
                    ? 'bg-primary-600 border-primary-600 text-white font-medium'
                    : isDontKnow
                      ? 'bg-white border-gray-200 text-gray-400 hover:border-gray-300 hover:text-gray-500'
                      : 'bg-white border-primary-200 text-primary-700 hover:bg-primary-50 hover:border-primary-400 font-medium'
                  }
                `}
              >
                {isSelected ? `✓ ${chip}` : chip}
              </button>
            )
          })}
        </div>

        {/* 자유 입력 힌트 */}
        <p className="text-xs text-gray-400">
          선택하거나 아래 입력창에 직접 입력하세요
        </p>
      </div>
    </div>
  )
}
