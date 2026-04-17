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
import AdInterstitial from '@/components/shared/AdInterstitial'

// ── 상수 ──────────────────────────────────────────────────────────────────
const FUEL_LABELS: Record<string, string> = {
  gasoline: '가솔린', diesel: '디젤', hybrid: '하이브리드', electric: '전기', lpg: 'LPG',
}
const MAKERS = ['현대', '기아', '제네시스', 'KG 모빌리티(쌍용)', '르노코리아', 'GM 한국', '테슬라', 'BMW', '메르세데스-벤츠', '아우디', '볼보', '기타']
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
// ── FileReader로 base64 읽기 (HEIC 등 모든 포맷 대응) ────────────────────
function readFileAsBase64(file: File): Promise<{data: string; mediaType: string}> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const result = reader.result as string
      const commaIdx = result.indexOf(',')
      const header = result.slice(0, commaIdx)
      const data = result.slice(commaIdx + 1)
      const mediaType = header.match(/data:([^;]+)/)?.[1] ?? 'image/jpeg'
      resolve({ data, mediaType })
    }
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

// ── canvas 리사이즈 후 base64 (JPEG/PNG/WebP만 지원) ─────────────────────
function resizeViaCanvas(file: File, maxPx = 1024): Promise<string> {
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
      const ctx = canvas.getContext('2d')
      if (!ctx) { URL.revokeObjectURL(url); reject(new Error('no ctx')); return }
      ctx.drawImage(img, 0, 0, w, h)
      URL.revokeObjectURL(url)
      resolve(canvas.toDataURL('image/jpeg', 0.85).split(',')[1])
    }
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('img load fail')) }
    img.src = url
  })
}

