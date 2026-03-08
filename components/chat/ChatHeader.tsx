'use client'
import type { Vehicle } from '@/types'

interface ChatHeaderProps {
  vehicle: Partial<Vehicle> | null
  onBack: () => void
}

export default function ChatHeader({ vehicle, onBack }: ChatHeaderProps) {
  return (
    <header className="sticky top-0 z-10 bg-white border-b border-gray-100 px-4 py-3 flex items-center gap-3">
      <button
        onClick={onBack}
        className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 transition-colors text-gray-500"
        aria-label="뒤로가기"
      >
        ←
      </button>

      <div className="flex items-center gap-2 flex-1">
        <div className="w-9 h-9 bg-primary-600 rounded-xl flex items-center justify-center shadow-sm">
          <span className="text-white text-sm font-black">M</span>
        </div>
        <div>
          <div className="flex items-center gap-1.5">
            <span className="font-bold text-gray-900 text-sm">MIKY 증상 채팅 상담</span>
            <span className="flex items-center gap-1">
              <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
              <span className="text-xs text-green-600 font-medium">AI 온라인</span>
            </span>
          </div>
          {vehicle?.model && (
            <p className="text-xs text-gray-500">
              {vehicle.maker} {vehicle.model} · {vehicle.mileage?.toLocaleString()}km
            </p>
          )}
        </div>
      </div>

      <button
        className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 transition-colors text-gray-400"
        aria-label="대화 이력"
        onClick={() => {}}
      >
        🕐
      </button>
    </header>
  )
}
