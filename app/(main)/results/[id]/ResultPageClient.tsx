'use client'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import type { DiagnosisResult, ChatMessage } from '@/types'
import DiagnosisResultCard from '@/components/diagnosis/DiagnosisResultCard'

interface Props {
  conversation: {
    id: string
    initial_symptom: string
    final_result: DiagnosisResult | null
    self_check_result: DiagnosisResult | null
    messages?: ChatMessage[]
    vehicles?: { maker: string; model: string; year: number; mileage: number } | null
    created_at: string
  }
}

function ChatBubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === 'user'

  // 결과/재진단 메시지는 숨김 (DiagnosisResultCard로 표시됨)
  if (message.type === 'result' || message.type === 're_diagnosis') return null

  const label =
    message.type === 'question' ? '🔍 추가 질문' :
    message.type === 'self_check_input' ? '📋 자가점검 결과' :
    null

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div className={`max-w-[80%] flex flex-col gap-1 ${isUser ? 'items-end' : 'items-start'}`}>
        {label && (
          <span className="text-[10px] text-gray-400 px-1">{label}</span>
        )}
        <div
          className={`px-3.5 py-2.5 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap ${
            isUser
              ? 'bg-primary-600 text-white rounded-tr-sm'
              : 'bg-white border border-gray-100 text-gray-800 rounded-tl-sm'
          }`}
        >
          {message.content}
        </div>
      </div>
    </div>
  )
}

export default function ResultPageClient({ conversation }: Props) {
  const router = useRouter()
  const result = conversation.self_check_result ?? conversation.final_result
  const [showChat, setShowChat] = useState(false)

  if (!result) return null

  const v = conversation.vehicles

  // 표시할 메시지 필터링 (결과 메시지 제외, 내용 있는 것만)
  const displayMessages = (conversation.messages ?? []).filter(
    m => m.content?.trim() && m.type !== 'result' && m.type !== 're_diagnosis'
  )

  return (
    <div className="flex flex-col min-h-screen bg-surface-50">
      <header className="bg-white px-4 pt-14 pb-4 flex items-center gap-3 border-b border-gray-100">
        <button
          onClick={() => router.back()}
          className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-500"
        >
          ←
        </button>
        <h1 className="text-lg font-black text-gray-900">진단 결과</h1>
        <button
          onClick={async () => {
            await navigator.clipboard.writeText(window.location.href)
            alert('링크가 복사되었습니다')
          }}
          className="ml-auto text-gray-400 hover:text-primary-500 p-2"
        >
          🔗
        </button>
      </header>

      {/* 차량 정보 */}
      {v && (
        <div className="bg-white border-b border-gray-100 px-4 py-3">
          <p className="text-xs text-gray-500">
            {v.maker} {v.model} · {v.year}년식 · {v.mileage?.toLocaleString()}km
          </p>
        </div>
      )}

      <div className="px-4 py-4 space-y-4">
        {/* 진단 결과 카드 */}
        <DiagnosisResultCard
          result={result}
          conversationId={conversation.id}
        />

        {/* 대화 내역 섹션 */}
        {displayMessages.length > 0 && (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <button
              onClick={() => setShowChat(prev => !prev)}
              className="w-full flex items-center justify-between px-4 py-3.5 hover:bg-gray-50 transition-colors"
            >
              <div className="flex items-center gap-2">
                <span className="text-base">💬</span>
                <span className="text-sm font-bold text-gray-800">대화 내역</span>
                <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">
                  {displayMessages.length}개
                </span>
              </div>
              <span className="text-gray-400 text-sm">
                {showChat ? '▲ 접기' : '▼ 펼치기'}
              </span>
            </button>

            {showChat && (
              <div className="px-4 pb-4 pt-3 space-y-3 border-t border-gray-100 bg-surface-50">
                {displayMessages.map((msg) => (
                  <ChatBubble key={msg.id} message={msg} />
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
