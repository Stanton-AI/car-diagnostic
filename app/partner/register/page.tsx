'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { SHOP_CATEGORIES } from '@/lib/marketplace'

export default function PartnerRegisterPage() {
  const router = useRouter()
  const supabase = createClient()

  const [name, setName] = useState('')
  const [ownerName, setOwnerName] = useState('')
  const [phone, setPhone] = useState('')
  const [address, setAddress] = useState('')
  const [description, setDescription] = useState('')
  const [businessNumber, setBusinessNumber] = useState('')
  const [selectedCats, setSelectedCats] = useState<string[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    const check = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) router.replace('/login?redirect=/partner/register')
    }
    check()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleSubmit = async () => {
    if (!name.trim() || !ownerName.trim() || !phone.trim() || !address.trim()) {
      setError('상호명, 대표자명, 전화번호, 주소는 필수입니다')
      return
    }
    setError('')
    setSubmitting(true)

    const res = await fetch('/api/partner-shops/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: name.trim(),
        ownerName: ownerName.trim(),
        phone: phone.trim(),
        address: address.trim(),
        description: description.trim() || undefined,
        businessNumber: businessNumber.trim() || undefined,
        categories: selectedCats,
      }),
    })

    setSubmitting(false)

    if (res.status === 409) {
      router.replace('/partner')
      return
    }

    if (!res.ok) {
      const data = await res.json()
      setError(data.error ?? '신청 중 오류가 발생했습니다')
      return
    }

    router.replace('/partner')
  }

  return (
    <div className="flex flex-col min-h-screen bg-surface-50">
      <header className="bg-white px-4 pt-14 pb-4 flex items-center gap-3 border-b border-gray-100">
        <button onClick={() => router.back()} className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-500">←</button>
        <h1 className="text-lg font-black text-gray-900">파트너 정비소 신청</h1>
      </header>

      <div className="px-4 py-4 space-y-4 pb-32">

        {/* 안내 */}
        <div className="bg-blue-50 rounded-xl p-4 border border-blue-100">
          <h2 className="text-sm font-bold text-blue-800 mb-1">🤝 파트너 혜택</h2>
          <ul className="text-xs text-blue-700 space-y-1">
            <li>• 인근 지역 수리 요청 실시간 알림</li>
            <li>• 관리자 승인 후 견적 입찰 가능</li>
            <li>• 낙찰 시 수수료 10% (Pro 플랜: 7%)</li>
          </ul>
        </div>

        {/* 정비소 정보 */}
        <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm space-y-4">
          <h2 className="font-bold text-gray-900">정비소 기본 정보</h2>

          {[
            { label: '상호명', value: name, setter: setName, placeholder: '예: 강남 종합 자동차 정비', required: true },
            { label: '대표자명', value: ownerName, setter: setOwnerName, placeholder: '예: 홍길동', required: true },
            { label: '전화번호', value: phone, setter: setPhone, placeholder: '02-0000-0000 또는 010-0000-0000', required: true },
            { label: '주소', value: address, setter: setAddress, placeholder: '서울 강남구 테헤란로 123', required: true },
            { label: '사업자등록번호', value: businessNumber, setter: setBusinessNumber, placeholder: '000-00-00000', required: false },
          ].map(field => (
            <div key={field.label}>
              <label className="text-xs font-semibold text-gray-600 mb-1.5 block">
                {field.label} {field.required && <span className="text-red-500">*</span>}
              </label>
              <input
                type="text"
                value={field.value}
                onChange={e => field.setter(e.target.value)}
                placeholder={field.placeholder}
                className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-primary-400"
              />
            </div>
          ))}

          <div>
            <label className="text-xs font-semibold text-gray-600 mb-1.5 block">정비소 소개 (선택)</label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="경력, 전문 분야, 특기 등을 자유롭게 소개해 주세요"
              rows={3}
              className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-primary-400 resize-none"
            />
          </div>
        </div>

        {/* 전문 분야 */}
        <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm">
          <h2 className="font-bold text-gray-900 mb-3">전문 수리 분야 (선택)</h2>
          <div className="flex flex-wrap gap-2">
            {Object.entries(SHOP_CATEGORIES).map(([key, label]) => (
              <button
                key={key}
                onClick={() => setSelectedCats(prev =>
                  prev.includes(key) ? prev.filter(c => c !== key) : [...prev, key]
                )}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${
                  selectedCats.includes(key)
                    ? 'bg-primary-600 text-white border-primary-600'
                    : 'bg-gray-50 text-gray-600 border-gray-200 hover:border-gray-300'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {error && (
          <div className="bg-red-50 rounded-xl p-3 border border-red-200">
            <p className="text-sm text-red-600">{error}</p>
          </div>
        )}
      </div>

      {/* 하단 CTA */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 px-4 py-4">
        <button
          onClick={handleSubmit}
          disabled={submitting}
          className="w-full py-4 bg-primary-600 text-white font-bold rounded-2xl hover:bg-primary-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {submitting ? (
            <><span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> 신청 중...</>
          ) : '파트너 신청하기'}
        </button>
        <p className="text-center text-xs text-gray-400 mt-2">관리자 승인 후 (1~2 영업일) 활성화됩니다</p>
      </div>
    </div>
  )
}
