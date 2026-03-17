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

// 이미지를 canvas로 리사이즈 후 base64 반환 (휴대폰 사진 크기 축소용)
function resizeAndEncodeImage(file: File, maxPx: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    const url = URL.createObjectURL(file)
    img.onload = () => {
      const scale = Math.min(1, maxPx / Math.max(img.width, img.height))
      const w = Math.round(img.width * scale)
      const h = Math.round(img.height * scale)
      const canvas = document.createElement('canvas')
      canvas.width = w
      canvas.height = h
      canvas.getContext('2d')!.drawImage(img, 0, 0, w, h)
      URL.revokeObjectURL(url)
      const dataUrl = canvas.toDataURL('image/jpeg', 0.85)
      resolve(dataUrl.split(',')[1]) // base64 부분만
    }
    img.onerror = reject
    img.src = url
  })
}

// 비증상 입력 패턴
const GREETING_PATTERNS = ['안녕', '안녕하세요', '안녕히', 'hi', 'hello', '헬로', '반가워', '반갑습니다', '테스트', 'test']
function isNonSymptom(text: string): boolean {
  const t = text.trim().toLowerCase()
  if (t.length <= 2) return true
  return GREETING_PATTERNS.some(g => t === g || t === g + '!' || t === g + '요')
}

export default function ChatV2Page() {
  const router = useRouter()
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const supabase = createClient()

  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [conversationId] = useState(() => uuidv4())
  const [currentQuestions, setCurrentQuestions] = useState<DiagnosticQuestion[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [diagnosisResult, setDiagnosisResult] = useState<DiagnosisResult | null>(null)
  const [uploadedImages, setUploadedImages] = useState<string[]>([])
  const [uploadedImagesB64, setUploadedImagesB64] = useState<Array<{data: string; mediaType: string}>>([])
  // ref로 최신값 항상 참조 (useCallback stale closure 완전 방지)
  const uploadedImagesB64Ref = useRef<Array<{data: string; mediaType: string}>>([])
  const uploadedImagesRef = useRef<string[]>([])
  const [vehicle, setVehicle] = useState<Partial<Vehicle> | null>(null)
  const [user, setUser] = useState<{ id: string } | null>(null)
  const [showWorkshopCTA, setShowWorkshopCTA] = useState(false)
  const [postChatHistory, setPostChatHistory] = useState<Array<{ role: 'user' | 'assistant'; content: string }>>([])
  const [diagStep, setDiagStep] = useState(1)

  useEffect(() => {
    const init = async () => {
      const { data: { user: authUser } } = await supabase.auth.getUser()
      if (!authUser) {
        router.replace('/login?redirect=/chat-v2')
        return
      }
      setUser(authUser)

      const { data: vehicles } = await supabase
        .from('vehicles')
        .select('*')
        .eq('user_id', authUser.id)
        .order('created_at', { ascending: false })
        .limit(1)
      if (vehicles && vehicles.length > 0) {
        setVehicle(vehicles[0])
      }

      setMessages([{
        id: uuidv4(),
        role: 'assistant',
        type: 'text',
        content: '안녕하세요! 저는 정비톡 AI입니다. 🚗\n\n현재 차량의 어떤 증상이 불편하신가요? 최대한 자세히 알려주시면 더 정확하게 분석해 드릴 수 있어요.',
        timestamp: new Date().toISOString(),
      }])
    }
    init()
  }, [])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isLoading])

  const handleImageUpload = async (files: File[]) => {
    if (!user) return []
    const urls: string[] = []
    const b64List: Array<{data: string; mediaType: string}> = []

    for (const file of files.slice(0, 3)) {
      // 1) canvas로 1024px 이하 리사이즈 후 base64 (휴대폰 사진 크기 축소)
      const b64 = await resizeAndEncodeImage(file, 1024)
      b64List.push({ data: b64, mediaType: 'image/jpeg' })

      // 2) Supabase에도 저장 (기록용)
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

    const newUrls = [...uploadedImagesRef.current, ...urls].slice(0, 3)
    const newB64 = [...uploadedImagesB64Ref.current, ...b64List].slice(0, 3)
    uploadedImagesRef.current = newUrls
    uploadedImagesB64Ref.current = newB64
    setUploadedImages(newUrls)
    setUploadedImagesB64(newB64)
    return urls
  }

  const sendMessage = useCallback(async (content: string, type: 'text' | 'answer' = 'text', questionId?: string) => {
    // 비증상 입력 가드
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

    // 진단 완료 후 자유 질문 모드
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

    const newMessages = [...messages, userMsg]
    setMessages(newMessages)
    setCurrentQuestions([])
    setIsLoading(true)
    if (diagStep === 1) setDiagStep(2)

    try {
      // ▶ V2 엔드포인트 사용
      const response = await fetch('/api/diagnose-v2', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversationId,
          vehicleInfo: vehicle,
          messages: newMessages,
          symptomImages: uploadedImagesRef.current,
          symptomImagesB64: uploadedImagesB64Ref.current,
          isReDiagnosis: false,
        }),
      })

      const data = await response.json()
      if (!response.ok) throw new Error(data.error)

      if (data.data.needsMoreInfo && data.data.additionalQuestions?.length > 0) {
        const questions: DiagnosticQuestion[] = data.data.additionalQuestions
        const aiMsg = createMessage('assistant', '정확한 진단을 위해 몇 가지 더 확인해 드릴게요.', 'question', {}) as ChatMessage
        setMessages(prev => [...prev, aiMsg])
        setCurrentQuestions(questions)
        setDiagStep(prev => Math.min(3, prev + 1))
      } else if (data.data.lowConfidence) {
        const msg = createMessage(
          'assistant',
          '4번의 질문으로도 원인을 하나로 특정하기 어렵습니다.\n\n증상이 여러 부위에 걸쳐 있거나, 직접 보지 않으면 판단이 어려운 경우입니다. 파트너 정비소에서 직접 점검받아 보시길 권장합니다.',
          'text'
        ) as ChatMessage
        setMessages(prev => [...prev, msg])
        setShowWorkshopCTA(true)
      } else {
        const result: DiagnosisResult = data.data.result!
        setDiagnosisResult(result)
        setDiagStep(4)
        const resultMsg = createMessage('assistant', result.summary, 'result', { result }) as ChatMessage
        setMessages(prev => [...prev, resultMsg])
      }
    } catch {
      const errMsg = createMessage('assistant', '죄송합니다, 진단 처리 중 오류가 발생했습니다. 다시 시도해 주세요.', 'text') as ChatMessage
      setMessages(prev => [...prev, errMsg])
    } finally {
      setIsLoading(false)
      uploadedImagesRef.current = []
      uploadedImagesB64Ref.current = []
      setUploadedImages([])
      setUploadedImagesB64([])
    }
  }, [messages, user, vehicle, conversationId])

  const handleSelfCheckSubmit = async (selfCheckResults: string) => {
    const reDiagMsg = createMessage('user', `자가점검 결과: ${selfCheckResults}`, 'self_check_input') as ChatMessage
    const newMessages = [...messages, reDiagMsg]
    setMessages(newMessages)
    setIsLoading(true)

    try {
      const response = await fetch('/api/diagnose-v2', {
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
      {/* V2 배지 표시 */}
      <div className="bg-amber-50 border-b border-amber-200 px-4 py-1.5 text-center">
        <span className="text-xs text-amber-700 font-medium">🧪 실험 버전 (V2) — AI 직접 질문 생성</span>
      </div>

      <ChatHeader vehicle={vehicle} onBack={() => router.push('/main')} step={diagStep} totalSteps={4} />

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

        {currentQuestions.length > 0 && !isLoading && (
          <QuestionChoices
            questions={currentQuestions}
            onAnswer={(questionId, answer) => sendMessage(answer, 'answer', questionId)}
          />
        )}

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