// ── 이미지 → base64 변환 (canvas 우선, HEIC 등 실패 시 FileReader 폴백) ──
async function encodeImageForClaude(file: File): Promise<{data: string; mediaType: string}> {
  // 2MB 이하이거나 HEIC 파일이면 바로 FileReader (canvas는 HEIC 지원 안 함)
  const isHeic = file.type === 'image/heic' || file.type === 'image/heif' ||
    file.name.toLowerCase().endsWith('.heic') || file.name.toLowerCase().endsWith('.heif')
  if (isHeic || file.size <= 500_000) {
    const result = await readFileAsBase64(file)
    return result
  }
  // 큰 파일(>500KB)은 canvas로 1024px 리사이즈
  try {
    const data = await resizeViaCanvas(file, 1024)
    return { data, mediaType: 'image/jpeg' }
  } catch (e) {
    console.warn('[encodeImageForClaude] canvas 실패, FileReader 폴백:', e)
    // canvas 실패(HEIC 등) → 원본 FileReader (용량 클 수 있음)
    return readFileAsBase64(file)
  }
}

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
  const [uploadedImagesB64, setUploadedImagesB64] = useState<Array<{data: string; mediaType: string}>>([])
  // ref: stale closure 방지 (sendMessage useCallback 안에서 항상 최신값 참조)
  const uploadedImagesB64Ref = useRef<Array<{data: string; mediaType: string}>>([])
  const uploadedImagesRef = useRef<string[]>([])

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

  // 페이월 (일일 한도 초과)
  const [paywallOpen, setPaywallOpen] = useState(false)
  const [paymentInterestSent, setPaymentInterestSent] = useState(false)

  // 광고 인터스티셜
  const [showAdInterstitial, setShowAdInterstitial] = useState(false)

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
        content: '안녕하세요! 저는 정비톡 AI예요. 🔧\n\n진단할 차량이 내 차인가요, 아니면 다른 분의 차인가요?',
        timestamp: new Date().toISOString(),
      }])

      // 유입 경로 세션 기록 (최초 1회 / 탭별)
      try {
        const params = new URLSearchParams(window.location.search)
        const sessionKey = 'jbt_session_recorded'
        if (!sessionStorage.getItem(sessionKey)) {
          sessionStorage.setItem(sessionKey, '1')
          fetch('/api/sessions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              utm_source: params.get('utm_source'),
              utm_medium: params.get('utm_medium'),
              utm_campaign: params.get('utm_campaign'),
              referrer: document.referrer || null,
            }),
          }).catch(() => {})
        }
      } catch { /* 세션 기록 실패해도 무시 */ }
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
    const b64List: Array<{data: string; mediaType: string}> = []
    for (const file of files.slice(0, 3)) {
      // 1) base64 인코딩 (Claude Vision용) — HEIC/HEIF 포함 전 포맷 대응
      try {
        const encoded = await encodeImageForClaude(file)
        b64List.push(encoded)
        console.log('[img upload] encoded size (bytes):', Math.round(encoded.data.length * 0.75), 'type:', encoded.mediaType)
      } catch (e) {
        console.warn('[img upload] encode failed:', e)
      }
      // 2) Supabase 저장 (기록용)
      const path = `${authUser.id}/${conversationId}/${uuidv4()}.${file.name.split('.').pop()}`
      const { data, error } = await supabase.storage.from('symptom-images').upload(path, file)
      if (!error && data) {
        const { data: { publicUrl } } = supabase.storage.from('symptom-images').getPublicUrl(data.path)
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
          messages: newMessages, symptomImages: uploadedImagesRef.current, symptomImagesB64: uploadedImagesB64Ref.current, isReDiagnosis: false,
        }),
      })
      const data = await response.json()
      if (!response.ok) {
        // 일일 한도 초과 → 페이월
        if (response.status === 429 && data.error === 'DAILY_LIMIT_REACHED') {
          setPaywallOpen(true)
          setIsLoading(false)
          return
        }
        throw new Error(data.error)
      }

      if (data.data.needsMoreInfo && data.data.additionalQuestions?.length > 0) {
        const questions = data.data.additionalQuestions as DiagnosticQuestion[]
        const firstQ = questions[0]
        const restQ = questions.slice(1)

        // 이미지 분석 결과가 있으면 그걸 intro로, 없으면 기본 안내문
        const introText = data.data.imageAnalysis
          ? data.data.imageAnalysis
          : '정확한 진단을 위해 몇 가지 더 문의드려요.'
        const introMsg = createMessage('assistant', introText, 'text') as ChatMessage
        const qMsg = createMessage('assistant', firstQ.question, 'question', { questionId: firstQ.id, choices: firstQ.choices }) as ChatMessage
        setMessages(prev => [...prev, introMsg, qMsg])
        setCurrentQuestion(firstQ)
        setQuestionQueue(restQ)
        setPhase('questioning')
        // Q&A 단계: 이미지 ref 유지 (최종 진단 시에도 이미지 전달되도록)
      } else {
        // 진단 완료 → 이미지 클리어 후 광고 표시 → 결과 페이지로 이동
        uploadedImagesRef.current = []
        uploadedImagesB64Ref.current = []
        setUploadedImages([])
        setUploadedImagesB64([])
        const doneMsg = createMessage('assistant', '✅ 진단 분석이 완료되었습니다!\n광고를 잠시 확인해 주시면 결과 리포트를 보실 수 있어요.', 'text') as ChatMessage
        setMessages(prev => [...prev, doneMsg])
        setPhase('done')
        setCheckpoints([])
        // 광고 인터스티셜 표시
        setShowAdInterstitial(true)
      }
    } catch {
      const errMsg = createMessage('assistant', '죄송합니다, 진단 처리 중 오류가 발생했습니다. 다시 시도해 주세요.', 'text') as ChatMessage
      setMessages(prev => [...prev, errMsg])
      // 에러 시에도 이미지 클리어
      uploadedImagesRef.current = []
      uploadedImagesB64Ref.current = []
      setUploadedImages([])
      setUploadedImagesB64([])
    } finally {
      setIsLoading(false)
    }
  }, [messages, phase, currentQuestion, questionQueue, activeVehicleInfo, conversationId, router])

  // ── 차량 수정 저장 ───────────────────────────────────────────────────
  const handleVehicleSave = async (data: any) => {
    if (!vehicle) return
    const { error } = await supabase.from('vehicles').update(data).eq('id', vehicle.id)
    if (!error) {
      setVehicle({ ...vehicle, ...data })
      setShowEditModal(false)
    }
  }

  // ── 차고 드래그 핸들러 (훅은 조건부 return 전에 선언) ──────────────
  const handleGarageTouchStart = useCallback((e: React.TouchEvent) => {
    touchStartY.current = e.touches[0].clientY
  }, [])

  const handleGarageTouchEnd = useCallback((e: React.TouchEvent) => {
    const deltaY = e.changedTouches[0].clientY - touchStartY.current
    if (garageOpen && deltaY > 50) setGarageOpen(false)
    else if (!garageOpen && deltaY < -50) setGarageOpen(true)
  }, [garageOpen])

  // 광고 시청 완료 → 결과 페이지로 이동 (훅은 조건부 return 전에 선언)
  const handleAdComplete = useCallback(() => {
    setShowAdInterstitial(false)
    router.push(`/diagnosis/${conversationId}`)
  }, [conversationId, router])

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

  // 뒤로가기 버튼 표시 조건: 질문 단계이고 체크포인트가 있고 로딩 중 아닐 때 항상 표시
  const showBackButton = phase === 'questioning' && checkpoints.length > 0 && !isLoading

  // 현재 질문의 선택지 (중복 제거)
  const questionChoices = currentQuestion
    ? [...currentQuestion.choices.filter((c, i, arr) => arr.indexOf(c) === i),
      ...(!currentQuestion.choices.includes('모름') ? ['모름'] : []),
      '기타 (직접 입력)']
    : []

  return (
    <div className="flex flex-col h-screen bg-white max-w-[480px] mx-auto">
      {/* 광고 인터스티셜 */}
      <AdInterstitial
        isOpen={showAdInterstitial}
        onComplete={handleAdComplete}
        countdownSeconds={30}
      />

      {/* ── 헤더 ── */}
      <header
        className="px-5 pt-12 pb-4 flex items-start justify-between flex-shrink-0"
        style={{
          background: '#ffffff',
          borderBottom: '1px solid rgba(0, 0, 0, 0.06)',
        }}
      >
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl overflow-hidden shadow-sm ring-1 ring-primary-100">
              <img src="/logo.png" alt="정비톡" className="w-full h-full object-contain" />
            </div>
            <h1 className="text-xl font-black text-gray-900 tracking-tight">정비톡</h1>
          </div>
          <p className="text-[13px] text-gray-400 mt-1 ml-0.5">내 차 증상, 3분이면 알 수 있어요</p>
        </div>
        <div className="flex items-center gap-1.5">
          {/* 알림 벨 */}
          <button
            onClick={handleOpenNotif}
            className="relative w-10 h-10 flex items-center justify-center rounded-xl hover:bg-gray-100/80 text-gray-500 transition-all active:scale-95"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
              <path d="M13.73 21a2 2 0 0 1-3.46 0" />
            </svg>
            {unreadCount > 0 && (
              <span className="absolute top-1 right-1 w-4 h-4 bg-red-500 rounded-full text-white text-[9px] font-bold flex items-center justify-center ring-2 ring-white">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </button>
          {/* 프로필 */}
          <Link href="/profile">
            <div
              className="w-10 h-10 rounded-xl bg-primary-100 flex items-center justify-center overflow-hidden ring-1 ring-primary-200/50 transition-all active:scale-95"
              style={{ boxShadow: '0 2px 8px rgba(76, 77, 220, 0.1)' }}
            >
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
                className="w-full text-left relative rounded-3xl p-5 text-white overflow-hidden active:scale-[0.98] transition-all duration-200"
                style={{
                  background: 'linear-gradient(135deg, #3c3dbf 0%, #4C4DDC 40%, #6566e5 100%)',
                  boxShadow: '0 8px 30px rgba(76, 77, 220, 0.25), 0 2px 8px rgba(76, 77, 220, 0.15)',
                }}
              >
                {/* shimmer 오버레이 */}
                <div className="shimmer-overlay" />
                {/* 배경 패턴 */}
                <div className="absolute -top-8 -right-8 w-32 h-32 rounded-full" style={{ background: 'rgba(255,255,255,0.06)' }} />
                <div className="absolute -bottom-6 -left-6 w-24 h-24 rounded-full" style={{ background: 'rgba(255,255,255,0.04)' }} />

                {fuelLabel && (
                  <div className="absolute top-4 right-4 text-white text-xs font-bold px-2.5 py-1 rounded-full"
                    style={{ background: 'rgba(255,255,255,0.15)', backdropFilter: 'blur(8px)' }}
                  >{fuelLabel}</div>
                )}
                <div className="absolute bottom-4 right-4 text-white text-xs px-2.5 py-1 rounded-full flex items-center gap-1"
                  style={{ background: 'rgba(255,255,255,0.15)', backdropFilter: 'blur(8px)' }}
                >
                  <span className="text-[11px] font-semibold">수정</span>
                </div>
                <p className="text-white/60 text-xs mb-1.5 font-medium relative z-10">
                  {vehicle.nickname ? `${vehicle.nickname}의 차고` : vehicle.maker}
                </p>
                <h2 className="text-2xl font-black mb-1 relative z-10 tracking-tight">{vehicle.model}</h2>
                <p className="text-white/60 text-sm relative z-10">{vehicle.year}년식 · {vehicle.mileage?.toLocaleString()}km</p>
              </button>
            ) : (
              <Link href="/vehicles/new"
                className="block rounded-3xl p-5 text-center transition-all hover:shadow-md active:scale-[0.98]"
                style={{
                  background: '#ffffff',
                  border: '2px dashed rgba(76, 77, 220, 0.2)',
                  boxShadow: '0 2px 12px rgba(0, 0, 0, 0.03)',
                }}
              >
                <div className="w-14 h-14 mx-auto mb-3 rounded-2xl flex items-center justify-center"
                  style={{ background: 'rgba(76, 77, 220, 0.06)' }}
                >
                  <span className="text-2xl">🚗</span>
                </div>
                <p className="font-bold text-gray-700 text-sm">차량 정보 등록하기</p>
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
        <div className="flex items-center gap-2.5 mb-3 px-1">
          <div className="w-6 h-6 rounded-lg flex items-center justify-center"
            style={{ background: '#4C4DDC' }}
          >
            <span className="text-white text-xs font-black">AI</span>
          </div>
          <h3 className="font-bold text-gray-900 text-sm tracking-tight">정비톡 AI와 상담하기</h3>
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
              className="flex-1 py-3.5 px-4 rounded-2xl text-sm font-bold text-primary-700 transition-all active:scale-[0.97]"
              style={{
                background: '#ffffff',
                border: '1.5px solid rgba(76, 77, 220, 0.2)',
                boxShadow: '0 2px 12px rgba(76, 77, 220, 0.06)',
              }}
            >
              🚗 내 차
            </button>
            <button onClick={() => handleCarType('other')}
              className="flex-1 py-3.5 px-4 rounded-2xl text-sm font-semibold text-gray-600 transition-all active:scale-[0.97]"
              style={{
                background: '#ffffff',
                border: '1.5px solid rgba(0, 0, 0, 0.08)',
                boxShadow: '0 1px 4px rgba(0, 0, 0, 0.03)',
              }}
            >
              🔍 등록되지 않은 차
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

            {/* 빠른 선택 칩 버튼 (스태거 애니메이션) */}
            <div className="flex flex-wrap gap-2 stagger-children">
              {currentQuestion.choices.filter((c, i, arr) => arr.indexOf(c) === i).concat(['잘 모르겠어요']).map((choice, i) => (
                <button
                  key={`${currentQuestion.id}-${i}`}
                  onClick={() => sendMessage(choice, 'answer', currentQuestion.id)}
                  className={`px-3.5 py-2 rounded-xl text-sm font-medium transition-all duration-200 active:scale-95 ${
                    choice === '잘 모르겠어요'
                      ? 'text-gray-400 border border-gray-200 bg-white hover:bg-gray-50 hover:text-gray-500'
                      : 'text-primary-700 bg-white hover:text-primary-800'
                  }`}
                  style={choice !== '잘 모르겠어요' ? {
                    border: '1.5px solid rgba(76, 77, 220, 0.15)',
                    boxShadow: '0 1px 4px rgba(76, 77, 220, 0.06)',
                  } : undefined}
                >
                  {choice}
                </button>
              ))}
            </div>
            <p className="text-[11px] text-gray-400 ml-0.5">선택하거나 아래 입력창에 직접 입력하세요</p>
          </div>
        )}

        {isLoading && <TypingIndicator />}
        <div ref={messagesEndRef} />
      </div>

      {/* ── 채팅 입력창 (항상 표시 — 질문 중에도 자유 입력 가능) ── */}
      {(phase === 'symptom' || phase === 'questioning') && !isLoading && (
        <ChatInput
          onSend={(text) => {
            if (phase === 'questioning' && currentQuestion) {
              // 질문 단계에서 자유 입력 → 현재 질문 답변으로 처리
              sendMessage(text, 'answer', currentQuestion.id)
            } else {
              sendMessage(text)
            }
          }}
          onImageUpload={handleImageUpload}
          uploadedImages={uploadedImages}
          onRemoveImage={(url) => {
            const idx = uploadedImagesRef.current.indexOf(url)
            if (idx !== -1) {
              uploadedImagesRef.current = uploadedImagesRef.current.filter((_, i) => i !== idx)
              uploadedImagesB64Ref.current = uploadedImagesB64Ref.current.filter((_, i) => i !== idx)
              setUploadedImages([...uploadedImagesRef.current])
              setUploadedImagesB64([...uploadedImagesB64Ref.current])
            }
          }}
          disabled={isLoading}
          placeholder={
            phase === 'questioning'
              ? '선택하거나 직접 입력하세요...'
              : '증상을 자유롭게 설명해주세요...'
          }
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

      {/* ── 페이월: 일일 진단 한도 초과 ── */}
      {paywallOpen && (
        <div className="fixed inset-0 z-50 flex flex-col justify-end">
          <div className="absolute inset-0 bg-black/50" onClick={() => setPaywallOpen(false)} />
          <div className="relative bg-white rounded-t-3xl px-5 pt-6 pb-10 safe-area-pb">
            <div className="w-10 h-1 bg-gray-200 rounded-full mx-auto mb-5" />

            {/* 아이콘 + 제목 */}
            <div className="text-center mb-5">
              <div className="text-5xl mb-3">🔒</div>
              <h2 className="text-xl font-black text-gray-900 mb-1">오늘 진단 횟수를 모두 사용했어요</h2>
              <p className="text-sm text-gray-500 leading-relaxed">
                무료 플랜은 하루 <span className="font-bold text-gray-700">3회</span>까지 진단할 수 있어요.<br/>
                추가 진단이 필요하시면 프리미엄으로 업그레이드하세요.
              </p>
            </div>

            {/* 플랜 비교 */}
            <div className="grid grid-cols-2 gap-3 mb-5">
              <div className="bg-gray-50 rounded-2xl p-4 border border-gray-200">
                <p className="text-xs font-semibold text-gray-400 mb-1">무료 플랜</p>
                <p className="text-lg font-black text-gray-400 mb-2">₩0</p>
                <ul className="text-xs text-gray-400 space-y-1">
                  <li>✓ 하루 3회 진단</li>
                  <li>✓ 기본 리포트</li>
                  <li className="text-gray-300">✗ 무제한 진단</li>
                  <li className="text-gray-300">✗ 상세 분석</li>
                </ul>
              </div>
              <div className="bg-primary-50 rounded-2xl p-4 border-2 border-primary-400 relative">
                <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 bg-primary-500 text-white text-[10px] font-bold px-2.5 py-0.5 rounded-full">추천</span>
                <p className="text-xs font-semibold text-primary-600 mb-1">프리미엄</p>
                <p className="text-lg font-black text-primary-700 mb-2">₩9,900<span className="text-xs font-normal">/월</span></p>
                <ul className="text-xs text-primary-700 space-y-1">
                  <li>✓ <span className="font-bold">무제한</span> 진단</li>
                  <li>✓ 심층 리포트</li>
                  <li>✓ 정비소 연결</li>
                  <li>✓ 내역 영구 보관</li>
                </ul>
              </div>
            </div>

            {/* CTA 버튼 */}
            {paymentInterestSent ? (
              <div className="text-center py-4">
                <p className="text-2xl mb-1">🙏</p>
                <p className="text-sm font-bold text-gray-700">관심 등록 감사해요!</p>
                <p className="text-xs text-gray-400 mt-1">서비스 준비가 완료되면 먼저 알려드릴게요</p>
              </div>
            ) : (
              <>
                <button
                  onClick={async () => {
                    // 스모크 테스트: 결제 의향 기록
                    await fetch('/api/payment-interest', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ plan: 'premium_monthly', source: 'daily_limit_paywall' }),
                    }).catch(() => {})
                    setPaymentInterestSent(true)
                  }}
                  className="w-full py-4 bg-primary-600 text-white font-black text-base rounded-2xl shadow-lg hover:bg-primary-700 active:scale-[0.98] transition-all mb-3"
                >
                  프리미엄 시작하기 →
                </button>
                <button
                  onClick={() => setPaywallOpen(false)}
                  className="w-full py-3 text-gray-400 text-sm font-medium"
                >
                  내일 무료로 계속하기
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
