'use client'
import type { Vehicle } from '@/types'

interface ChatHeaderProps {
  vehicle: Partial<Vehicle> | null
  onBack: () => void
  step?: number      // 1~4
  totalSteps?: number
}

export default function ChatHeader({ vehicle, onBack, step = 1, totalSteps = 4 }: ChatHeaderProps) {
  const stepLabel =
    step === 1 ? '증상 입력 중' :
    step === 2 ? '추가 확인 중' :
    step === 3 ? '마지막 확인' :
    '진단 완료'

  return (
    <header className="sticky top-0 z-10 bg-white border-b border-gray-100">
      <div className="px-4 py-3 flex items-center gap-3">
        <button
          onClick={onBack}
          className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 transition-colors text-gray-500"
          aria-label="뒤로가기"
        >
          ←
        </button>

        <div className="flex items-center gap-2 flex-1">
          <div className="w-9 h-9 bg-primary-600 rounded-xl flex items-center justify-center shadow-sm">
            <span className="text-white text-sm font-black">정</span>
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="font-bold text-gray-900 text-sm">정비톡 AI 증상 상담</span>
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

        {/* 진행 단계 표시 */}
        <div className="flex flex-col items-end gap-0.5">
          <span className="text-[10px] text-gray-400 font-medium">{stepLabel}</span>
          <span className="text-xs font-bold text-primary-600">{step}/{totalSteps} 단계</span>
        </div>
      </div>

      {/* 진행 바 */}
      <div className="h-0.5 bg-gray-100">
        <div
          className="h-full bg-primary-500 transition-all duration-500"
          style={{ width: `${(step / totalSteps) * 100}%` }}
        />
      </div>
    </header>
  )
}
