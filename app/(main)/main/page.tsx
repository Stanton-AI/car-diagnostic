'use client'
import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { v4 as uuidv4 } from 'uuid'
import type { ChatMessage, DiagnosticQuestion, DiagnosisResult, UserProfile, FuelType } from '@/types'
import { createMessage, urgencyLabel } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'
import MessageBubble from '@/components/chat/MessageBubble'
import QuestionChoices from '@/components/chat/QuestionChoices'
import DiagnosisResultCard from '@/components/diagnosis/DiagnosisResultCard'
import ChatInput from '@/components/chat/ChatInput'
import TypingIndicator from '@/components/chat/TypingIndicator'

const FUEL_LABELS: Record<string, string> = {
  gasoline: '가솔린', diesel: '디젤', hybrid: '하이브리드', electric: '전기', lpg: 'LPG',
}
const MAKERS = ['현대', '기아', '제네시스', 'KG 모빌리티', '르노코리아', 'GM 한국', 'BMW', '메르세데스-벤츠', '아우디', '볼보', '기타']
const FUEL_TYPES: { value: FuelType; label: string }[] = [
  { value: 'gasoline', label: '가솔린' },
  { value: 'diesel', label: '디젤' },
  { value: 'hybrid', label: '하이브리드' },
  { value: 'electric', label: '전기' },
  { value: 'lpg', label: 'LPG' },
]
const CURRENT_YEAR = new Date().getFullYear()
const YEARS = Array.from({ length: CURRENT_YEAR - 1989 }, (_, i) => CURRENT_YEAR - i)

