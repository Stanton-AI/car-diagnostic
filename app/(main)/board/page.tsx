'use client'
import BottomNav from '@/components/nav/BottomNav'

export default function BoardPage() {
  return (
    <div className="flex flex-col h-screen bg-surface-50 max-w-[480px] mx-auto">
      <header className="bg-white px-5 pt-12 pb-4 border-b border-gray-100 flex-shrink-0">
        <h1 className="text-xl font-black text-gray-900">게시판</h1>
        <p className="text-sm text-gray-400 mt-0.5">정비 정보와 후기를 공유해요</p>
      </header>
      <div className="flex-1 flex flex-col items-center justify-center gap-3 text-center px-6">
        <span className="text-5xl">💬</span>
        <p className="text-base font-bold text-gray-700">게시판 준비 중이에요</p>
        <p className="text-sm text-gray-400 leading-relaxed">정비 후기, Q&A, 차량 정보 등<br/>다양한 게시판이 곧 오픈됩니다!</p>
      </div>
      <BottomNav />
    </div>
  )
}
