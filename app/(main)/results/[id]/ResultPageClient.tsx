'use client'
import { useRouter } from 'next/navigation'
import type { DiagnosisResult } from '@/types'
import DiagnosisResultCard from '@/components/diagnosis/DiagnosisResultCard'

interface Props {
  conversation: {
    id: string
    initial_symptom: string
    final_result: DiagnosisResult | null
    self_check_result: DiagnosisResult | null
    vehicles?: { maker: string; model: string; year: number; mileage: number } | null
    created_at: string
  }
}

export default function ResultPageClient({ conversation }: Props) {
  const router = useRouter()
  const result = conversation.self_check_result ?? conversation.final_result
  if (!result) return null

  const v = conversation.vehicles

  return (
    <div className="flex flex-col min-h-screen bg-surface-50">
      <header className="bg-white px-4 pt-14 pb-4 flex items-center gap-3 border-b border-gray-100">
        <button onClick={() => router.back()} className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-500">←</button>
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

      <div className="px-4 py-4">
        <DiagnosisResultCard
          result={result}
          conversationId={conversation.id}
        />
      </div>
    </div>
  )
}
