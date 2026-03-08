'use client'
import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { v4 as uuidv4 } from 'uuid'
import type { ChatMessage, DiagnosticQuestion, DiagnosisResult, Vehicle } from '@/types'
import { getOrCreateGuestSessionId, createMessage } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'
import ChatHeader from '@/components/chat/ChatHeader'
import MessageBubble from '@/components/chat/MessageBubble'
import QuestionChoices from '@/components/chat/QuestionChoices'
import DiagnosisResultCard from '@/components/diagnosis/DiagnosisResultCard'
import ChatInput from '@/components/chat/ChatInput'
import TypingIndicator from '@/components/chat/TypingIndicator'
import LoginGateModal from '@/components/shared/LoginGateModal'

export default function ChatPage() {
  const router = useRouter()
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const supabase = createClient()

  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [conversationId] = useState(() => uuidv4())
  const [currentQuestions, setCurrentQuestions] = useState<DiagnosticQuestion[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [showLoginGate, setShowLoginGate] = useState(false)
  const [diagnosisResult, setDiagnosisResult] = useState<DiagnosisResult | null>(null)
  const [uploadedImages, setUploadedImages] = useState<string[]>([])
  const [vehicle, setVehicle] = useState<Partial<Vehicle> | null>(null)
  const [user, setUser] = useState<{ id: string } | null>(null)
  const [pendingAnswers, setPendingAnswers] = useState<Record<string, string>>({})

  // 초기화
  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      setUser(user)

      // 등록된 차량 불러오기
      if (user) {
        const { data: vehicles } = await supabase
          .from('vehicles')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(1)
        if (vehicles && vehicles.length > 0) {
          setVehicle(vehicles[0])
        }
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
    const guestId = getOrCreateGuestSessionId()
    const urls: string[] = []

    for (const file of files.slice(0, 3)) {
      const path = `${user?.id ?? guestId}/${conversationId}/${uuidv4()}.${file.name.split('.').pop()}`
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
    const guestId = getOrCreateGuestSessionId()

    // 답변 누적
    const newAnswers = questionId
      ? { ...pendingAnswers, [questionId]: content }
      : pendingAnswers

    if (questionId) {
      setPendingAnswers(newAnswers)
    }

    const userMsg = createMessage('user', content, type, {
      questionId,
      selectedChoice: content,
      images: type === 'text' ? uploadedImages : undefined,
    }) as ChatMessage

    const newMessages = [...messages, userMsg]
    setMessages(newMessages)
    setCurrentQuestions([])
    setIsLoading(true)

    // 로그인 게이트: 2~3번째 질문 답변 후 표시
    const answerCount = newMessages.filter(m => m.type === 'answer').length
    if (answerCount >= 2 && !user && !showLoginGate) {
      setShowLoginGate(true)
      setIsLoading(false)
      return
    }

    try {
      const response = await fetch('/api/diagnose', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-guest-session-id': guestId,
        },
        body: JSON.stringify({
          conversationId,
          vehicleInfo: vehicle,
          messages: newMessages,
          symptomImages: uploadedImages,
          isReDiagnosis: false,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        if (data.error === 'GUEST_LIMIT_REACHED') {
          setShowLoginGate(true)
          setIsLoading(false)
          return
        }
        throw new Error(data.error)
      }

      if (data.data.needsMoreInfo && data.data.additionalQuestions?.length > 0) {
        // 추가 질문 표시
        const questions: DiagnosticQuestion[] = data.data.additionalQuestions
        const questionText = `정확한 진단을 위해 몇 가지 더 확인해 드릴게요.`
        const aiMsg = createMessage('assistant', questionText, 'question', {}) as ChatMessage
        setMessages(prev => [...prev, aiMsg])
        setCurrentQuestions(questions)
      } else {
        // 최종 진단 결과
        const result: DiagnosisResult = data.data.result
        setDiagnosisResult(result)
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
  }, [messages, pendingAnswers, user, vehicle, uploadedImages, conversationId, showLoginGate])

  // 자가점검 결과 재진단
  const handleSelfCheckSubmit = async (selfCheckResults: string) => {
    const reDiagMsg = createMessage('user', `자가점검 결과: ${selfCheckResults}`, 'self_check_input') as ChatMessage
    const newMessages = [...messages, reDiagMsg]
    setMessages(newMessages)
    setIsLoading(true)

    try {
      const guestId = getOrCreateGuestSessionId()
      const response = await fetch('/api/diagnose', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-guest-session-id': guestId,
        },
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
      <ChatHeader vehicle={vehicle} onBack={() => router.push('/')} />

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

        {/* 타이핑 인디케이터 */}
        {isLoading && <TypingIndicator />}

        <div ref={messagesEndRef} />
      </div>

      {/* 입력창 */}
      {!diagnosisResult && !isLoading && currentQuestions.length === 0 && (
        <ChatInput
          onSend={(text) => sendMessage(text)}
          onImageUpload={handleImageUpload}
          uploadedImages={uploadedImages}
          onRemoveImage={(url) => setUploadedImages(prev => prev.filter(u => u !== url))}
          disabled={isLoading}
        />
      )}

      {/* 로그인 게이트 모달 */}
      {showLoginGate && (
        <LoginGateModal
          onLogin={() => router.push('/login?redirect=/chat')}
          onSkip={() => {
            setShowLoginGate(false)
            // 게스트로 계속 진행
            if (messages.length > 0) {
              const lastUserMsg = [...messages].reverse().find(m => m.role === 'user')
              if (lastUserMsg) {
                setIsLoading(true)
                // 진단 강제 실행
                const guestId = getOrCreateGuestSessionId()
                fetch('/api/diagnose', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json', 'x-guest-session-id': guestId },
                  body: JSON.stringify({ conversationId, vehicleInfo: vehicle, messages, symptomImages: uploadedImages }),
                })
                  .then(r => r.json())
                  .then(data => {
                    if (data.data?.result) {
                      setDiagnosisResult(data.data.result)
                      const msg = createMessage('assistant', data.data.result.summary, 'result', { result: data.data.result }) as ChatMessage
                      setMessages(prev => [...prev, msg])
                    }
                  })
                  .finally(() => setIsLoading(false))
              }
            }
          }}
        />
      )}
    </div>
  )
}
