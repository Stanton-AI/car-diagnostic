'use client'
import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { createRepairRequest, calcDealerPrice, TIME_SLOTS } from '@/lib/marketplace'
import { formatKRW } from '@/lib/utils'

interface ConvSummary {
  symptom_summary: string
  diagnosis_category: string | null
  urgency_level: string | null
  dealer_parts_min: number | null
  dealer_parts_max: number | null
  dealer_labor_min: number | null
  dealer_labor_max: number | null
  vehicle_maker: string | null
  vehicle_model: string | null
  vehicle_year: number | null
  vehicle_mileage: number | null
}

const URGENCY_COLOR: Record<string, string> = {
  HIGH: 'text-red-600 bg-red-50 border-red-200',
  MID:  'text-amber-600 bg-amber-50 border-amber-200',
  LOW:  'text-green-600 bg-green-50 border-green-200',
}
const URGENCY_LABEL: Record<string, string> = {
  HIGH: '즉시 점검 필요', MID: '조기 점검 권장', LOW: '여유 있게 점검',
}

export default function RepairRequestPage() {
  const router = useRouter()
  const { conversationId } = useParams<{ conversationId: string }>()
  const supabase = createClient()

  const [conv, setConv] = useState<ConvSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)

  // 폼 상태
  const [phone, setPhone] = useState('')
  const [location, setLocation] = useState('')
  const [preferredDate, setPreferredDate] = useState('')
  const [notes, setNotes] = useState('')
  const [preferredTimeSlot, setPreferredTimeSlot] = useState('')

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.replace('/login'); return }

      // 프로필에서 전화번호 가져오기 시도
      const { data: profile } = await supabase.from('users').select('display_name').eq('id', user.id).single()
      void profile

      const { data: conv } = await supabase
        .from('conversations')
        .select(`
          initial_symptom,
          final_result,
          self_check_result,
          category,
          urgency,
          cost_min,
          cost_max,
          vehicles(maker, model, year, mileage)
        `)
        .eq('id', conversationId)
        .eq('user_id', user.id)
        .single()

      if (!conv) { router.replace('/main'); return }

      const result = conv.self_check_result ?? conv.final_result
      const costMin = conv.cost_min ?? result?.cost?.total ?? 0
      const costMax = conv.cost_max ?? result?.cost?.total ?? 0

      const dealerParts = calcDealerPrice(Math.round(costMin * 0.5), Math.round(costMax * 0.5))
      const dealerLabor = calcDealerPrice(Math.round(costMin * 0.4), Math.round(costMax * 0.4))

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const v = conv.vehicles as any

      setConv({
        symptom_summary: conv.initial_symptom,
        diagnosis_category: conv.category ?? null,
        urgency_level: conv.urgency ?? result?.urgency ?? null,
        dealer_parts_min: dealerParts.min,
        dealer_parts_max: dealerParts.max,
        dealer_labor_min: dealerLabor.min,
        dealer_labor_max: dealerLabor.max,
        vehicle_maker: v?.maker ?? null,
        vehicle_model: v?.model ?? null,
        vehicle_year: v?.year ?? null,
        vehicle_mileage: v?.mileage ?? null,
      })

      if (conv.category) setSelectedCats([conv.category])
      setLoading(false)
    }
    load()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversationId])

  const handleSubmit = async () => {
    if (!conv || !location.trim()) return
    setSubmitting(true)

    const result = await createRepairRequest({
      conversationId,
      symptomSummary: conv.symptom_summary,
      diagnosisCategory: conv.diagnosis_category ?? undefined,
      urgencyLevel: conv.urgency_level ?? undefined,
      dealerPartsMin: conv.dealer_parts_min ?? undefined,
      dealerPartsMax: conv.dealer_parts_max ?? undefined,
      dealerLaborMin: conv.dealer_labor_min ?? undefined,
      dealerLaborMax: conv.dealer_labor_max ?? undefined,
      contactPhone: phone || undefined,
      preferredLocation: location,
      preferredDate: preferredDate || undefined,
      preferredTimeSlot: preferredTimeSlot || undefined,
      consumerNotes: notes || undefined,
      vehicleMaker: conv.vehicle_maker ?? undefined,
      vehicleModel: conv.vehicle_model ?? undefined,
      vehicleYear: conv.vehicle_year ?? undefined,
      vehicleMileage: conv.vehicle_mileage ?? undefined,
    })

    setSubmitting(false)
    if (result?.id) {
      router.push(`/repair/${result.id}`)
    } else {
      alert('요청 전송에 실패했습니다. 다시 시도해주세요.')
    }
  }

  if (loading) return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="w-8 h-8 border-2 border-primary-200 border-t-primary-600 rounded-full animate-spin" />
    </div>
  )

  const dealerTotal = conv ? (conv.dealer_parts_max ?? 0) + (conv.dealer_labor_max ?? 0) : 0

  return (
    <div className="flex flex-col min-h-screen bg-surface-50">
      {/* 헤더 */}
      <header className="bg-white px-4 pt-14 pb-4 flex items-center gap-3 border-b border-gray-100">
        <button
          onClick={() => router.back()}
          className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-500"
        >←</button>
        <h1 className="text-lg font-black text-gray-900">수리 견적 받기</h1>
      </header>

      <div className="px-4 py-4 space-y-4 pb-32">

        {/* 딜러 기준가 앵커 */}
        {dealerTotal > 0 && (
          <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-2xl p-4 border border-blue-100">
            <p className="text-xs text-blue-500 font-semibold mb-1">🏢 공식 서비스센터 기준 예상 수리비</p>
            <p className="text-2xl font-black text-blue-800">
              {formatKRW((conv?.dealer_parts_min ?? 0) + (conv?.dealer_labor_min ?? 0))} ~{' '}
              {formatKRW(dealerTotal)}
            </p>
            <p className="text-xs text-blue-400 mt-1">
              견적을 통해 최대 {formatKRW(Math.round(dealerTotal * 0.5 / 10000) * 10000)} 저렴하게 고치세요
            </p>
          </div>
        )}

        {/* 진단 요약 */}
        {conv && (
          <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1">
                <p className="text-xs text-gray-400 mb-1">진단 내용</p>
                <p className="text-sm text-gray-800 font-medium leading-snug">
                  {conv.symptom_summary.slice(0, 80)}{conv.symptom_summary.length > 80 ? '...' : ''}
                </p>
              </div>
              {conv.urgency_level && (
                <span className={`flex-shrink-0 text-xs font-bold px-2 py-1 rounded-lg border ${URGENCY_COLOR[conv.urgency_level] ?? ''}`}>
                  {URGENCY_LABEL[conv.urgency_level]}
                </span>
              )}
            </div>
            {conv.vehicle_maker && (
              <p className="text-xs text-gray-400 mt-2">
                🚗 {conv.vehicle_maker} {conv.vehicle_model} · {conv.vehicle_year}년식
              </p>
            )}
          </div>
        )}

        {/* 연락처 */}
        <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm space-y-4">
          <h2 className="font-bold text-gray-900">📋 견적 요청 정보</h2>

          <div>
            <label className="text-xs font-semibold text-gray-600 mb-1.5 block">연락처 (선택)</label>
            <input
              type="tel"
              value={phone}
              onChange={e => setPhone(e.target.value)}
              placeholder="010-0000-0000"
              className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-primary-400"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-gray-600 mb-1.5 block">
              수리 희망 지역 <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={location}
              onChange={e => setLocation(e.target.value)}
              placeholder="예: 서울 강남구, 경기 성남시 분당구"
              className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-primary-400"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-gray-600 mb-1.5 block">희망 수리 날짜 (선택)</label>
              <input
                type="date"
                value={preferredDate}
                onChange={e => setPreferredDate(e.target.value)}
                min={new Date().toISOString().split('T')[0]}
                className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-primary-400"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-600 mb-1.5 block">희망 시간대 (선택)</label>
              <select
                value={preferredTimeSlot}
                onChange={e => setPreferredTimeSlot(e.target.value)}
                className="w-full px-3 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-primary-400 bg-white"
              >
                <option value="">시간대 선택</option>
                {TIME_SLOTS.map(s => (
                  <option key={s.value} value={s.value}>{s.label}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-gray-600 mb-1.5 block">추가 요청사항 (선택)</label>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="예: 주말 수리 가능한 곳, 대차 서비스 필요 등"
              rows={3}
              className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-primary-400 resize-none"
            />
          </div>
        </div>

        {/* 안내 */}
        <div className="bg-amber-50 rounded-xl p-3 border border-amber-100">
          <p className="text-xs text-amber-700">
            ⏱ 견적 요청 후 <strong>48시간 이내</strong> 파트너 정비소들의 입찰이 진행됩니다.<br />
            입찰된 견적을 비교하고 마음에 드는 곳을 선택하세요.
          </p>
        </div>
      </div>

      {/* 하단 CTA */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 px-4 py-4 safe-area-bottom">
        <button
          onClick={handleSubmit}
          disabled={submitting || !location.trim()}
          className="w-full py-4 bg-primary-600 text-white font-bold rounded-2xl hover:bg-primary-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2 text-base"
        >
          {submitting ? (
            <><span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> 요청 중...</>
          ) : (
            '🔧 견적 요청 보내기'
          )}
        </button>
        <p className="text-center text-xs text-gray-400 mt-2">무료 · 비용 없이 여러 정비소 견적 비교 가능</p>
      </div>
    </div>
  )
}
