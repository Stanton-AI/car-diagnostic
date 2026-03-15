'use client'
import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import BottomNav from '@/components/nav/BottomNav'

// ── 알림 타입 ────────────────────────────────────────────────────────────
interface NotifRow {
  id: string
  type: string
  title: string
  body: string | null
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data: any
  is_read: boolean
  created_at: string
}

function fmtTimeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1)  return '방금'
  if (mins < 60) return `${mins}분 전`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24)  return `${hrs}시간 전`
  return `${Math.floor(hrs / 24)}일 전`
}
import { v4 as uuidv4 } from 'uuid'
import type { ChatMessage, DiagnosticQuestion, UserProfile, FuelType } from '@/types'
import { createMessage } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'
import MessageBubble from '@/components/chat/MessageBubble'
import ChatInput from '@/components/chat/ChatInput'
import TypingIndicator from '@/components/chat/TypingIndicator'

// ── 상수 ──────────────────────────────────────────────────────────────────
const FUEL_LABELS: Record<string, string> = {
  gasoline: '가솔린', diesel: '디젤', hybrid: '하이브리드', electric: '전기', lpg: 'LPG',
}
const MAKERS = ['현대', '기아', '제네시스', 'KG 모빌리티', '르노코리아', 'GM 한국', 'BMW', '메르세데스-벤츠', '아우디', '볼보', '기타']
const FUEL_TYPES: { value: FuelType; label: string }[] = [
  { value: 'gasoline', label: '가솔린' }, { value: 'diesel', label: '디젤' },
  { value: 'hybrid', label: '하이브리드' }, { value: 'electric', label: '전기' }, { value: 'lpg', label: 'LPG' },
]
const CURRENT_YEAR = new Date().getFullYear()
const YEARS = Array.from({ length: CURRENT_YEAR - 1989 }, (_, i) => CURRENT_YEAR - i)

// ── 타입 ──────────────────────────────────────────────────────────────────
type Phase = 'car_type' | 'other_car_info' | 'no_vehicle' | 'symptom' | 'questioning' | 'done'
interface Checkpoint {
  messages: ChatMessage[]
  question: DiagnosticQuestion
  queue: DiagnosticQuestion[]
}

// ── 인사 감지 ─────────────────────────────────────────────────────────────
const GREETING_WORDS = ['안녕', '하이', 'hi', 'hello', '반가', '안뇽', '헬로', '방가']
const SYMPTOM_WORDS = ['소리', '이상', '오일', '엔진', '브레이크', '타이어', '진동', '냄새', '경고', '점등', '누유', '시동']
function isGreeting(text: string): boolean {
  const t = text.trim().toLowerCase()
  if (t.length > 30) return false
  if (SYMPTOM_WORDS.some(w => t.includes(w))) return false
  return GREETING_WORDS.some(w => t.includes(w))
}