// ── 차량 수정 모달 ────────────────────────────────────────────────────────
function VehicleEditModal({ vehicle, onClose, onSave }: {
  vehicle: any
  onClose: () => void
  onSave: (data: any) => Promise<void>
}) {
  const [form, setForm] = useState({
    maker: vehicle.maker ?? '',
    model: vehicle.model ?? '',
    year: vehicle.year ?? CURRENT_YEAR,
    mileage: String(vehicle.mileage ?? ''),
    fuelType: (vehicle.fuel_type ?? 'gasoline') as FuelType,
    plateNumber: vehicle.plate_number ?? '',
    nickname: vehicle.nickname ?? '',
  })
  const [saving, setSaving] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const set = (key: string, value: unknown) => setForm(prev => ({ ...prev, [key]: value }))

  const validate = () => {
    const errs: Record<string, string> = {}
    if (!form.maker) errs.maker = '제조사를 선택해 주세요'
    if (!form.model.trim()) errs.model = '모델명을 입력해 주세요'
    if (!form.mileage || isNaN(Number(form.mileage))) errs.mileage = '주행거리를 입력해 주세요'
    if (!form.nickname.trim()) errs.nickname = '닉네임을 입력해 주세요'
    else if (form.nickname.trim().length < 2) errs.nickname = '닉네임은 최소 2자'
    else if (form.nickname.trim().length > 10) errs.nickname = '닉네임은 최대 10자'
    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  const handleSave = async () => {
    if (!validate()) return
    setSaving(true)
    await onSave({
      maker: form.maker,
      model: form.model.trim(),
      year: form.year,
      mileage: Number(form.mileage),
      fuel_type: form.fuelType,
      plate_number: form.plateNumber.trim() || null,
      nickname: form.nickname.trim(),
    })
    setSaving(false)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center" onClick={onClose}>
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
      <div
        className="relative w-full max-w-[480px] bg-white rounded-t-3xl pt-5 pb-8 max-h-[90vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        {/* 핸들 */}
        <div className="w-10 h-1 bg-gray-200 rounded-full mx-auto mb-5" />
        <div className="px-5">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-lg font-black text-gray-900">차량 정보 수정</h2>
            <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-100 text-gray-500 text-sm">✕</button>
          </div>

          <div className="space-y-4">
            {/* 닉네임 */}
            <div>
              <label className="text-sm font-bold text-gray-700 mb-1.5 block">차량 닉네임 <span className="text-red-500">*</span></label>
              <input
                value={form.nickname}
                onChange={e => set('nickname', e.target.value)}
                maxLength={10}
                placeholder="예: 날쌘터보"
                className={`w-full px-4 py-3 rounded-xl border text-sm focus:outline-none ${errors.nickname ? 'border-red-300' : 'border-gray-200 focus:border-primary-400'}`}
              />
              {errors.nickname && <p className="text-xs text-red-500 mt-1">{errors.nickname}</p>}
            </div>
            {/* 제조사 */}
            <div>
              <label className="text-sm font-bold text-gray-700 mb-1.5 block">제조사 <span className="text-red-500">*</span></label>
              <div className="grid grid-cols-3 gap-2">
                {MAKERS.map(m => (
                  <button key={m} onClick={() => set('maker', m)}
                    className={`py-2.5 px-3 text-sm rounded-xl border transition-all ${form.maker === m ? 'bg-primary-600 text-white border-primary-600 font-semibold' : 'bg-white text-gray-600 border-gray-200 hover:border-primary-300'}`}>
                    {m}
                  </button>
                ))}
              </div>
              {errors.maker && <p className="text-xs text-red-500 mt-1">{errors.maker}</p>}
            </div>
            {/* 모델명 */}
            <div>
              <label className="text-sm font-bold text-gray-700 mb-1.5 block">모델명 <span className="text-red-500">*</span></label>
              <input
                value={form.model}
                onChange={e => set('model', e.target.value)}
                placeholder="예: 아반떼, 소나타..."
                className={`w-full px-4 py-3 rounded-xl border text-sm focus:outline-none ${errors.model ? 'border-red-300' : 'border-gray-200 focus:border-primary-400'}`}
              />
              {errors.model && <p className="text-xs text-red-500 mt-1">{errors.model}</p>}
            </div>
            {/* 연식 */}
            <div>
              <label className="text-sm font-bold text-gray-700 mb-1.5 block">연식</label>
              <select value={form.year} onChange={e => set('year', Number(e.target.value))}
                className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-primary-400 bg-white">
                {YEARS.map(y => <option key={y} value={y}>{y}년식</option>)}
              </select>
            </div>
            {/* 연료 */}
            <div>
              <label className="text-sm font-bold text-gray-700 mb-1.5 block">연료</label>
              <div className="flex flex-wrap gap-2">
                {FUEL_TYPES.map(f => (
                  <button key={f.value} onClick={() => set('fuelType', f.value)}
                    className={`px-4 py-2.5 text-sm rounded-xl border transition-all ${form.fuelType === f.value ? 'bg-primary-600 text-white border-primary-600 font-semibold' : 'bg-white text-gray-600 border-gray-200 hover:border-primary-300'}`}>
                    {f.label}
                  </button>
                ))}
              </div>
            </div>
            {/* 주행거리 */}
            <div>
              <label className="text-sm font-bold text-gray-700 mb-1.5 block">주행거리 <span className="text-red-500">*</span></label>
              <div className="relative">
                <input
                  type="number"
                  value={form.mileage}
                  onChange={e => set('mileage', e.target.value)}
                  placeholder="예: 85000"
                  className={`w-full px-4 py-3 pr-12 rounded-xl border text-sm focus:outline-none ${errors.mileage ? 'border-red-300' : 'border-gray-200 focus:border-primary-400'}`}
                />
                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm text-gray-400">km</span>
              </div>
              {errors.mileage && <p className="text-xs text-red-500 mt-1">{errors.mileage}</p>}
            </div>
            {/* 차량번호 */}
            <div>
              <label className="text-sm font-bold text-gray-700 mb-1.5 block">차량번호 <span className="text-gray-400 font-normal">(선택)</span></label>
              <input
                value={form.plateNumber}
                onChange={e => set('plateNumber', e.target.value)}
                placeholder="예: 123가 4567"
                className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-primary-400"
              />
            </div>
          </div>

          <button
            onClick={handleSave}
            disabled={saving}
            className="w-full mt-6 py-4 bg-primary-600 text-white font-bold rounded-2xl text-sm hover:bg-primary-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {saving ? <span className="animate-spin inline-block">⟳</span> : null}
            수정 완료
          </button>
        </div>
      </div>
    </div>
  )
}

// ── 메인 페이지 ──────────────────────────────────────────────────────────
export default function MainPage() {
  const router = useRouter()
  const supabase = createClient()
  const messagesEndRef = useRef<HTMLDivElement>(null)

  // 유저/차량 상태
  const [user, setUser] = useState<UserProfile | null>(null)
  const [vehicle, setVehicle] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [showEditModal, setShowEditModal] = useState(false)

  // 채팅 상태
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [conversationId] = useState(() => uuidv4())
  const [currentQuestions, setCurrentQuestions] = useState<DiagnosticQuestion[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [diagnosisResult, setDiagnosisResult] = useState<DiagnosisResult | null>(null)
  const [uploadedImages, setUploadedImages] = useState<string[]>([])
  const [authUser, setAuthUser] = useState<{ id: string } | null>(null)

  useEffect(() => {
    const load = async () => {
      const { data: { user: au } } = await supabase.auth.getUser()
      if (!au) { router.replace('/'); return }
      setAuthUser(au)

      const [{ data: profile }, { data: vehicles }] = await Promise.all([
        supabase.from('users').select('*').eq('id', au.id).single(),
        supabase.from('vehicles').select('*').eq('user_id', au.id).order('created_at', { ascending: false }).limit(1),
      ])

      setUser(profile)
      setVehicle(vehicles?.[0] ?? null)
      setLoading(false)

      // AI 첫 인사
      setMessages([{
        id: uuidv4(),
        role: 'assistant',
        type: 'text',
        content: '안녕하세요! 저는 MIKY 자동차 진단 AI입니다. 🚗\n\n현재 차량의 어떤 증상이 불편하신가요? 최대한 자세히 알려주시면 더 정확하게 분석해 드릴 수 있어요.',
        timestamp: new Date().toISOString(),
      }])
    }
    load()
  }, [])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isLoading])

  // 이미지 업로드
  const handleImageUpload = async (files: File[]) => {
    if (!authUser) return []
    const urls: string[] = []
    for (const file of files.slice(0, 3)) {
      const path = `${authUser.id}/${conversationId}/${uuidv4()}.${file.name.split('.').pop()}`
      const { data, error } = await supabase.storage.from('symptom-images').upload(path, file)
      if (!error && data) {
        const { data: { publicUrl } } = supabase.storage.from('symptom-images').getPublicUrl(data.path)
        urls.push(publicUrl)
      }
    }
    setUploadedImages(prev => [...prev, ...urls].slice(0, 3))
    return urls
  }

  // 메시지 전송
  const sendMessage = useCallback(async (content: string, type: 'text' | 'answer' = 'text', questionId?: string) => {
    const vehicleInfo = vehicle ? {
      id: vehicle.id, userId: vehicle.user_id, maker: vehicle.maker, model: vehicle.model,
      year: vehicle.year, mileage: vehicle.mileage, fuelType: vehicle.fuel_type,
      plateNumber: vehicle.plate_number, nickname: vehicle.nickname,
    } : null

    const userMsg = createMessage('user', content, type, {
      questionId, selectedChoice: content,
      images: type === 'text' ? uploadedImages : undefined,
    }) as ChatMessage

    const newMessages = [...messages, userMsg]
    setMessages(newMessages)
    setCurrentQuestions([])
    setIsLoading(true)

    try {
      const response = await fetch('/api/diagnose', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversationId, vehicleInfo, messages: newMessages,
          symptomImages: uploadedImages, isReDiagnosis: false,
        }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error)

      if (data.data.needsMoreInfo && data.data.additionalQuestions?.length > 0) {
        const aiMsg = createMessage('assistant', '정확한 진단을 위해 몇 가지 더 확인해 드릴게요.', 'question', {}) as ChatMessage
        setMessages(prev => [...prev, aiMsg])
        setCurrentQuestions(data.data.additionalQuestions)
      } else {
        const result: DiagnosisResult = data.data.result
        setDiagnosisResult(result)
        const resultMsg = createMessage('assistant', result.summary, 'result', { result }) as ChatMessage
        setMessages(prev => [...prev, resultMsg])
      }
    } catch {
      const errMsg = createMessage('assistant', '죄송합니다, 진단 처리 중 오류가 발생했습니다. 다시 시도해 주세요.', 'text') as ChatMessage
      setMessages(prev => [...prev, errMsg])
    } finally {
      setIsLoading(false)
      setUploadedImages([])
    }
  }, [messages, authUser, vehicle, uploadedImages, conversationId])

  // 자가점검 재진단
  const handleSelfCheckSubmit = async (selfCheckResults: string) => {
    const vehicleInfo = vehicle ? {
      id: vehicle.id, maker: vehicle.maker, model: vehicle.model,
      year: vehicle.year, fuelType: vehicle.fuel_type,
    } : null
    const reDiagMsg = createMessage('user', `자가점검 결과: ${selfCheckResults}`, 'self_check_input') as ChatMessage
    const newMessages = [...messages, reDiagMsg]
    setMessages(newMessages)
    setIsLoading(true)
    try {
      const response = await fetch('/api/diagnose', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ conversationId, vehicleInfo, messages: newMessages, isReDiagnosis: true }),
      })
      const data = await response.json()
      if (data.success) {
        const result: DiagnosisResult = data.data.result
        setDiagnosisResult(result)
        const msg = createMessage('assistant', '자가점검 결과를 반영하여 진단을 업데이트했습니다.', 're_diagnosis', { result }) as ChatMessage
        setMessages(prev => [...prev, msg])
      }
    } finally { setIsLoading(false) }
  }

  // 차량 수정 저장
  const handleVehicleSave = async (data: any) => {
    if (!vehicle) return
    const { error } = await supabase.from('vehicles').update(data).eq('id', vehicle.id)
    if (!error) {
      setVehicle({ ...vehicle, ...data })
      setShowEditModal(false)
    }
  }

  if (loading) return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="w-10 h-10 border-2 border-primary-200 border-t-primary-600 rounded-full animate-spin" />
    </div>
  )

  const displayName = (user as any)?.display_name ?? (user as any)?.displayName ?? '사용자'
  const fuelLabel = FUEL_LABELS[vehicle?.fuel_type ?? ''] ?? vehicle?.fuel_type ?? ''

  return (
    <div className="flex flex-col h-screen bg-surface-50 max-w-[480px] mx-auto">
      {/* ── 헤더 ── */}
      <header className="bg-white px-5 pt-12 pb-4 flex items-start justify-between flex-shrink-0 border-b border-gray-100">
        <div>
          <h1 className="text-xl font-black text-gray-900">마이키</h1>
          <p className="text-sm text-gray-500 mt-0.5 italic">"차가 이상하다면, 제가 한번 봐드릴게요"</p>
        </div>
        <Link href="/profile">
          <div className="w-10 h-10 rounded-full bg-primary-100 flex items-center justify-center overflow-hidden">
            {(user as any)?.avatar_url || (user as any)?.avatarUrl ? (
              <img src={(user as any)?.avatar_url ?? (user as any)?.avatarUrl} alt="" className="w-full h-full object-cover" />
            ) : (
              <span className="text-primary-600 font-bold text-sm">{displayName[0]?.toUpperCase()}</span>
            )}
          </div>
        </Link>
      </header>

      {/* ── 차량 카드 ── */}
      <div className="px-4 pt-4 flex-shrink-0">
        {vehicle ? (
          <button
            onClick={() => setShowEditModal(true)}
            className="w-full text-left relative bg-gradient-to-br from-primary-600 to-primary-800 rounded-3xl p-5 text-white overflow-hidden shadow-lg shadow-primary-200 active:scale-[0.98] transition-transform"
          >
            {/* 연료 배지 */}
            {fuelLabel && (
              <div className="absolute top-4 right-4 bg-white/20 text-white text-xs font-bold px-2.5 py-1 rounded-full">
                {fuelLabel}
              </div>
            )}
            {/* 수정 아이콘 */}
            <div className="absolute bottom-4 right-4 bg-white/20 text-white text-xs px-2.5 py-1 rounded-full flex items-center gap-1">
              <span className="text-[10px]">✏️</span>
              <span className="text-[11px] font-semibold">수정</span>
            </div>
            {/* 닉네임 라벨 */}
            <p className="text-white/70 text-xs mb-1 font-medium">
              {vehicle.nickname ? `🚗 ${vehicle.nickname}의 차고` : vehicle.maker}
            </p>
            <h2 className="text-2xl font-black mb-1">{vehicle.model}</h2>
            <p className="text-white/70 text-sm">{vehicle.year}년식 · {vehicle.mileage?.toLocaleString()}km</p>
          </button>
        ) : (
          <Link href="/vehicles/new" className="block bg-white rounded-3xl p-5 border-2 border-dashed border-primary-200 text-center hover:border-primary-400 transition-colors">
            <span className="text-3xl mb-2 block">🚗</span>
            <p className="font-semibold text-gray-700 text-sm">차량 정보 등록하기</p>
            <p className="text-xs text-gray-400 mt-1">등록 시 진단 정확도가 올라가요</p>
          </Link>
        )}
      </div>

      {/* ── 채팅 영역 ── */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4 mt-3">
        <div className="flex items-center gap-2 mb-2 px-1">
          <span className="text-primary-600">✦</span>
          <h3 className="font-bold text-gray-900 text-sm">AI 정비 어드바이저</h3>
        </div>

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

        {isLoading && <TypingIndicator />}
        <div ref={messagesEndRef} />
      </div>

      {/* ── 채팅 입력창 ── */}
      {!diagnosisResult && !isLoading && currentQuestions.length === 0 && (
        <ChatInput
          onSend={(text) => sendMessage(text)}
          onImageUpload={handleImageUpload}
          uploadedImages={uploadedImages}
          onRemoveImage={(url) => setUploadedImages(prev => prev.filter(u => u !== url))}
          disabled={isLoading}
        />
      )}

      {/* ── 차량 수정 모달 ── */}
      {showEditModal && vehicle && (
        <VehicleEditModal
          vehicle={vehicle}
          onClose={() => setShowEditModal(false)}
          onSave={handleVehicleSave}
        />
      )}
    </div>
  )
}
