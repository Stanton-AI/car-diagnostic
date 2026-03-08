export default function TypingIndicator() {
  return (
    <div className="flex items-end gap-2 animate-fade-in">
      <div className="w-8 h-8 bg-primary-600 rounded-xl flex-shrink-0 flex items-center justify-center shadow-sm">
        <span className="text-white text-xs font-black">M</span>
      </div>
      <div className="bubble-ai">
        <div className="flex items-center gap-1 py-0.5 px-1">
          <div className="typing-dot" />
          <div className="typing-dot" />
          <div className="typing-dot" />
        </div>
      </div>
    </div>
  )
}
