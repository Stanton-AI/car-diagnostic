import type { ChatMessage } from '@/types'

interface Props { message: ChatMessage }

export default function MessageBubble({ message }: Props) {
  const isUser = message.role === 'user'
  const isQuestion = message.type === 'question'

  return (
    <div className={`flex items-end gap-2.5 ${isUser ? 'justify-end' : 'justify-start'}`}>
      {/* AI 아바타 — 글로우 링 + 그래디언트 배경 */}
      {!isUser && (
        <div
          className="w-8 h-8 rounded-xl flex-shrink-0 overflow-hidden mb-1 ring-2 ring-primary-100"
          style={{
            boxShadow: '0 2px 8px rgba(91, 79, 207, 0.12)',
          }}
        >
          <img src="/miky.png" alt="정비톡 AI" className="w-full h-full object-cover" />
        </div>
      )}

      <div className={isUser ? 'bubble-user' : isQuestion ? 'bubble-question' : 'bubble-ai'}>
        {/* 이미지 (사용자 메시지에 첨부된 경우) */}
        {message.metadata?.images && message.metadata.images.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-2">
            {(message.metadata.images as string[]).map((url, i) => (
              <img
                key={i}
                src={url}
                alt="첨부 이미지"
                className="w-20 h-20 object-cover rounded-xl border border-white/20"
              />
            ))}
          </div>
        )}

        {/* 텍스트 */}
        <p className="text-sm leading-relaxed whitespace-pre-line">{message.content}</p>

        {/* 타임스탬프 */}
        <p className={`text-[11px] mt-1.5 ${isUser ? 'text-white/50 text-right' : 'text-gray-400'}`}>
          {new Date(message.timestamp).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}
        </p>
      </div>
    </div>
  )
}
