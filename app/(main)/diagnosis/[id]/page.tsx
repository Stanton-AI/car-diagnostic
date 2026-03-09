'use client'
import { useEffect, useState, useCallback } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { v4 as uuidv4 } from 'uuid'
import { createClient } from '@/lib/supabase/client'
import DiagnosisResultCard from '@/components/diagnosis/DiagnosisResultCard'
import type { DiagnosisResult, ChatMessage } from '@/types'
import { createMessage } from '@/lib/utils'

export default function DiagnosisPage() {
  const params = useParams()
  const id = params.id as string
  const router = useRouter()
  const supabase = createClient()

  const [conversation, setConversation] = useState<any>(null)
  const [primaryResult, setPrimaryResult] = useState<DiagnosisResult | null>(null)
  const [rediagnosisResult, setRediagnosisResult] = useState<DiagnosisResult | null>(null)
  const [isRediagnosing, setIsRediagnosing] = useState(false)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [retryCount, setRetryCount] = useState(0)
  // 재진단 실행 횟수 — 카드 key로 사용해 새 결과마다 리셋(펼침) 보장
  const [rediagnosisCount, setRediagnosisCount] = useState(0)

  // ── 대화 로드 ────────────────────────────────────────────────────────
  useEffect(() => {
    let mounted = true
    const load = async (attempt = 0) => {
      const { data, error } = await supabase
        .from('conversations')
        .select('*')
        .eq('id', id)
        .single()

      if (!mounted) return

      if (error || !data) {
        // 첫 접근 시 아직 저장 중일 수 있으므로 최대 3회 재시도
        if (attempt < 3) {
          setTimeout(() => load(attempt + 1), 1000)
          return
        }
        setNotFound(true)
        setLoading(false)
        return
      }

      setConversation(data)
      setPrimaryResult(data.final_result ?? null)
      if (data.self_check_result) setRediagnosisResult(data.self_check_result)
      setLoading(false)
    }
    load()
    return () => { mounted = false }
  }, [id, retryCount])

  // ── 자가점검 재진단 ──────────────────────────────────────────────────
  const handleSelfCheckSubmit = useCallback(async (selfCheckResults: string) => {
    if (!conversation || !primaryResult) return
    setIsRediagnosing(true)

    try {
      // 기존 메시지에 자가점검 결과 메시지 추가
      const existingMessages: ChatMessage[] = Array.isArray(conversation.messages)
        ? conversation.messages : []
      const selfCheckMsg = createMessage('user', `자가점검 결과: ${selfCheckResults}`, 'self_check_input') as ChatMessage
      const newMessages = [...existingMessages, selfCheckMsg]

      // 기존 메시지에서 차량 정보 복원 시도
      const vehicleInfo = conversation.initial_symptom ? null : null // 대화 컨텍스트로 충분

      const response = await fetch('/api/diagnose', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversationId: id,
          vehicleInfo,
          messages: newMessages,
          isReDiagnosis: true,
        }),
      })
      const data = await response.json()

      if (data.success && data.data?.result) {
        setRediagnosisResult(data.data.result)
        setRediagnosisCount(c => c + 1)   // 카드 리셋(펼침) 트리거
        // 잠시 후 최신 데이터 새로고침
        setTimeout(() => setRetryCount(c => c + 1), 500)
      }
    } catch (err) {
      console.error('Re-diagnosis error:', err)
    } finally {
      setIsRediagnosing(false)
    }
  }, [conversation, primaryResult, id])

  // ── 로딩 상태 ────────────────────────────────────────────────────────
  if (loading) return (
    <div className="flex items-center justify-center min-h-screen bg-surface-50">
      <div className="text-center space-y-3">
        <div className="w-12 h-12 border-2 border-primary-200 border-t-primary-600 rounded-full animate-spin mx-auto" />
        <p className="text-sm text-gray-500">진단 결과를 불러오는 중...</p>
      </div>
    </div>
  )

  if (notFound || !primaryResult) return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-surface-50 px-6 text-center">
      <span className="text-5xl mb-4">🔍</span>
      <h2 className="text-lg font-bold text-gray-900 mb-2">결과를 찾을 수 없어요</h2>
      <p className="text-sm text-gray-500 mb-6">진단 결과가 아직 저장 중이거나 존재하지 않습니다.</p>
      <button onClick={() => router.push('/main')}
        className="py-3 px-6 bg-primary-600 text-white rounded-2xl font-semibold text-sm hover:bg-primary-700 transition-colors">
        메인으로 돌아가기
      </button>
    </div>
  )

  const createdAt = conversation?.created_at
    ? new Date(conversation.created_at).toLocaleString('ko-KR', { month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })
    : ''

  return (
    <div className="flex flex-col min-h-screen bg-surface-50 max-w-[480px] mx-auto">
      {/* ── 헤더 ── */}
      <header className="bg-white px-5 pt-12 pb-4 flex items-center gap-3 border-b border-gray-100 sticky top-0 z-10">
        <button onClick={() => router.push('/main')}
          className="w-9 h-9 flex items-center justify-center rounded-full bg-gray-100 hover:bg-gray-200 transition-colors text-gray-600 font-bold">
          ←
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 bg-primary-600 rounded-lg flex items-center justify-center flex-shrink-0">
              <span className="text-white text-xs font-black">M</span>
            </div>
            <h1 className="text-base font-black text-gray-900 truncate">MIKY 진단 리포트</h1>
          </div>
          {createdAt && <p className="text-xs text-gray-400 mt-0.5 ml-8">{createdAt}</p>}
        </div>
      </header>

      {/* ── 컨텐츠 ── */}
      <div className="flex-1 px-4 py-6 space-y-4 pb-10">
        {/* 초기 진단 결과 — 재진단이 있으면 접힌 채로 시작 + 자가점검 비활성화 */}
        <DiagnosisResultCard
          key={rediagnosisResult ? 'primary-collapsed' : 'primary-open'}
          result={primaryResult}
          conversationId={id}
          onSelfCheckSubmit={rediagnosisResult ? undefined : handleSelfCheckSubmit}
          defaultExpanded={!rediagnosisResult}
        />

        {/* 재진단 로딩 */}
        {isRediagnosing && (
          <div className="flex items-center justify-center py-8 gap-3 text-primary-600 bg-white rounded-2xl border border-primary-100 animate-fade-up">
            <div className="w-6 h-6 border-2 border-primary-200 border-t-primary-600 rounded-full animate-spin" />
            <span className="text-sm font-medium">자가점검 결과 기반 재진단 중...</span>
          </div>
        )}

        {/* 재진단 결과 */}
        {rediagnosisResult && !isRediagnosing && (
          <div className="space-y-3 animate-fade-up">
            {/* 구분선 */}
            <div className="flex items-center gap-3 py-2">
              <div className="h-px flex-1 bg-gray-200" />
              <div className="flex items-center gap-1.5 px-3 py-1 bg-amber-50 border border-amber-200 rounded-full">
                <span className="text-amber-600 text-xs">🔄</span>
                <span className="text-xs text-amber-700 font-semibold">자가점검 반영 재진단</span>
              </div>
              <div className="h-px flex-1 bg-gray-200" />
            </div>

            {/* 재진단 결과 카드 — 새 재진단마다 key 변경으로 리셋(항상 펼침) */}
            <DiagnosisResultCard
              key={`rediagnosis-${rediagnosisCount}`}
              result={rediagnosisResult}
              conversationId={id}
              onSelfCheckSubmit={handleSelfCheckSubmit}
              defaultExpanded={true}
              isRediagnosis={true}
            />
          </div>
        )}

        {/* 하단 액션 */}
        <div className="space-y-2 pt-2">
          <button onClick={() => router.push('/main')}
            className="w-full py-4 bg-primary-600 text-white rounded-2xl font-bold text-sm hover:bg-primary-700 transition-all active:scale-[0.98] shadow-lg shadow-primary-200">
            🔧 새로운 증상 진단하기
          </button>
          <button onClick={() => router.push('/main')}
            className="w-full py-3.5 bg-white border border-gray-200 text-gray-600 rounded-2xl font-medium text-sm hover:bg-gray-50 transition-colors">
            홈으로 돌아가기
          </button>
        </div>
      </div>
    </div>
  )
}
