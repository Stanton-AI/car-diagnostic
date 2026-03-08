'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
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

export default function NewVehiclePage() {
  const router = useRouter()
  const supabase = createClient()
  const [form, setForm] = useState({
    maker: '', model: '', year: CURRENT_YEAR, mileage: '', fuelType: 'gasoline' as FuelType, plateNumber: '', nickname: '',
  })
  const [saving, setSaving] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})

  const validate = () => {
    const errs: Record<string, string> = {}
    if (!form.maker) errs.maker = '제조사를 선택해 주세요'
    if (!form.model.trim()) errs.model = '모델명을 입력해 주세요'
    if (!form.mileage || isNaN(Number(form.mileage))) errs.mileage = '주행거리를 입력해 주세요'
    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  const handleSubmit = async () => {
    if (!validate()) return
    setSaving(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login?redirect=/vehicles/new'); return }

      const { error } = await supabase.from('vehicles').insert({
        user_id: user.id,
        maker: form.maker,
        model: form.model.trim(),
        year: form.year,
        mileage: Number(form.mileage),
        fuel_type: form.fuelType,
        plate_number: form.plateNumber.trim() || null,
        nickname: form.nickname.trim() || null,
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
      <header className="flex items-center gap-3 px-4 pt-14 pb-4">
        <button onClick={() => router.back()} className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-gray-100 transition-colors text-gray-500">
          ←
        </button>
        <h1 className="text-lg font-black text-gray-900">차량 등록</h1>
        <div className="ml-auto">
          <span className="text-xs bg-amber-100 text-amber-700 px-2.5 py-1 rounded-full font-medium">공공API 연동 예정</span>
        </div>
      </header>

      <div className="flex-1 px-5 pb-32 space-y-5">
        {/* 안내 */}
        <div className="bg-primary-50 rounded-2xl p-4 border border-primary-100">
          <p className="text-xs text-primary-700 leading-relaxed">
            <span className="font-bold">💡 차량번호 자동 조회 기능</span>이 준비 중입니다. 현재는 직접 입력해 주세요.
            API 승인 완료 후 차량번호만 입력하면 자동으로 정보를 불러올 수 있습니다.
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

        {/* 별명 (선택) */}
        <div>
          <label className="text-sm font-bold text-gray-700 mb-2 block">차량 별명 <span className="text-gray-400 font-normal">(선택)</span></label>
          <input
            type="text"
            value={form.nickname}
            onChange={e => set('nickname', e.target.value)}
            placeholder="예: 내 첫 차, 회사 차량..."
            className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-primary-400"
          />
        </div>
      </div>

      {/* 저장 버튼 */}
      <div className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[480px] px-5 pb-8 pt-4 bg-white border-t border-gray-100">
        <button
          onClick={handleSubmit}
          disabled={saving}
          className="w-full py-4 bg-primary-600 text-white font-bold rounded-2xl text-sm hover:bg-primary-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {saving ? <span className="animate-spin">⟳</span> : null}
          차량 등록 완료
        </button>
      </div>
    </div>
  )
}
