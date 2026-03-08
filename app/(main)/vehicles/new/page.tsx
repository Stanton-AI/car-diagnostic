'use client'
import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { FuelType } from '@/types'

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

const ADJECTIVES = ['빠른', '멋진', '든든한', '날쌘', '튼튼한', '활발한', '강한', '씩씩한', '용감한', '믿음직한']
const NOUNS = ['붕붕이', '터보', '엔진', '드라이버', '질주마', '달리기', '로켓', '바퀴', '스피드', '레이서']

function generateRandomNickname(): string {
  const adj = ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)]
  const noun = NOUNS[Math.floor(Math.random() * NOUNS.length)]
  return `${adj}${noun}`
}

function NewVehicleContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const isFirstTime = searchParams.get('first') === 'true'
  const supabase = createClient()

  const [form, setForm] = useState({
    maker: '', model: '', year: CURRENT_YEAR, mileage: '', fuelType: 'gasoline' as FuelType,
    plateNumber: '', nickname: generateRandomNickname(),
  })
  const [saving, setSaving] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [checkingNickname, setCheckingNickname] = useState(false)
  const [nicknameOk, setNicknameOk] = useState(false)

  // 닉네임 중복 확인 (디바운스)
  useEffect(() => {
    setNicknameOk(false)
    if (!form.nickname || form.nickname.length < 2 || form.nickname.length > 10) return
    setCheckingNickname(true)
    const timer = setTimeout(async () => {
      const { count } = await supabase
        .from('vehicles')
        .select('*', { count: 'exact', head: true })
        .eq('nickname', form.nickname)
      setCheckingNickname(false)
      if ((count ?? 0) > 0) {
        setErrors(prev => ({ ...prev, nickname: '이미 사용 중인 닉네임이에요.' }))
        setNicknameOk(false)
      } else {
        setErrors(prev => { const e = { ...prev }; delete e.nickname; return e })
        setNicknameOk(true)
      }
    }, 600)
    return () => { clearTimeout(timer); setCheckingNickname(false) }
  }, [form.nickname])

  const regenerateNickname = () => {
    setForm(prev => ({ ...prev, nickname: generateRandomNickname() }))
  }

  const validate = () => {
    const errs: Record<string, string> = { ...errors }
    if (!form.maker) errs.maker = '제조사를 선택해 주세요'
    if (!form.model.trim()) errs.model = '모델명을 입력해 주세요'
    if (!form.mileage || isNaN(Number(form.mileage))) errs.mileage = '주행거리를 입력해 주세요'
    const nick = form.nickname.trim()
    if (!nick) errs.nickname = '차량 닉네임을 입력해 주세요'
    else if (nick.length < 2) errs.nickname = '닉네임은 최소 2자 이상이에요'
    else if (nick.length > 10) errs.nickname = '닉네임은 최대 10자까지 가능해요'
    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  const handleSubmit = async () => {
    if (!validate()) return
    setSaving(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/'); return }

      const { error } = await supabase.from('vehicles').insert({
        user_id: user.id,
        maker: form.maker,
        model: form.model.trim(),
        year: form.year,
        mileage: Number(form.mileage),
        fuel_type: form.fuelType,
        plate_number: form.plateNumber.trim() || null,
        nickname: form.nickname.trim(),
      })
      if (error) throw error
      router.push('/main')
    } catch (e) {
      console.error(e)
    } finally {
      setSaving(false)
    }
  }

  const set = (key: string, value: unknown) => setForm(prev => ({ ...prev, [key]: value }))

  return (
    <div className="flex flex-col min-h-screen bg-white">
      {/* 헤더 */}
      <header className="flex items-center gap-3 px-4 pt-14 pb-4 border-b border-gray-100">
        {!isFirstTime && (
          <button onClick={() => router.back()} className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-gray-100 transition-colors text-gray-500">
            ←
          </button>
        )}
        <div className={isFirstTime ? 'pl-1' : ''}>
          <h1 className="text-lg font-black text-gray-900">차량 등록</h1>
          {isFirstTime && <p className="text-xs text-gray-400 mt-0.5">진단 정확도를 높이기 위해 차량을 먼저 등록해 주세요</p>}
        </div>
        <div className="ml-auto">
          <span className="text-xs bg-amber-100 text-amber-700 px-2.5 py-1 rounded-full font-medium">공공API 연동 예정</span>
        </div>
      </header>

      <div className="flex-1 px-5 pb-32 space-y-5 pt-5">

        {/* 차량 닉네임 (필수) */}
        <div className="bg-primary-50 rounded-2xl p-4 border border-primary-100">
          <label className="text-sm font-bold text-gray-800 mb-1 block">
            차량 닉네임 <span className="text-red-500">*</span>
            <span className="text-xs font-normal text-gray-400 ml-1">2~10자 · 전체 중복 불가</span>
          </label>
          <p className="text-xs text-gray-500 mb-3">나만의 차량 이름을 정해 주세요. 🎲 버튼으로 랜덤 생성도 가능해요.</p>
          <div className="flex gap-2">
            <div className="flex-1 relative">
              <input
                type="text"
                value={form.nickname}
                onChange={e => set('nickname', e.target.value)}
                maxLength={10}
                placeholder="예: 날쌘터보"
                className={`w-full px-4 py-3 rounded-xl border text-sm focus:outline-none ${
                  errors.nickname
                    ? 'border-red-300 bg-red-50 focus:border-red-400'
                    : nicknameOk
                    ? 'border-green-300 bg-green-50 focus:border-green-400'
                    : 'border-primary-200 focus:border-primary-400 bg-white'
                }`}
              />
              {checkingNickname && (
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">확인 중...</span>
              )}
            </div>
            <button
              onClick={regenerateNickname}
              type="button"
              className="px-3 py-3 bg-white border border-primary-200 rounded-xl text-xl hover:bg-primary-50 transition-colors"
              title="랜덤 닉네임 다시 생성"
            >
              🎲
            </button>
          </div>
          {errors.nickname && <p className="text-xs text-red-500 mt-1.5">{errors.nickname}</p>}
          {nicknameOk && !checkingNickname && (
            <p className="text-xs text-green-600 mt-1.5 font-medium">✓ 사용 가능한 닉네임이에요</p>
          )}
        </div>

        {/* 안내 */}
        <div className="bg-gray-50 rounded-2xl p-4 border border-gray-100">
          <p className="text-xs text-gray-500 leading-relaxed">
            <span className="font-bold text-gray-700">💡 차량번호 자동 조회 기능</span>이 준비 중입니다. 현재는 직접 입력해 주세요.
          </p>
        </div>

        {/* 제조사 */}
        <div>
          <label className="text-sm font-bold text-gray-700 mb-2 block">제조사 <span className="text-red-500">*</span></label>
          <div className="grid grid-cols-3 gap-2">
            {MAKERS.map(m => (
              <button
                key={m}
                onClick={() => set('maker', m)}
                className={`py-2.5 px-3 text-sm rounded-xl border transition-all ${form.maker === m ? 'bg-primary-600 text-white border-primary-600 font-semibold' : 'bg-white text-gray-600 border-gray-200 hover:border-primary-300'}`}
              >
                {m}
              </button>
            ))}
          </div>
          {errors.maker && <p className="text-xs text-red-500 mt-1">{errors.maker}</p>}
        </div>

        {/* 모델명 */}
        <div>
          <label className="text-sm font-bold text-gray-700 mb-2 block">모델명 <span className="text-red-500">*</span></label>
          <input
            type="text"
            value={form.model}
            onChange={e => set('model', e.target.value)}
            placeholder="예: 아반떼, 소나타, 그랜저..."
            className={`w-full px-4 py-3 rounded-xl border text-sm focus:outline-none ${errors.model ? 'border-red-300 focus:border-red-400' : 'border-gray-200 focus:border-primary-400'}`}
          />
          {errors.model && <p className="text-xs text-red-500 mt-1">{errors.model}</p>}
        </div>

        {/* 연식 */}
        <div>
          <label className="text-sm font-bold text-gray-700 mb-2 block">연식 <span className="text-red-500">*</span></label>
          <select
            value={form.year}
            onChange={e => set('year', Number(e.target.value))}
            className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-primary-400 bg-white"
          >
            {YEARS.map(y => <option key={y} value={y}>{y}년식</option>)}
          </select>
        </div>

        {/* 연료 */}
        <div>
          <label className="text-sm font-bold text-gray-700 mb-2 block">연료 <span className="text-red-500">*</span></label>
          <div className="flex flex-wrap gap-2">
            {FUEL_TYPES.map(f => (
              <button
                key={f.value}
                onClick={() => set('fuelType', f.value)}
                className={`px-4 py-2.5 text-sm rounded-xl border transition-all ${form.fuelType === f.value ? 'bg-primary-600 text-white border-primary-600 font-semibold' : 'bg-white text-gray-600 border-gray-200 hover:border-primary-300'}`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {/* 주행거리 */}
        <div>
          <label className="text-sm font-bold text-gray-700 mb-2 block">현재 주행거리 <span className="text-red-500">*</span></label>
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

        {/* 차량번호 (선택) */}
        <div>
          <label className="text-sm font-bold text-gray-700 mb-1 block">차량번호 <span className="text-gray-400 font-normal">(선택)</span></label>
          <p className="text-xs text-gray-400 mb-2">암호화 저장 · 공공API 자동 조회 연동 시 활용</p>
          <input
            type="text"
            value={form.plateNumber}
            onChange={e => set('plateNumber', e.target.value)}
            placeholder="예: 123가 4567"
            className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-primary-400"
          />
        </div>
      </div>

      {/* 저장 버튼 */}
      <div className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[480px] px-5 pb-8 pt-4 bg-white border-t border-gray-100">
        <button
          onClick={handleSubmit}
          disabled={saving || checkingNickname || !!errors.nickname}
          className="w-full py-4 bg-primary-600 text-white font-bold rounded-2xl text-sm hover:bg-primary-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {saving ? <span className="animate-spin">⟳</span> : null}
          차량 등록 완료
        </button>
      </div>
    </div>
  )
}

export default function NewVehiclePage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center min-h-screen"><div className="w-10 h-10 border-2 border-primary-200 border-t-primary-600 rounded-full animate-spin" /></div>}>
      <NewVehicleContent />
    </Suspense>
  )
}
