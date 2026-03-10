'use client'
import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { v4 as uuidv4 } from 'uuid'
import type { ChatMessage, DiagnosticQuestion, DiagnosisResult, Vehicle } from '@/types'
import { createMessage } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'
import ChatHeader from '@/components/chat/ChatHeader'
import MessageBubble from '@/components/chat/MessageBubble'
import QuestionChoices from '@/components/chat/QuestionChoices'
import DiagnosisResultCard from '@/components/diagnosis/DiagnosisResultCard'
import ChatInput from '@/components/chat/ChatInput'
import TypingIndicator from '@/components/chat/TypingIndicator'

// 비증상 입력 패턴 (인사말/짧은 입력 감지)
const GREETING_PATTERNS = ['안녕', '안녕하세요', '안녕히', 'hi', 'hello', '헬로', '반가워', '반갑습니다', '테스트', 'test']
function isNonSymptom(text: string): boolean {
  const t = text.trim().toLowerCase()
  if (t.length <= 2) return true
  return GREETING_PATTERNS.some(g => t === g || t === g + '!' || t === g + '요')
}

export default function ChatPage() {
  const router = useRouter()
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const supabase = createClient()

  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [conversationId] = useState(() => uuidv4())
  const [currentQuestions, setCurrentQuestions] = useState<DiagnosticQuestion[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [diagnosisResult, setDiagnosisResult] = useState<DiagnosisResult | null>(null)
  const [uploadedImages, setUploadedImages] = useState<string[]>([])
  const [vehicle, setVehicle] = useState<Partial<Vehicle> | null>(null)
  const [user, setUser] = useState<{ id: string } | null>(null)
  const [showWorkshopCTA, setShowWorkshopCTA] = useState(false)
  // 진단 후 채팅 히스토리 (멀티턴 유지)
  const [postChatHistory, setPostChatHistory] = useState<Array<{ role: 'user' | 'assistant'; content: string }>>([])
  // 진행 단계 추적 (1=증상입력, 2=1차질문, 3=추가질문, 4=진단완료)
  const [diagStep, setDiagStep] = useState(1)


  // 초기화
  useEffect(() => {
    const init = async () => {
      const { data: { user: authUser } } = await supabase.auth.getUser()
      if (!authUser) {
        router.replace('/login?redirect=/chat')
        return
      }
      setUser(authUser)

      // 등록된 차량 불러오기
      const { data: vehicles } = await supabase
        .from('vehicles')
        .select('*')
        .eq('user_id', authUser.id)
        .order('created_at', { ascending: false })
        .limit(1)
      if (vehicles && vehicles.length > 0) {
        setVehicle(vehicles[0])
      }

      // AI 첫 인사 메시지
      setMessages([{
        id: uuidv4(),
        role: 'assistant',
        type: 'text',
        content: '안녕하세요! 저는 MIKY 자동차 진단 AI입니다. 🚗\n\n현재 차량의 어떤 증상이 불편하신가요? 최대한 자세히 알려주시면 더 정확하게 분석해 드릴 수 있어요.',
        timestamp: new Date().toISOString(),
      }])
    }
    init()
  }, [])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isLoading])

  // 이미지 업로드
  const handleImageUpload = async (files: File[]) => {
    if (!user) return []
    const urls: string[] = []

    for (const file of files.slice(0, 3)) {
      const path = `${user.id}/${conversationId}/${uuidv4()}.${file.name.split('.').pop()}`
      const { data, error } = await supabase.storage
        .from('symptom-images')
        .upload(path, file)

      if (!error && data) {
        const { data: { publicUrl } } = supabase.storage
          .from('symptom-images')
          .getPublicUrl(data.path)
        urls.push(publicUrl)
      }
    }

    setUploadedImages(prev => [...prev, ...urls].slice(0, 3))
    return urls
  }

  // 메시지 전송 및 AI 호출
  const sendMessage = useCallback(async (content: string, type: 'text' | 'answer' = 'text', questionId?: string) => {
    // 진단 전 초기 입력이 비증상(인사말 등)이면 안내 메시지로 대체
    if (type === 'text' && !diagnosisResult && !messages.some(m => m.type === 'question') && isNonSymptom(content)) {
      const userMsg = createMessage('user', content, 'text') as ChatMessage
      const guideMsg = createMessage('assistant', '안녕하세요! 😊\n\n어떤 차량 증상으로 불편하신지 알려주세요. 예를 들어:\n• "브레이크 밟을 때 끼익 소리가 나요"\n• "시동 걸 때 진동이 심해요"\n• "에어컨이 차갑지 않아요"', 'text') as ChatMessage
      setMessages(prev => [...prev, userMsg, guideMsg])
      return
    }

    const userMsg = createMessage('user', content, type, {
      questionId,
      selectedChoice: content,
      images: type === 'text' ? uploadedImages : undefined,
    }) as ChatMessage

    // ── 진단 완료 후: 결과에 대한 자유 질문 모드 ──────────────────────
    if (diagnosisResult && type === 'text') {
      setMessages(prev => [...prev, userMsg])
      setIsLoading(true)
      const newHistory = [...postChatHistory, { role: 'user' as const, content }]
      const diagnosisContext = `
진단 결과 요약: ${diagnosisResult.summary}
예상 원인:
${diagnosisResult.causes.map((c, i) => `${i + 1}. ${c.name}${c.enName ? ` (${c.enName})` : ''} - ${c.description}`).join('\n')}
긴급도: ${diagnosisResult.urgency} - ${diagnosisResult.urgencyReason}
예상 비용: ${diagnosisResult.cost.total.toLocaleString()}원 (부품비 ${diagnosisResult.cost.parts.toLocaleString()}원 + 공임비 ${diagnosisResult.cost.labor.toLocaleString()}원)
      `.trim()

      try {
        const res = await fetch('/api/assist', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ type: 'result_chat', userMessage: content, diagnosisContext, chatHistory: postChatHistory }),
        })
        const data = await res.json()
        const aiMsg = createMessage('assistant', data.answer ?? '답변을 불러오지 못했어요.', 'text') as ChatMessage
        setMessages(prev => [...prev, aiMsg])
        setPostChatHistory([...newHistory, { role: 'assistant', content: data.answer }])
      } catch {
        const errMsg = createMessage('assistant', '오류가 발생했어요. 다시 시도해 주세요.', 'text') as ChatMessage
        setMessages(prev => [...prev, errMsg])
      } finally {
        setIsLoading(false)
      }
      return
    }
    // ────────────────────────────────────────────────────────────────────

    const newMessages = [...messages, userMsg]
    setMessages(newMessages)
    setCurrentQuestions([])
    setIsLoading(true)
    if (diagStep === 1) setDiagStep(2)

    try {
      const response = await fetch('/api/diagnose', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversationId,
          vehicleInfo: vehicle,
          messages: newMessages,
          symptomImages: uploadedImages,
          isReDiagnosis: false,
        }),
      })

      const data = await response.json()
      if (!response.ok) throw new Error(data.error)

      if (data.data.needsMoreInfo && data.data.additionalQuestions?.length > 0) {
        // 추가 질문
        const questions: DiagnosticQuestion[] = data.data.additionalQuestions
        const aiMsg = createMessage('assistant', '정확한 진단을 위해 몇 가지 더 확인해 드릴게요.', 'question', {}) as ChatMessage
        setMessages(prev => [...prev, aiMsg])
        setCurrentQuestions(questions)
        setDiagStep(prev => Math.min(3, prev + 1))
      } else if (data.data.lowConfidence) {
        // 5회 질문 후에도 원인 특정 불가 (confidence < 40%)
        const msg = createMessage(
          'assistant',
          '4번의 질문으로도 원인을 하나로 특정하기 어렵습니다.\n\n증상이 여러 부위에 걸쳐 있거나, 직접 보지 않으면 판단이 어려운 경우입니다. 파트너 정비소에서 직접 점검받아 보시길 권장합니다.',
          'text'
        ) as ChatMessage
        setMessages(prev => [...prev, msg])
        setShowWorkshopCTA(true)
      } else {
        // 정상 진단 결과
        const result: DiagnosisResult = data.data.result!
        setDiagnosisResult(result)
        setDiagStep(4)
        const resultMsg = createMessage('assistant', result.summary, 'result', { result }) as ChatMessage
        setMessages(prev => [...prev, resultMsg])
      }
    } catch (error) {
      const errMsg = createMessage('assistant', '죄송합니다, 진단 처리 중 오류가 발생했습니다. 다시 시도해 주세요.', 'text') as ChatMessage
      setMessages(prev => [...prev, errMsg])
    } finally {
      setIsLoading(false)
      setUploadedImages([])
    }
  }, [messages, user, vehicle, uploadedImages, conversationId])

  // 자가점검 결과 재진단
  const handleSelfCheckSubmit = async (selfCheckResults: string) => {
    const reDiagMsg = createMessage('user', `자가점검 결과: ${selfCheckResults}`, 'self_check_input') as ChatMessage
    const newMessages = [...messages, reDiagMsg]
    setMessages(newMessages)
    setIsLoading(true)

    try {
      const response = await fetch('/api/diagnose', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversationId,
          vehicleInfo: vehicle,
          messages: newMessages,
          symptomImages: uploadedImages,
          isReDiagnosis: true,
        }),
      })
      const data = await response.json()
      if (data.success) {
        const result: DiagnosisResult = data.data.result
        setDiagnosisResult(result)
        const msg = createMessage('assistant', '자가점검 결과를 반영하여 진단을 업데이트했습니다.', 're_diagnosis', { result }) as ChatMessage
        setMessages(prev => [...prev, msg])
      }
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="flex flex-col h-screen bg-white">
      <ChatHeader vehicle={vehicle} onBack={() => router.push('/main')} step={diagStep} totalSteps={4} />

      {/* 메시지 영역 */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4 bg-surface-50">
        {messages.map((msg) => (
          <div key={msg.id} className="animate-fade-up">
            {(msg.type === 'result' || msg.type === 're_diagnosis') && msg.metadata?.result ? (
              <DiagnosisResultCard
                result={msg.metadata.result as DiagnosisResult}
                conversationId={conversationId}
                onSelfCheckSubmit={handleSelfCheckSubmit}
              />
            ) : (
              <MessageBubble message={msg} />
            )}
          </div>
        ))}

        {/* 추가 질문 선택지 */}
        {currentQuestions.length > 0 && !isLoading && (
          <QuestionChoices
            questions={currentQuestions}
            onAnswer={(questionId, answer) => sendMessage(answer, 'answer', questionId)}
          />
        )}

        {/* 원인 특정 불가 — 정비소 연결 CTA */}
        {showWorkshopCTA && !isLoading && (
          <div className="flex items-start gap-2 animate-fade-up">
            <div className="w-8 h-8 bg-primary-600 rounded-xl flex-shrink-0 flex items-center justify-center shadow-sm mt-1">
              <span className="text-white text-xs font-black">M</span>
            </div>
            <div className="flex flex-col gap-2 flex-1 max-w-[90%]">
              <button
                onClick={() => router.push('/workshops')}
                className="w-full py-3 bg-primary-600 text-white rounded-xl text-sm font-semibold hover:bg-primary-700 transition-colors shadow-sm"
              >
                🔧 가까운 파트너 정비소 찾기
              </button>
              <p className="text-xs text-gray-400 text-center">
                정비소 방문 시 대화 내역을 보여주시면 도움이 됩니다
              </p>
            </div>
          </div>
        )}

        {isLoading && <TypingIndicator />}
        <div ref={messagesEndRef} />
      </div>

      {/* 입력창 — 진단 전: 증상 입력 / 진단 후: 결과 질문 */}
      {!isLoading && currentQuestions.length === 0 && (
        <ChatInput
          onSend={(text) => sendMessage(text)}
          onImageUpload={handleImageUpload}
          uploadedImages={uploadedImages}
          onRemoveImage={(url) => setUploadedImages(prev => prev.filter(u => u !== url))}
          disabled={isLoading}
          placeholder={diagnosisResult ? '진단 결과에 대해 궁금한 점을 물어보세요...' : undefined}
        />
      )}
    </div>
  )
}
