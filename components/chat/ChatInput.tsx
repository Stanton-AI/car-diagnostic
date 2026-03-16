'use client'
import { useState, useRef } from 'react'

interface Props {
  onSend: (text: string) => void
  onImageUpload: (files: File[]) => Promise<string[]>
  uploadedImages: string[]
  onRemoveImage: (url: string) => void
  disabled?: boolean
  placeholder?: string
}

export default function ChatInput({ onSend, onImageUpload, uploadedImages, onRemoveImage, disabled, placeholder }: Props) {
  const [text, setText] = useState('')
  const [uploading, setUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleSend = () => {
    if (disabled) return
    const hasText = text.trim().length > 0
    const hasImage = uploadedImages.length > 0
    if (!hasText && !hasImage) return
    // 이미지만 있고 텍스트 없으면 기본 문구로 전송
    onSend(hasText ? text.trim() : '이미지를 첨부했습니다.')
    setText('')
  }

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? [])
    if (!files.length) return
    setUploading(true)
    try {
      await onImageUpload(files)
    } finally {
      setUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  return (
    <div className="border-t border-gray-100 bg-white px-3 py-3 safe-area-pb">
      {/* 첨부 이미지 미리보기 */}
      {uploadedImages.length > 0 && (
        <div className="flex gap-2 mb-2 px-1">
          {uploadedImages.map((url, i) => (
            <div key={i} className="relative">
              <img src={url} alt="" className="w-14 h-14 object-cover rounded-lg border border-gray-200" />
              <button
                onClick={() => onRemoveImage(url)}
                className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-gray-700 text-white rounded-full text-xs flex items-center justify-center leading-none"
              >
                ×
              </button>
            </div>
          ))}
          {uploadedImages.length < 3 && (
            <button
              onClick={() => fileInputRef.current?.click()}
              className="w-14 h-14 rounded-lg border-2 border-dashed border-gray-200 flex items-center justify-center text-gray-400 text-xl hover:border-primary-300 hover:text-primary-400 transition-colors"
            >
              +
            </button>
          )}
        </div>
      )}

      <div className="flex items-end gap-2">
        {/* 이미지 첨부 버튼 */}
        {uploadedImages.length === 0 && (
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="w-10 h-10 flex items-center justify-center rounded-full text-gray-400 hover:text-primary-500 hover:bg-primary-50 transition-colors flex-shrink-0"
            aria-label="이미지 첨부"
          >
            {uploading ? (
              <span className="animate-spin text-sm">⟳</span>
            ) : (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                <circle cx="8.5" cy="8.5" r="1.5"/>
                <polyline points="21,15 16,10 5,21"/>
              </svg>
            )}
          </button>
        )}

        {/* 텍스트 입력 */}
        <div className="flex-1 flex items-end bg-gray-100 rounded-2xl px-4 py-2.5 min-h-[44px]">
          <textarea
            value={text}
            onChange={e => setText(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                handleSend()
              }
            }}
            placeholder={placeholder ?? "증상을 설명해주세요..."}
            rows={1}
            className="flex-1 bg-transparent text-sm text-gray-800 placeholder-gray-400 resize-none focus:outline-none max-h-28 leading-relaxed"
            style={{ height: 'auto' }}
            onInput={e => {
              const t = e.target as HTMLTextAreaElement
              t.style.height = 'auto'
              t.style.height = `${Math.min(t.scrollHeight, 112)}px`
            }}
          />
        </div>

        {/* 전송 버튼 */}
        <button
          onClick={handleSend}
          disabled={(!text.trim() && uploadedImages.length === 0) || disabled}
          className="w-10 h-10 flex items-center justify-center rounded-full bg-primary-600 text-white flex-shrink-0 disabled:opacity-30 disabled:cursor-not-allowed hover:bg-primary-700 transition-colors active:scale-95"
          aria-label="전송"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
            <path d="M2 21l21-9L2 3v7l15 2-15 2z"/>
          </svg>
        </button>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={handleFileChange}
      />
    </div>
  )
}