// ── 차량 수정 모달 ────────────────────────────────────────────────────────
function VehicleEditModal({ vehicle, onClose, onSave }: { vehicle: any; onClose: () => void; onSave: (data: any) => Promise<void> }) {
  const [form, setForm] = useState({
    maker: vehicle.maker ?? '', model: vehicle.model ?? '', year: vehicle.year ?? CURRENT_YEAR,
    mileage: String(vehicle.mileage ?? ''), fuelType: (vehicle.fuel_type ?? 'gasoline') as FuelType,
    plateNumber: vehicle.plate_number ?? '', nickname: vehicle.nickname ?? '',
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
    await onSave({ maker: form.maker, model: form.model.trim(), year: form.year, mileage: Number(form.mileage), fuel_type: form.fuelType, plate_number: form.plateNumber.trim() || null, nickname: form.nickname.trim() })
    setSaving(false)
  }
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center" onClick={onClose}>
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
      <div className="relative w-full max-w-[480px] bg-white rounded-t-3xl pt-5 pb-8 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="w-10 h-1 bg-gray-200 rounded-full mx-auto mb-5" />
        <div className="px-5">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-lg font-black text-gray-900">차량 정보 수정</h2>
            <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-100 text-gray-500 text-sm">✕</button>
          </div>
          <div className="space-y-4">
            <div><label className="text-sm font-bold text-gray-700 mb-1.5 block">차량 닉네임 <span className="text-red-500">*</span></label>
              <input value={form.nickname} onChange={e => set('nickname', e.target.value)} maxLength={10} placeholder="예: 날쌘터보" className={`w-full px-4 py-3 rounded-xl border text-sm focus:outline-none ${errors.nickname ? 'border-red-300' : 'border-gray-200 focus:border-primary-400'}`} />
              {errors.nickname && <p className="text-xs text-red-500 mt-1">{errors.nickname}</p>}
            </div>
            <div><label className="text-sm font-bold text-gray-700 mb-1.5 block">제조사 <span className="text-red-500">*</span></label>
              <div className="grid grid-cols-3 gap-2">{MAKERS.map(m => <button key={m} onClick={() => set('maker', m)} className={`py-2.5 px-3 text-sm rounded-xl border transition-all ${form.maker === m ? 'bg-primary-600 text-white border-primary-600 font-semibold' : 'bg-white text-gray-600 border-gray-200 hover:border-primary-300'}`}>{m}</button>)}</div>
              {errors.maker && <p className="text-xs text-red-500 mt-1">{errors.maker}</p>}
            </div>
            <div><label className="text-sm font-bold text-gray-700 mb-1.5 block">모델명 <span className="text-red-500">*</span></label>
              <input value={form.model} onChange={e => set('model', e.target.value)} placeholder="예: 아반떼, 소나타..." className={`w-full px-4 py-3 rounded-xl border text-sm focus:outline-none ${errors.model ? 'border-red-300' : 'border-gray-200 focus:border-primary-400'}`} />
              {errors.model && <p className="text-xs text-red-500 mt-1">{errors.model}</p>}
            </div>
            <div><label className="text-sm font-bold text-gray-700 mb-1.5 block">연식</label>
              <select value={form.year} onChange={e => set('year', Number(e.target.value))} className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-primary-400 bg-white">{YEARS.map(y => <option key={y} value={y}>{y}년식</option>)}</select>
            </div>
            <div><label className="text-sm font-bold text-gray-700 mb-1.5 block">연료</label>
              <div className="flex flex-wrap gap-2">{FUEL_TYPES.map(f => <button key={f.value} onClick={() => set('fuelType', f.value)} className={`px-4 py-2.5 text-sm rounded-xl border transition-all ${form.fuelType === f.value ? 'bg-primary-600 text-white border-primary-600 font-semibold' : 'bg-white text-gray-600 border-gray-200 hover:border-primary-300'}`}>{f.label}</button>)}</div>
            </div>
            <div><label className="text-sm font-bold text-gray-700 mb-1.5 block">주행거리 <span className="text-red-500">*</span></label>
              <div className="relative"><input type="number" value={form.mileage} onChange={e => set('mileage', e.target.value)} placeholder="예: 85000" className={`w-full px-4 py-3 pr-12 rounded-xl border text-sm focus:outline-none ${errors.mileage ? 'border-red-300' : 'border-gray-200 focus:border-primary-400'}`} /><span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm text-gray-400">km</span></div>
              {errors.mileage && <p className="text-xs text-red-500 mt-1">{errors.mileage}</p>}
            </div>
            <div><label className="text-sm font-bold text-gray-700 mb-1.5 block">차량번호 <span className="text-gray-400 font-normal">(선택)</span></label>
              <input value={form.plateNumber} onChange={e => set('plateNumber', e.target.value)} placeholder="예: 123가 4567" className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-primary-400" />
            </div>
          </div>
          <button onClick={handleSave} disabled={saving} className="w-full mt-6 py-4 bg-primary-600 text-white font-bold rounded-2xl text-sm hover:bg-primary-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
            {saving ? <span className="animate-spin inline-block">⟳</span> : null}수정 완료
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
  const [authUser, setAuthUser] = useState<{ id: string } | null>(null)

  // 대화 상태
  const [phase, setPhase] = useState<Phase>('car_type')
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [conversationId] = useState(() => uuidv4())
  const [isLoading, setIsLoading] = useState(false)
  const [uploadedImages, setUploadedImages] = useState<string[]>([])

  // 차량 정보 (이번 대화에 사용할 차량 정보)
  const [activeVehicleInfo, setActiveVehicleInfo] = useState<any>(null)

  // 미등록 차량 입력 폼
  const [otherCarForm, setOtherCarForm] = useState({ maker: '', model: '', year: '', mileage: '', fuelType: 'gasoline' as FuelType })

  // 질문 상태
  const [currentQuestion, setCurrentQuestion] = useState<DiagnosticQuestion | null>(null)
  const [questionQueue, setQuestionQueue] = useState<DiagnosticQuestion[]>([])
  const [checkpoints, setCheckpoints] = useState<Checkpoint[]>([])

  // 기타 직접 입력 상태
  const [showCustomInput, setShowCustomInput] = useState(false)
  const [customInputValue, setCustomInputValue] = useState('')

  // 질문 설명 상태
  const [explanation, setExplanation] = useState<string | null>(null)
  const [loadingExplain, setLoadingExplain] = useState(false)

  // 알림 상태
  const [notifs, setNotifs] = useState<NotifRow[]>([])
  const [showNotif, setShowNotif] = useState(false)

  // 차고 패널 드래그 상태
  const [garageOpen, setGarageOpen] = useState(true)
  const touchStartY = useRef(0)

  // ── 초기 로드 ────────────────────────────────────────────────────────
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

      // 알림 조회
      const { data: notifData } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', au.id)
        .order('created_at', { ascending: false })
        .limit(30)
      setNotifs(notifData ?? [])

      setLoading(false)
      setMessages([{
        id: uuidv4(), role: 'assistant', type: 'text',
        content: '안녕하세요! 저는 미키예요. 🔧\n\n진단할 차량이 내 차인가요, 아니면 다른 분의 차인가요?',
        timestamp: new Date().toISOString(),
      }])
    }
    load()
  }, [])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isLoading, currentQuestion, phase])

  // ── 이미지 업로드 ────────────────────────────────────────────────────
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

  // ── 차량 타입 선택 ───────────────────────────────────────────────────
  const handleCarType = useCallback((type: 'mine' | 'other') => {
    const userMsg = createMessage('user', type === 'mine' ? '🚗 내 차' : '🔍 앱에 등록되지 않은 차', 'text') as ChatMessage
    if (type === 'mine') {
      if (!vehicle) {
        const aiMsg = createMessage('assistant', '차고에 등록된 차량이 없네요. 차량을 먼저 등록하면 더 정확한 진단이 가능해요! 📋\n\n아니면 차량 정보를 직접 입력해도 됩니다.', 'text') as ChatMessage
        setMessages(prev => [...prev, userMsg, aiMsg])
        setPhase('no_vehicle')
        return
      }
      const vInfo = {
        id: vehicle.id, maker: vehicle.maker, model: vehicle.model,
        year: vehicle.year, mileage: vehicle.mileage,
        fuelType: vehicle.fuel_type, plateNumber: vehicle.plate_number, nickname: vehicle.nickname,
      }
      setActiveVehicleInfo(vInfo)
      const label = vehicle.nickname ? `"${vehicle.nickname}"` : `${vehicle.maker} ${vehicle.model}`
      const aiMsg = createMessage('assistant', `${label} 기준으로 진행할게요. 🚗\n\n어떤 증상이 있으신가요? 최대한 자세히 설명해 주시면 더 정확하게 분석해드릴 수 있어요.`, 'text') as ChatMessage
      setMessages(prev => [...prev, userMsg, aiMsg])
      setPhase('symptom')
    } else {
      const aiMsg = createMessage('assistant', '차량 정보를 알려주세요. 아래 양식을 채워주시면 됩니다 📋', 'text') as ChatMessage
      setMessages(prev => [...prev, userMsg, aiMsg])
      setPhase('other_car_info')
    }
  }, [vehicle])

  // ── 남의 차 정보 제출 ────────────────────────────────────────────────
  const handleOtherCarSubmit = useCallback(() => {
    if (!otherCarForm.maker.trim() || !otherCarForm.model.trim()) return
    const yearStr = otherCarForm.year ? ` (${otherCarForm.year}년식)` : ''
    const mileStr = otherCarForm.mileage ? `, ${parseInt(otherCarForm.mileage).toLocaleString()}km` : ''
    const fuelStr = FUEL_LABELS[otherCarForm.fuelType] ?? otherCarForm.fuelType
    const infoText = `${otherCarForm.maker} ${otherCarForm.model}${yearStr}${mileStr}, ${fuelStr}`
    const userMsg = createMessage('user', `차량 정보 입력: ${infoText}`, 'text') as ChatMessage
    const vInfo: any = {
      maker: otherCarForm.maker.trim(), model: otherCarForm.model.trim(),
      year: otherCarForm.year ? Number(otherCarForm.year) : undefined,
      mileage: otherCarForm.mileage ? Number(otherCarForm.mileage.replace(/,/g, '')) : undefined,
      fuelType: otherCarForm.fuelType,
    }
    setActiveVehicleInfo(vInfo)
    const aiMsg = createMessage('assistant', `${otherCarForm.maker} ${otherCarForm.model} 기준으로 진행할게요. 🔍\n\n어떤 증상이 있으신가요?`, 'text') as ChatMessage
    setMessages(prev => [...prev, userMsg, aiMsg])
    setOtherCarForm({ maker: '', model: '', year: '', mileage: '', fuelType: 'gasoline' })
    setPhase('symptom')
  }, [otherCarForm])

  // ── 뒤로가기 (이전 답변 수정) ────────────────────────────────────────
  const handleGoBack = useCallback(() => {
    if (checkpoints.length === 0) return
    const last = checkpoints[checkpoints.length - 1]
    setMessages(last.messages)
    setCurrentQuestion(last.question)
    setQuestionQueue(last.queue)
    setCheckpoints(prev => prev.slice(0, -1))
    setShowCustomInput(false)
    setCustomInputValue('')
    setPhase('questioning')
  }, [checkpoints])

  // ── 메시지 전송 / API 호출 ───────────────────────────────────────────
  const sendMessage = useCallback(async (content: string, type: 'text' | 'answer' = 'text', questionId?: string) => {
    // 인사말 감지
    if (type === 'text' && phase === 'symptom' && isGreeting(content)) {
      const userMsg = createMessage('user', content, 'text') as ChatMessage
      const aiMsg = createMessage('assistant', '안녕하세요! 😊 반갑습니다.\n\n차량에 이상한 증상이 있으시면 편하게 말씀해주세요. 어떤 부분이 불편하신가요?', 'text') as ChatMessage
      setMessages(prev => [...prev, userMsg, aiMsg])
      return
    }

    // 답변형이면 체크포인트 저장 (뒤로가기용)
    if (type === 'answer' && currentQuestion) {
      setCheckpoints(prev => [...prev, {
        messages: [...messages],
        question: currentQuestion,
        queue: [...questionQueue],
      }])
    }

    const userMsg = createMessage('user', content, type, { questionId }) as ChatMessage
    const newMessages = [...messages, userMsg]
    setMessages(newMessages)
    setCurrentQuestion(null)
    setShowCustomInput(false)
    setCustomInputValue('')
    setExplanation(null)
    setIsLoading(true)

    // 대기 중인 질문이 있으면 API 호출 없이 다음 질문 표시
    if (type === 'answer' && questionQueue.length > 0) {
      const nextQ = questionQueue[0]
      const remaining = questionQueue.slice(1)
      setQuestionQueue(remaining)
      const qMsg = createMessage('assistant', nextQ.question, 'question', { questionId: nextQ.id, choices: nextQ.choices }) as ChatMessage
      setTimeout(() => {
        setMessages(prev => [...prev, qMsg])
        setCurrentQuestion(nextQ)
        setIsLoading(false)
      }, 400)
      return
    }

    // API 호출
    try {
      const response = await fetch('/api/diagnose', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversationId, vehicleInfo: activeVehicleInfo,
          messages: newMessages, symptomImages: uploadedImages, isReDiagnosis: false,
        }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error)

      if (data.data.needsMoreInfo && data.data.additionalQuestions?.length > 0) {
        const questions = data.data.additionalQuestions as DiagnosticQuestion[]
        const firstQ = questions[0]
        const restQ = questions.slice(1)

        // 추가 질문 안내 메시지 + 첫 번째 질문을 메시지로 추가
        const introMsg = createMessage('assistant', '정확한 진단을 위해 몇 가지 더 문의드려요.', 'text') as ChatMessage
        const qMsg = createMessage('assistant', firstQ.question, 'question', { questionId: firstQ.id, choices: firstQ.choices }) as ChatMessage
        setMessages(prev => [...prev, introMsg, qMsg])
        setCurrentQuestion(firstQ)
        setQuestionQueue(restQ)
        setPhase('questioning')
      } else {
        // 진단 완료 → 결과 페이지로 이동
        const doneMsg = createMessage('assistant', '✅ 진단 분석이 완료되었습니다!\n잠시 후 결과 리포트를 확인하실 수 있어요.', 'text') as ChatMessage
        setMessages(prev => [...prev, doneMsg])
        setPhase('done')
        setCheckpoints([])
        setTimeout(() => router.push(`/diagnosis/${conversationId}`), 1500)
      }
    } catch {
      const errMsg = createMessage('assistant', '죄송합니다, 진단 처리 중 오류가 발생했습니다. 다시 시도해 주세요.', 'text') as ChatMessage
      setMessages(prev => [...prev, errMsg])
    } finally {
      setIsLoading(false)
      setUploadedImages([])
    }
  }, [messages, phase, currentQuestion, questionQueue, activeVehicleInfo, uploadedImages, conversationId, router])

  // ── 차량 수정 저장 ───────────────────────────────────────────────────
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
  const unreadCount = notifs.filter(n => !n.is_read).length

  const handleOpenNotif = async () => {
    setShowNotif(true)
    if (unreadCount > 0 && authUser) {
      await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('user_id', authUser.id)
        .eq('is_read', false)
      setNotifs(prev => prev.map(n => ({ ...n, is_read: true })))
    }
  }

  // ── 차고 드래그 핸들러 ─────────────────────────────────────────────
  const handleGarageTouchStart = useCallback((e: React.TouchEvent) => {
    touchStartY.current = e.touches[0].clientY
  }, [])

  const handleGarageTouchEnd = useCallback((e: React.TouchEvent) => {
    const deltaY = e.changedTouches[0].clientY - touchStartY.current
    if (garageOpen && deltaY > 50) setGarageOpen(false)
    else if (!garageOpen && deltaY < -50) setGarageOpen(true)
  }, [garageOpen])

  // 뒤로가기 버튼 표시 조건: 질문 단계이고 체크포인트가 있고 로딩 중 아닐 때 항상 표시
  const showBackButton = phase === 'questioning' && checkpoints.length > 0 && !isLoading

  // 현재 질문의 선택지 (중복 제거)
  const questionChoices = currentQuestion
    ? [...currentQuestion.choices.filter((c, i, arr) => arr.indexOf(c) === i),
      ...(!currentQuestion.choices.includes('모름') ? ['모름'] : []),
      '기타 (직접 입력)']
    : []

  return (
    <div className="flex flex-col h-screen bg-surface-50 max-w-[480px] mx-auto">
      {/* ── 헤더 ── */}
      <header className="bg-white px-5 pt-12 pb-4 flex items-start justify-between flex-shrink-0 border-b border-gray-100">
        <div>
          <div className="flex items-center gap-2">
            <img src="/logo.png" alt="정비톡" className="w-7 h-7 rounded-lg object-contain" />
            <h1 className="text-xl font-black text-gray-900">정비톡</h1>
          </div>
          <p className="text-sm text-gray-500 mt-0.5">"내 차 증상, 3분이면 알 수 있어요"</p>
        </div>
        <div className="flex items-center gap-2">
          {/* 알림 벨 */}
          <button
            onClick={handleOpenNotif}
            className="relative w-10 h-10 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-500 transition-colors"
          >
            <span className="text-xl">🔔</span>
            {unreadCount > 0 && (
              <span className="absolute top-1 right-1 w-4 h-4 bg-red-500 rounded-full text-white text-[9px] font-bold flex items-center justify-center">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </button>
          {/* 프로필 */}
          <Link href="/profile">
            <div className="w-10 h-10 rounded-full bg-primary-100 flex items-center justify-center overflow-hidden">
              {(user as any)?.avatar_url || (user as any)?.avatarUrl ? (
                <img src={(user as any)?.avatar_url ?? (user as any)?.avatarUrl} alt="" className="w-full h-full object-cover" />
              ) : (
                <span className="text-primary-600 font-bold text-sm">{displayName[0]?.toUpperCase()}</span>
              )}
            </div>
          </Link>
        </div>
      </header>

      {/* ── 차량 카드 (드래그 차고) ── */}
      <div className="flex-shrink-0">
        {/* 차고 콘텐츠 — 열릴 때만 표시 */}
        <div
          className={`overflow-hidden transition-all duration-300 ease-in-out ${
            garageOpen ? 'max-h-48 opacity-100' : 'max-h-0 opacity-0'
          }`}
        >
          <div className="px-4 pt-4">
            {vehicle ? (
              <button
                onClick={() => setShowEditModal(true)}
                className="w-full text-left relative bg-gradient-to-br from-primary-600 to-primary-800 rounded-3xl p-5 text-white overflow-hidden shadow-lg shadow-primary-200 active:scale-[0.98] transition-transform"
              >
                {fuelLabel && (
                  <div className="absolute top-4 right-4 bg-white/20 text-white text-xs font-bold px-2.5 py-1 rounded-full">{fuelLabel}</div>
                )}
                <div className="absolute bottom-4 right-4 bg-white/20 text-white text-xs px-2.5 py-1 rounded-full flex items-center gap-1">
                  <span className="text-[10px]">✏️</span><span className="text-[11px] font-semibold">수정</span>
                </div>
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
        </div>

        {/* 드래그 핸들 바 */}
        <div
          onTouchStart={handleGarageTouchStart}
          onTouchEnd={handleGarageTouchEnd}
          onClick={() => setGarageOpen(v => !v)}
          className="flex flex-col items-center justify-center gap-1 py-2 cursor-pointer select-none"
        >
          {/* 접혔을 때 미니 차량 정보 */}
          {!garageOpen && vehicle && (
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-bold text-gray-600">🚗 {vehicle.nickname || vehicle.model}</span>
              <span className="text-xs text-gray-400">{vehicle.year}년식 · {vehicle.mileage?.toLocaleString()}km</span>
            </div>
          )}
          {/* 드래그 인디케이터 */}
          <div className="flex items-center gap-1.5">
            <div className="w-8 h-1 bg-gray-300 rounded-full" />
            <span className="text-[10px] text-gray-400">{garageOpen ? '▲ 차고 숨기기' : '▼ 차고 열기'}</span>
            <div className="w-8 h-1 bg-gray-300 rounded-full" />
          </div>
        </div>
      </div>

      {/* ── 채팅 영역 ── */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3 mt-3">
        <div className="flex items-center gap-2 mb-2 px-1">
          <span className="text-primary-600">✦</span>
          <h3 className="font-bold text-gray-900 text-sm">미키와 상담하기</h3>
        </div>

        {/* 메시지 목록 */}
        {messages.map((msg) => (
          <div key={msg.id} className="animate-fade-up">
            <MessageBubble message={msg} />
          </div>
        ))}


        {/* 차량 선택 버튼 (car_type 단계) */}
        {phase === 'car_type' && !isLoading && messages.length > 0 && (
          <div className="flex gap-3 ml-10 animate-fade-up">
            <button onClick={() => handleCarType('mine')}
              className="flex-1 py-3 px-4 bg-white border-2 border-primary-200 rounded-2xl text-sm font-semibold text-primary-700 hover:bg-primary-50 transition-all active:scale-[0.97] shadow-sm">
              🚗 내 차
            </button>
            <button onClick={() => handleCarType('other')}
              className="flex-1 py-3 px-4 bg-white border-2 border-gray-200 rounded-2xl text-sm font-semibold text-gray-600 hover:bg-gray-50 transition-all active:scale-[0.97] shadow-sm">
              🔍 앱에 등록되지 않은 차
            </button>
          </div>
        )}

        {/* 앱에 등록되지 않은 차 정보 입력 폼 */}
        {phase === 'other_car_info' && (
          <div className="ml-10 bg-white rounded-2xl border border-gray-100 shadow-sm p-4 space-y-3 animate-fade-up">
            <div className="flex items-center justify-between mb-1">
              <p className="text-xs text-gray-500 font-medium">차량 정보 입력</p>
              <button
                onClick={() => {
                  setMessages(prev => prev.slice(0, -2))
                  setPhase('car_type')
                }}
                className="text-xs text-gray-400 hover:text-primary-500 flex items-center gap-1 px-2.5 py-1 rounded-full border border-gray-200 hover:border-primary-200 bg-white transition-all">
                ← 뒤로
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs font-medium text-gray-500 mb-1 block">제조사 <span className="text-red-500">*</span></label>
                <input value={otherCarForm.maker} onChange={e => setOtherCarForm(p => ({ ...p, maker: e.target.value }))}
                  placeholder="현대, 기아, BMW..." className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:border-primary-400" />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-500 mb-1 block">모델명 <span className="text-red-500">*</span></label>
                <input value={otherCarForm.model} onChange={e => setOtherCarForm(p => ({ ...p, model: e.target.value }))}
                  placeholder="아반떼, K5..." className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:border-primary-400" />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-500 mb-1 block">연식</label>
                <input value={otherCarForm.year} onChange={e => setOtherCarForm(p => ({ ...p, year: e.target.value }))}
                  placeholder="2020" type="number" min="1990" max={CURRENT_YEAR}
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:border-primary-400" />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-500 mb-1 block">주행거리 (km)</label>
                <input value={otherCarForm.mileage} onChange={e => setOtherCarForm(p => ({ ...p, mileage: e.target.value }))}
                  placeholder="50000" type="number" min="0"
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:border-primary-400" />
              </div>
            </div>
            <div>
              <label className="text-xs font-medium text-gray-500 mb-1.5 block">연료</label>
              <div className="flex flex-wrap gap-1.5">
                {FUEL_TYPES.map(f => (
                  <button key={f.value} type="button"
                    onClick={() => setOtherCarForm(p => ({ ...p, fuelType: f.value }))}
                    className={`px-3 py-1.5 text-xs rounded-lg border transition-all ${
                      otherCarForm.fuelType === f.value
                        ? 'bg-primary-600 text-white border-primary-600 font-semibold'
                        : 'bg-white text-gray-600 border-gray-200 hover:border-primary-300'
                    }`}>
                    {f.label}
                  </button>
                ))}
              </div>
            </div>
            <button onClick={handleOtherCarSubmit}
              disabled={!otherCarForm.maker.trim() || !otherCarForm.model.trim()}
              className="w-full py-2.5 bg-primary-600 text-white rounded-xl text-sm font-semibold hover:bg-primary-700 disabled:opacity-40 transition-colors">
              확인 →
            </button>
          </div>
        )}

        {/* 차량 미등록 시 안내 */}
        {phase === 'no_vehicle' && (
          <div className="ml-10 space-y-2 animate-fade-up">
            <Link href="/vehicles/new"
              className="block py-3 px-4 bg-primary-600 text-white text-sm font-semibold rounded-2xl text-center hover:bg-primary-700 transition-colors">
              🚗 차량 등록하기
            </Link>
            <button onClick={() => {
              const aiMsg = createMessage('assistant', '차량 정보를 알려주세요. 아래 양식을 채워주시면 됩니다 📋', 'text') as ChatMessage
              setMessages(prev => [...prev, aiMsg])
              setPhase('other_car_info')
            }}
              className="block w-full py-3 px-4 bg-white border border-gray-200 text-gray-600 text-sm font-medium rounded-2xl text-center hover:bg-gray-50 transition-colors">
              📝 차량 정보 직접 입력
            </button>
            <button
              onClick={() => {
                setMessages(prev => prev.slice(0, -2))
                setPhase('car_type')
              }}
              className="w-full text-xs text-gray-400 hover:text-primary-500 flex items-center justify-center gap-1 py-2 px-3 rounded-2xl border border-gray-200 hover:border-primary-200 bg-white transition-all">
              ← 뒤로가기
            </button>
          </div>
        )}

        {/* 현재 질문 선택지 */}
        {currentQuestion && !isLoading && (
          <div className="ml-10 space-y-2 animate-fade-up">
            {/* 뒤로가기 버튼 */}
            {showBackButton && (
              <div className="flex justify-end mb-1">
                <button
                  onClick={handleGoBack}
                  className="text-xs text-gray-400 hover:text-primary-500 flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-gray-200 hover:border-primary-200 bg-white transition-all active:scale-[0.97]">
                  ← 이전 답변 수정
                </button>
              </div>
            )}

            {/* 질문 설명 버블 */}
            {(explanation || loadingExplain) && (
              <div className="px-3 py-2.5 bg-blue-50 border border-blue-100 rounded-xl">
                <p className="text-xs text-blue-500 font-semibold mb-1">💡 질문 설명</p>
                {loadingExplain ? (
                  <div className="flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                    <span className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                    <span className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                ) : (
                  <p className="text-xs text-blue-700 leading-relaxed">{explanation}</p>
                )}
              </div>
            )}

            {!showCustomInput ? (
              <>
                {/* 질문 설명 버튼 — 선택지 위에 배치 */}
                <button
                  onClick={async () => {
                    if (loadingExplain) return
                    if (explanation) { setExplanation(null); return }
                    setLoadingExplain(true)
                    try {
                      const res = await fetch('/api/assist', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ type: 'question_explain', question: currentQuestion.question }),
                      })
                      const data = await res.json()
                      setExplanation(data.answer ?? '설명을 불러오지 못했어요.')
                    } catch {
                      setExplanation('설명을 불러오지 못했어요.')
                    } finally {
                      setLoadingExplain(false)
                    }
                  }}
                  disabled={loadingExplain}
                  className="w-full px-3 py-2 rounded-xl border border-blue-100 text-xs text-blue-500 hover:bg-blue-50 transition-colors text-center disabled:opacity-50">
                  {loadingExplain ? '설명 불러오는 중...' : explanation ? '❓ 설명 닫기' : '❓ 이 질문이 뭔 뜻이에요?'}
                </button>

                {questionChoices.map((choice, i) => (
                  <button key={`${currentQuestion.id}-${i}`}
                    onClick={() => {
                      if (choice === '기타 (직접 입력)') {
                        setShowCustomInput(true)
                        return
                      }
                      sendMessage(choice, 'answer', currentQuestion.id)
                    }}
                    className="w-full flex items-center gap-3 px-4 py-3 bg-white border border-gray-200 rounded-xl text-left hover:border-primary-300 hover:bg-primary-50 transition-all active:scale-[0.98] text-sm shadow-sm">
                    <span className="w-5 h-5 rounded-full border border-primary-300 bg-white flex-shrink-0 flex items-center justify-center text-xs text-primary-600 font-bold">
                      {String.fromCharCode(65 + i)}
                    </span>
                    <span className="flex-1">{choice}</span>
                  </button>
                ))}
              </>
            ) : (
              <div className="flex gap-2">
                <input
                  type="text"
                  value={customInputValue}
                  onChange={e => setCustomInputValue(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter' && customInputValue.trim()) {
                      sendMessage(customInputValue.trim(), 'answer', currentQuestion.id)
                    }
                  }}
                  placeholder="직접 입력해 주세요..."
                  autoFocus
                  className="flex-1 px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-primary-400 bg-white"
                />
                <button
                  onClick={() => { if (customInputValue.trim()) sendMessage(customInputValue.trim(), 'answer', currentQuestion.id) }}
                  className="px-4 py-3 bg-primary-600 text-white rounded-xl text-sm font-medium hover:bg-primary-700 transition-colors">
                  확인
                </button>
              </div>
            )}
          </div>
        )}

        {isLoading && <TypingIndicator />}
        <div ref={messagesEndRef} />
      </div>

      {/* ── 채팅 입력창 (증상 입력 단계만) ── */}
      {phase === 'symptom' && !isLoading && (
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
        <VehicleEditModal vehicle={vehicle} onClose={() => setShowEditModal(false)} onSave={handleVehicleSave} />
      )}

      {/* ── 알림 패널 ── */}
      {showNotif && (
        <div className="fixed inset-0 z-50" onClick={() => setShowNotif(false)}>
          <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" />
          <div
            className="absolute top-0 left-0 right-0 max-w-[480px] mx-auto bg-white shadow-xl rounded-b-3xl max-h-[75vh] flex flex-col"
            onClick={e => e.stopPropagation()}
          >
            {/* 상단 헤더 */}
            <div className="flex items-center justify-between px-5 pt-12 pb-3 border-b border-gray-100">
              <h2 className="text-lg font-black text-gray-900">알림</h2>
              <button
                onClick={() => setShowNotif(false)}
                className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-400"
              >✕</button>
            </div>

            {/* 알림 목록 */}
            <div className="overflow-y-auto flex-1">
              {notifs.length === 0 ? (
                <div className="py-12 text-center">
                  <p className="text-3xl mb-2">🔕</p>
                  <p className="text-sm text-gray-400">아직 알림이 없습니다</p>
                </div>
              ) : notifs.map(n => (
                <button
                  key={n.id}
                  className={`w-full text-left px-5 py-4 border-b border-gray-50 hover:bg-gray-50 transition-colors flex items-start gap-3 ${
                    !n.is_read ? 'bg-blue-50/40' : ''
                  }`}
                  onClick={() => {
                    setShowNotif(false)
                    if (n.data?.requestId) router.push(`/repair/${n.data.requestId}`)
                  }}
                >
                  {!n.is_read && (
                    <span className="w-2 h-2 bg-blue-500 rounded-full mt-1.5 flex-shrink-0" />
                  )}
                  {n.is_read && <span className="w-2 h-2 flex-shrink-0" />}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-800 leading-snug">{n.title}</p>
                    {n.body && (
                      <p className="text-xs text-gray-500 mt-0.5 line-clamp-2 leading-snug">{n.body}</p>
                    )}
                    <p className="text-xs text-gray-300 mt-1">{fmtTimeAgo(n.created_at)}</p>
                  </div>
                  {n.data?.requestId && (
                    <span className="text-xs text-primary-500 flex-shrink-0 mt-0.5">보기 →</span>
                  )}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      <BottomNav />
    </div>
  )
}
