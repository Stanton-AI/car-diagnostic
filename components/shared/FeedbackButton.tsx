'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'

export default function FeedbackButton() {
  const [open, setOpen] = useState(false)
  const [content, setContent] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState(false)

  const handleSubmit = async () => {
    if (!content.trim()) return
    setSubmitting(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    const page = typeof window !== 'undefined' ? window.location.pathname : ''
    await supabase.from('feedback').insert({
      user_id: user?.id ?? null,
      page,
      content: content.trim(),
    })
    setSubmitting(false)
    setDone(true)
    setTimeout(() => {
      setOpen(false)
      setDone(false)
      setContent('')
    }, 1800)
  }

  return (
    <>
      {/* 플로팅 버튼 */}
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-24 right-4 z-40 bg-white border border-gray-200 text-gray-500 text-xs font-semibold px-3 py-2 rounded-full shadow-md hover:shadow-lg hover:border-primary-300 hover:text-primary-600 transition-all active:scale-95"
      >
        💬 피드백
      </button>

      {/* 모달 오버레이 */}
      {open && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/40"
          onClick={e => { if (e.target === e.currentTarget) setOpen(false) }}
        >
          <div className="w-full max-w-[480px] bg-white rounded-t-3xl px-5 pt-5 pb-10 animate-slide-up">
            <div className="w-10 h-1 bg-gray-200 rounded-full mx-auto mb-4" />

            {done ? (
              <div className="py-8 text-center">
                <p className="text-3xl mb-2">🙏</p>
                <p className="font-bold text-gray-800">소중한 피드백 감사해요!</p>
                <p className="text-sm text-gray-400 mt-1">더 나은 서비스로 보답할게요</p>
              </div>
            ) : (
              <>
                <h3 className="font-black text-gray-900 text-base mb-1">피드백 보내기</h3>
                <p className="text-xs text-gray-400 mb-4">불편한 점, 개선 아이디어 무엇이든 편하게 적어주세요</p>

                <textarea
                  value={content}
                  onChange={e => setContent(e.target.value)}
                  placeholder="예: 진단 결과가 너무 어려워요 / 이런 기능이 있으면 좋겠어요..."
                  rows={5}
                  className="w-full px-4 py-3 border border-gray-200 rounded-2xl text-sm focus:outline-none focus:border-primary-400 resize-none"
                  autoFocus
                />

                <div className="flex gap-2 mt-3">
                  <button
                    onClick={() => setOpen(false)}
                    className="flex-1 py-3 border border-gray-200 text-gray-500 rounded-2xl text-sm font-semibold hover:bg-gray-50"
                  >
                    취소
                  </button>
                  <button
                    onClick={handleSubmit}
                    disabled={!content.trim() || submitting}
                    className="flex-1 py-3 bg-primary-600 text-white rounded-2xl text-sm font-bold disabled:opacity-40 hover:bg-primary-700 transition-colors"
                  >
                    {submitting ? '전송 중...' : '보내기'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  )
}
