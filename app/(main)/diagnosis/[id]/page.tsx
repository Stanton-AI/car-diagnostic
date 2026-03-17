'use client'
import { useEffect, useState, useCallback, useRef } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import DiagnosisResultCard from '@/components/diagnosis/DiagnosisResultCard'
import type { DiagnosisResult, ChatMessage } from '@/types'
import { createMessage } from '@/lib/utils'

// ── 대화 내역 섹션 ─────────────────────────────────────────────────────────
const SKIP_PREFIXES = ['🚗 내 차', '🔍 앱에 등록되지 않은 차', '🔍 다른 분의 차', '차량 정보 입력:', '✅ 진단 분석이 완료']
const SKIP_TYPES = ['result', 're_diagnosis', 'self_check_input']

function ConversationHistory({ messages }: { messages: ChatMessage[] }) {
  const [open, setOpen] = useState(false)

  const filtered = messages.filter(m =>
    !SKIP_TYPES.includes(m.type as string) &&
    !SKIP_PREFIXES.some(p => m.content?.startsWith(p))
  )
  if (filtered.length === 0) return null

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      {/* 헤더 토글 */}
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-4 py-3.5 hover:bg-gray-50 transition-colors"
      >
        <div className="flex items-center gap-2">
          <span className="text-base">💬</span>
          <span className="text-sm font-bold text-gray-800">진단 대화 내역</span>
          <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">{filtered.length}건</span>
        </div>
        <span className={`text-gray-400 text-sm transition-transform duration-200 ${open ? 'rotate-180' : ''}`}>▾</span>
      </button>

      {/* 메시지 목록 */}
      {open && (
        <div className="px-4 pb-4 space-y-2 border-t border-gray-100 pt-3">
          {filtered.map((msg) => {
            const isUser = msg.role === 'user'
            const isQuestion = msg.type === 'question'
            return (
              <div key={msg.id} className={`flex gap-2 ${isUser ? 'justify-end' : 'justify-start'}`}>
                {/* AI 아바타 */}
                {!isUser && (
                  <div className="w-6 h-6 bg-primary-600 rounded-lg flex-shrink-0 flex items-center justify-center mt-0.5">
                    <span className="text-white text-[10px] font-black">M</span>
                  </div>
                )}
                <div className={`max-w-[80%] ${isUser ? 'order-first' : ''}`}>
                  {/* 질문 배지 */}
                  {isQuestion && (
                    <p className="text-[10px] text-primary-500 font-semibold mb-0.5 ml-1">🔍 추가 질문</p>
                  )}
                  {msg.type === 'answer' && (
                    <p className="text-[10px] text-gray-400 font-medium mb-0.5 mr-1 text-right">선택한 답변</p>
                  )}
                  <div className={`px-3 py-2 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap break-words ${
                    isUser
                      ? 'bg-primary-600 text-white rounded-tr-sm'
                      : isQuestion
                        ? 'bg-primary-50 text-gray-800 border border-primary-100 rounded-tl-sm'
                        : 'bg-gray-100 text-gray-800 rounded-tl-sm'
                  }`}>
                    {msg.content}
                  </div>
                  {/* 질문 선택지 미리보기 */}
                  {isQuestion && msg.metadata?.choices && (
                    <div className="mt-1 ml-1 flex flex-wrap gap-1">
                      {(msg.metadata.choices as string[]).slice(0, 3).map((c, i) => (
                        <span key={i} className="text-[10px] text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">{c}</span>
                      ))}
                      {(msg.metadata.choices as string[]).length > 3 && (
                        <span className="text-[10px] text-gray-400">+{(msg.metadata.choices as string[]).length - 3}개</span>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ── 사후 채팅 메시지 타입 ────────────────────────────────────────────────
interface PostChatMsg { role: 'user' | 'assistant'; content: string; id: string }

export default function DiagnosisPage() {
  const params = useParams()
  const id = params.id as string
  const router = useRouter()
  const supabase = createClient()
  const bottomRef = useRef<HTMLDivElement>(null)

  const [conversation, setConversation] = useState<any>(null)
  const [primaryResult, setPrimaryResult] = useState<DiagnosisResult | null>(null)
  const [rediagnosisResult, setRediagnosisResult] = useState<DiagnosisResult | null>(null)
  const [isRediagnosing, setIsRediagnosing] = useState(false)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [retryCount, setRetryCount] = useState(0)
  // 재진단 실행 횟수 — 카드 key로 사용해 새 결과마다 리셋(펼침) 보장
  const [rediagnosisCount, setRediagnosisCount] = useState(0)

  // ── 사후 채팅 상태 ────────────────────────────────────────────────────
  const [postMessages, setPostMessages] = useState<PostChatMsg[]>([])
  const [chatInput, setChatInput] = useState('')
  const [chatLoading, setChatLoading] = useState(false)

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

  // ── 스크롤 아래로 ─────────────────────────────────────────────────────
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [postMessages, chatLoading])

  // ── 사후 채팅 전송 (추가 정보 반영 재진단) ───────────────────────────
  const handlePostChat = useCallback(async () => {
    const text = chatInput.trim()
    if (!text || !primaryResult || chatLoading) return
    setChatInput('')

    const userMsg: PostChatMsg = { role: 'user', content: text, id: crypto.randomUUID() }
    setPostMessages(prev => [...prev, userMsg])
    setChatLoading(true)

    // 기존 conversation.messages + 이전 사후채팅 + 새 메시지 합산
    const existingMessages: ChatMessage[] = Array.isArray(conversation?.messages)
      ? conversation.messages : []
    const prevPostAsMessages: ChatMessage[] = postMessages.map(m => ({
      id: m.id,
      role: m.role,
      type: 'text' as const,
      content: m.content,
      timestamp: new Date().toISOString(),
    }))
    const newUserMsg: ChatMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      type: 'text',
      content: text,
      timestamp: new Date().toISOString(),
    }
    const allMessages = [...existingMessages, ...prevPostAsMessages, newUserMsg]

    try {
      const res = await fetch('/api/diagnose', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversationId: id,
          messages: allMessages,
          isReDiagnosis: true,
        }),
      })
      const data = await res.json()
      if (data.success && data.data?.result) {
        setRediagnosisResult(data.data.result)
        setRediagnosisCount(c => c + 1)
        const aiMsg: PostChatMsg = {
          role: 'assistant',
          content: '추가 정보를 반영하여 진단 리포트를 업데이트했습니다. ↑ 위의 갱신된 리포트를 확인해 주세요.',
          id: crypto.randomUUID(),
        }
        setPostMessages(prev => [...prev, aiMsg])
      } else {
        const aiMsg: PostChatMsg = { role: 'assistant', content: '재진단 처리 중 오류가 발생했어요. 다시 시도해 주세요.', id: crypto.randomUUID() }
        setPostMessages(prev => [...prev, aiMsg])
      }
    } catch {
      const errMsg: PostChatMsg = { role: 'assistant', content: '오류가 발생했어요. 다시 시도해 주세요.', id: crypto.randomUUID() }
      setPostMessages(prev => [...prev, errMsg])
    } finally {
      setChatLoading(false)
    }
  }, [chatInput, primaryResult, chatLoading, conversation, postMessages, id])

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
    <div className="flex flex-col h-screen bg-surface-50 max-w-[480px] mx-auto">
      {/* ── 헤더 ── */}
      <header className="bg-white px-5 pt-12 pb-4 flex items-center gap-3 border-b border-gray-100 flex-shrink-0">
        <button onClick={() => router.push('/main')}
          className="w-9 h-9 flex items-center justify-center rounded-full bg-gray-100 hover:bg-gray-200 transition-colors text-gray-600 font-bold">
          ←
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 bg-primary-600 rounded-lg flex items-center justify-center flex-shrink-0">
              <span className="text-white text-xs font-black">M</span>
            </div>
            <h1 className="text-base font-black text-gray-900 truncate">정비톡 AI 진단 리포트</h1>
          </div>
          {createdAt && <p className="text-xs text-gray-400 mt-0.5 ml-8">{createdAt}</p>}
        </div>
      </header>

      {/* ── 스크롤 컨텐츠 영역 ── */}
      <div className="flex-1 overflow-y-auto px-4 py-6 space-y-4">
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
            <div className="flex items-center gap-3 py-2">
              <div className="h-px flex-1 bg-gray-200" />
              <div className="flex items-center gap-1.5 px-3 py-1 bg-amber-50 border border-amber-200 rounded-full">
                <span className="text-amber-600 text-xs">🔄</span>
                <span className="text-xs text-amber-700 font-semibold">추가 정보 반영 재진단</span>
              </div>
              <div className="h-px flex-1 bg-gray-200" />
            </div>
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

        {/* 대화 내역 */}
        {conversation?.messages && Array.isArray(conversation.messages) && (
          <ConversationHistory messages={conversation.messages as ChatMessage[]} />
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

        {/* ── 사후 채팅 구분선 ── */}
        {postMessages.length > 0 && (
          <div className="flex items-center gap-3 py-1">
            <div className="h-px flex-1 bg-gray-200" />
            <span className="text-xs text-gray-400">추가 질문</span>
            <div className="h-px flex-1 bg-gray-200" />
          </div>
        )}

        {/* ── 사후 채팅 메시지 ── */}
        {postMessages.map(msg => (
          <div key={msg.id} className={`flex gap-2 animate-fade-up ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            {msg.role === 'assistant' && (
              <div className="w-7 h-7 bg-primary-600 rounded-xl flex-shrink-0 flex items-center justify-center mt-0.5">
                <span className="text-white text-[10px] font-black">M</span>
              </div>
            )}
            <div className={`max-w-[80%] px-3.5 py-2.5 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap break-words ${
              msg.role === 'user'
                ? 'bg-primary-600 text-white rounded-tr-sm'
                : 'bg-white border border-gray-100 text-gray-800 rounded-tl-sm shadow-sm'
            }`}>
              {msg.content}
            </div>
          </div>
        ))}

        {/* 타이핑 인디케이터 */}
        {chatLoading && (
          <div className="flex gap-2 animate-fade-up">
            <div className="w-7 h-7 bg-primary-600 rounded-xl flex-shrink-0 flex items-center justify-center">
              <span className="text-white text-[10px] font-black">M</span>
            </div>
            <div className="bg-white border border-gray-100 rounded-2xl rounded-tl-sm px-4 py-3 shadow-sm flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
              <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
              <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
            </div>
          </div>
        )}

        <div ref={bottomRef} className="pb-2" />
      </div>

      {/* ── 하단 채팅 입력창 (진단 결과 있을 때만) ── */}
      {primaryResult && (
        <div className="flex-shrink-0 bg-white border-t border-gray-100 px-4 py-3">
          <div className="flex gap-2 items-end">
            <input
              type="text"
              value={chatInput}
              onChange={e => setChatInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handlePostChat() } }}
              placeholder="새로운 증상이나 추가 정보를 입력하면 리포트가 갱신됩니다..."
              disabled={chatLoading}
              className="flex-1 px-4 py-3 text-sm border border-gray-200 rounded-2xl focus:outline-none focus:border-primary-400 bg-gray-50 disabled:opacity-50 transition-colors"
            />
            <button
              onClick={handlePostChat}
              disabled={!chatInput.trim() || chatLoading}
              className="w-11 h-11 bg-primary-600 text-white rounded-2xl flex items-center justify-center hover:bg-primary-700 transition-colors disabled:opacity-40 flex-shrink-0"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>
              </svg>
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
