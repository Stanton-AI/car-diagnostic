'use client'
import { useRouter } from 'next/navigation'
import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import type { DiagnosisResult, ChatMessage } from '@/types'
import DiagnosisResultCard from '@/components/diagnosis/DiagnosisResultCard'
import { createClient } from '@/lib/supabase/client'
import { REQUEST_STATUS_LABEL } from '@/lib/marketplace'

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
  const [repairRequest, setRepairRequest] = useState<{ id: string; status: string; bid_count: number } | null>(null)
  const [sharing, setSharing] = useState(false)
  const cardRef = useRef<HTMLDivElement>(null)
  const supabase = createClient()

  useEffect(() => {
    // 이 대화에 연결된 견적 요청이 있는지 확인
    const checkRepair = async () => {
      const { data } = await supabase
        .from('repair_requests')
        .select('id, status, bid_count')
        .eq('conversation_id', conversation.id)
        .neq('status', 'cancelled')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()
      if (data) setRepairRequest(data)
    }
    checkRepair()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversation.id])

  if (!result) return null

  const v = conversation.vehicles

  // 표시할 메시지 필터링 (결과 메시지 제외, 내용 있는 것만)
  const displayMessages = (conversation.messages ?? []).filter(
    m => m.content?.trim() && m.type !== 'result' && m.type !== 're_diagnosis'
  )

  // 게시판 공유 (html2canvas 캡쳐 → Supabase Storage 업로드 → 게시판 글쓰기)
  const handleShareToBoard = async () => {
    if (!cardRef.current) return
    setSharing(true)
    try {
      // html2canvas 동적 import
      const html2canvas = (await import('html2canvas')).default
      const canvas = await html2canvas(cardRef.current, {
        backgroundColor: '#f8f9fa',
        scale: 2,
        useCORS: true,
        logging: false,
      })

      // canvas → blob
      const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/png'))
      if (!blob) throw new Error('캡쳐 실패')

      // Supabase Storage 업로드
      const filename = `diagnosis-share/${conversation.id}-${Date.now()}.png`
      const { data: uploadData, error: uploadErr } = await supabase.storage
        .from('repair-files')
        .upload(filename, blob, { contentType: 'image/png', upsert: true })

      let imageUrl = ''
      if (!uploadErr && uploadData) {
        const { data: urlData } = supabase.storage.from('repair-files').getPublicUrl(filename)
        imageUrl = urlData.publicUrl
      }

      // 진단 요약 텍스트 생성
      const topCause = result.causes?.[0]
      const titleText = `🔧 진단 결과 공유 — ${topCause?.name ?? conversation.initial_symptom}`
      const contentLines: string[] = [
        `증상: ${conversation.initial_symptom}`,
        '',
      ]
      if (result.causes && result.causes.length > 0) {
        contentLines.push('📋 주요 원인:')
        result.causes.slice(0, 3).forEach((c, i) => {
          contentLines.push(`${i + 1}. ${c.name} (가능성 ${c.probability ?? '?'}%)`)
        })
        contentLines.push('')
      }
      if (result.cost?.total) {
        contentLines.push(`💰 예상 수리비: ${result.cost.total.toLocaleString()}원`)
        contentLines.push('')
      }
      contentLines.push('— 정비톡 AI 진단')

      const params = new URLSearchParams({
        openWrite: '1',
        title: titleText,
        content: contentLines.join('\n'),
        category: '정비후기',
        ...(imageUrl ? { imageUrl } : {}),
      })

      router.push(`/board?${params.toString()}`)
    } catch (err) {
      console.error('[share-to-board]', err)
      // 이미지 없이도 이동
      const topCause = result.causes?.[0]
      const titleText = `🔧 진단 결과 공유 — ${topCause?.name ?? conversation.initial_symptom}`
      const params = new URLSearchParams({
        openWrite: '1',
        title: titleText,
        content: `증상: ${conversation.initial_symptom}`,
        category: '정비후기',
      })
      router.push(`/board?${params.toString()}`)
    } finally {
      setSharing(false)
    }
  }

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

        {/* 견적 요청 현황 배너 */}
        {repairRequest && (() => {
          const statusInfo = REQUEST_STATUS_LABEL[repairRequest.status]
          const isActive = ['open', 'bidding'].includes(repairRequest.status)
          return (
            <Link href={`/repair/${repairRequest.id}`} className="block">
              <div className={`rounded-2xl p-4 border flex items-center justify-between gap-3 ${
                isActive ? 'bg-primary-50 border-primary-200' : 'bg-gray-50 border-gray-200'
              }`}>
                <div>
                  <p className={`text-xs font-bold mb-0.5 ${isActive ? 'text-primary-600' : 'text-gray-500'}`}>
                    🔧 견적 요청 현황
                  </p>
                  <div className="flex items-center gap-2">
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${statusInfo?.color ?? 'bg-gray-100 text-gray-500'}`}>
                      {statusInfo?.label}
                    </span>
                    {repairRequest.bid_count > 0 && (
                      <span className="text-xs text-primary-600 font-semibold">
                        📬 입찰 {repairRequest.bid_count}건
                      </span>
                    )}
                  </div>
                </div>
                <span className={`text-sm font-bold ${isActive ? 'text-primary-600' : 'text-gray-400'}`}>→</span>
              </div>
            </Link>
          )
        })()}

        {/* 진단 결과 카드 (캡쳐 대상) */}
        <div ref={cardRef}>
          <DiagnosisResultCard
            result={result}
            conversationId={conversation.id}
          />
        </div>

        {/* 게시판 공유 버튼 */}
        <button
          onClick={handleShareToBoard}
          disabled={sharing}
          className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl border-2 border-primary-200 bg-primary-50 text-primary-700 font-bold text-sm hover:bg-primary-100 transition-colors disabled:opacity-50"
        >
          {sharing ? (
            <><span className="animate-spin inline-block">⟳</span> 캡쳐 중...</>
          ) : (
            <>💬 이 진단결과 게시판에 공유하기</>
          )}
        </button>

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
