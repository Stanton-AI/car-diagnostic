import type { ChatMessage } from '@/types'

interface Props { message: ChatMessage }

export default function MessageBubble({ message }: Props) {
  const isUser = message.role === 'user'
  const isQuestion = message.type === 'question'

  return (
    <div className={`flex items-end gap-2 ${isUser ? 'justify-end' : 'justify-start'}`}>
      {/* AI 아바타 */}
      {!isUser && (
        <div className="w-8 h-8 bg-primary-600 rounded-xl flex-shrink-0 flex items-center justify-center shadow-sm mb-1">
          <span className="text-white text-xs font-black">M</span>
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
                className="w-20 h-20 object-cover rounded-lg border border-white/20"
              />
            ))}
          </div>
        )}

        {/* 텍스트 */}
        <p className="text-sm leading-relaxed whitespace-pre-line">{message.content}</p>

        {/* 타임스탬프 */}
        <p className={`text-xs mt-1 ${isUser ? 'text-white/60 text-right' : 'text-gray-400'}`}>
          {new Date(message.timestamp).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}
        </p>
      </div>
    </div>
  )
}
