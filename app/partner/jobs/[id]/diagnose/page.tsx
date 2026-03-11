'use client'
import { useState, useEffect, useRef } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { getMyShop } from '@/lib/marketplace'
import { formatKRW } from '@/lib/utils'

interface DiagItem { code: string; name: string; description: string; severity: 'critical' | 'major' | 'minor' }
interface PartItem  { part_name: string; part_code: string; unit_cost: number; qty: number }

const SEVERITY_OPT = [
  { value: 'critical', label: '즉시 수리 필요', color: 'text-red-600 bg-red-50 border-red-300' },
  { value: 'major',    label: '조기 수리 권장', color: 'text-amber-600 bg-amber-50 border-amber-300' },
  { value: 'minor',    label: '관찰 필요',       color: 'text-blue-600 bg-blue-50 border-blue-300' },
]

function numFmt(v: number) { return v > 0 ? v.toLocaleString() : '' }

export default function DiagnosePage() {
  const router = useRouter()
  const { id: jobId } = useParams<{ id: string }>()
  const supabase = createClient()
  const fileRef = useRef<HTMLInputElement>(null)

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [existing, setExisting] = useState<{ consumer_decision: string } | null>(null)

  const [diagItems, setDiagItems] = useState<DiagItem[]>([
    { code: '', name: '', description: '', severity: 'major' }
  ])
  const [parts, setParts] = useState<PartItem[]>([
    { part_name: '', part_code: '', unit_cost: 0, qty: 1 }
  ])
  const [laborCost, setLaborCost] = useState(0)
  const [mechanicNotes, setMechanicNotes] = useState('')
  const [photos, setPhotos] = useState<string[]>([])

  useEffect(() => {
    const load = async () => {
      const shop = await getMyShop(supabase)
      if (!shop || shop.status !== 'active') { router.replace('/partner'); return }

      // 기존 진단 결과 조회
      const { data } = await supabase
        .from('precise_diagnoses')
        .select('*')
        .eq('job_id', jobId)
        .maybeSingle()

      if (data) {
        setExisting({ consumer_decision: data.consumer_decision })
        if (data.diagnosis_items?.length) setDiagItems(data.diagnosis_items)
        if (data.parts_needed?.length)    setParts(data.parts_needed)
        if (data.labor_cost)              setLaborCost(data.labor_cost)
        if (data.mechanic_notes)          setMechanicNotes(data.mechanic_notes)
        if (data.photos?.length)          setPhotos(data.photos)
      }
      setLoading(false)
    }
    load()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jobId])

  const partsTotal = parts.reduce((s, p) => s + (p.unit_cost * p.qty), 0)
  const totalCost  = partsTotal + laborCost

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? [])
    if (!files.length) return
    setUploading(true)
    try {
      const urls = await Promise.all(files.map(async (file) => {
        const formData = new FormData()
        formData.append('file', file)
        formData.append('folder', 'diagnose-photos')
        const res = await fetch('/api/upload', { method: 'POST', body: formData })
        if (!res.ok) throw new Error('업로드 실패')
        return (await res.json()).url as string
      }))
      setPhotos(prev => [...prev, ...urls])
    } catch {
      alert('이미지 업로드에 실패했습니다.')
    } finally {
      setUploading(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  const handleSave = async () => {
    const validItems = diagItems.filter(d => d.name.trim())
    if (!validItems.length) { alert('최소 1개 이상의 진단 항목을 입력하세요'); return }
    setSaving(true)
    try {
      const res = await fetch(`/api/repair-jobs/${jobId}/diagnose`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          diagnosisItems: validItems,
          partsNeeded: parts.filter(p => p.part_name.trim()),
          laborCost,
          totalCost,
          mechanicNotes: mechanicNotes.trim() || undefined,
          photos,
        }),
      })
      if (res.ok) {
        alert('정밀진단 결과가 저장되고 소비자에게 알림이 전송되었습니다.')
        router.back()
      } else {
        const err = await res.json()
        alert(err.error ?? '저장 실패')
      }
    } finally {
      setSaving(false)
    }
  }

  const addDiagItem = () => setDiagItems(prev => [...prev, { code: '', name: '', description: '', severity: 'major' }])
  const removeDiagItem = (i: number) => setDiagItems(prev => prev.filter((_, idx) => idx !== i))
  const updateDiagItem = (i: number, field: keyof DiagItem, value: string) =>
    setDiagItems(prev => prev.map((item, idx) => idx === i ? { ...item, [field]: value } : item))

  const addPart = () => setParts(prev => [...prev, { part_name: '', part_code: '', unit_cost: 0, qty: 1 }])
  const removePart = (i: number) => setParts(prev => prev.filter((_, idx) => idx !== i))
  const updatePart = (i: number, field: keyof PartItem, value: string | number) =>
    setParts(prev => prev.map((p, idx) => idx === i ? { ...p, [field]: value } : p))

  if (loading) return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="w-8 h-8 border-2 border-primary-200 border-t-primary-600 rounded-full animate-spin" />
    </div>
  )

  const decisionLabel = existing?.consumer_decision === 'approved' ? '✅ 소비자가 수리를 승인했습니다'
    : existing?.consumer_decision === 'rejected' ? '❌ 소비자가 수리를 거절했습니다' : null

  return (
    <div className="flex flex-col min-h-screen bg-surface-50">
      <header className="bg-white px-4 pt-14 pb-4 flex items-center gap-3 border-b border-gray-100">
        <button onClick={() => router.back()} className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-500">←</button>
        <h1 className="text-lg font-black text-gray-900">정밀진단 결과 작성</h1>
      </header>

      <div className="px-4 py-4 space-y-4 pb-32">

        {/* 소비자 결정 상태 */}
        {decisionLabel && (
          <div className={`rounded-2xl p-4 border font-bold text-sm ${
            existing?.consumer_decision === 'approved' ? 'bg-green-50 border-green-200 text-green-700' : 'bg-gray-50 border-gray-200 text-gray-500'
          }`}>
            {decisionLabel}
          </div>
        )}

        {/* 진단 코드 / 진단명 */}
        <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-bold text-gray-900">🔍 진단 내역</h2>
            <button onClick={addDiagItem} className="text-xs text-primary-600 font-bold px-2 py-1 rounded-lg border border-primary-200 hover:bg-primary-50">
              + 항목 추가
            </button>
          </div>
          <div className="space-y-4">
            {diagItems.map((item, i) => (
              <div key={i} className="border border-gray-100 rounded-xl p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-gray-500">진단 항목 {i + 1}</span>
                  {diagItems.length > 1 && (
                    <button onClick={() => removeDiagItem(i)} className="text-xs text-red-400 hover:text-red-600">삭제</button>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-xs text-gray-500 mb-1 block">진단 코드</label>
                    <input
                      value={item.code}
                      onChange={e => updateDiagItem(i, 'code', e.target.value)}
                      placeholder="P0300"
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-primary-400 font-mono"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 mb-1 block">심각도</label>
                    <select
                      value={item.severity}
                      onChange={e => updateDiagItem(i, 'severity', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-primary-400 bg-white"
                    >
                      {SEVERITY_OPT.map(s => (
                        <option key={s.value} value={s.value}>{s.label}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">진단명 *</label>
                  <input
                    value={item.name}
                    onChange={e => updateDiagItem(i, 'name', e.target.value)}
                    placeholder="예: 점화플러그 마모, 흡기 매니폴드 개스킷 누유"
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-primary-400"
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">설명 (선택)</label>
                  <textarea
                    value={item.description}
                    onChange={e => updateDiagItem(i, 'description', e.target.value)}
                    placeholder="진단 내용, 증상 원인 등을 간략하게 설명해주세요"
                    rows={2}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-primary-400 resize-none"
                  />
                </div>
                {/* 심각도 뱃지 */}
                <span className={`inline-block text-xs font-bold px-2 py-0.5 rounded-full border ${SEVERITY_OPT.find(s => s.value === item.severity)?.color ?? ''}`}>
                  {SEVERITY_OPT.find(s => s.value === item.severity)?.label}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* 부품 내역 */}
        <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-bold text-gray-900">🔧 필요 부품</h2>
            <button onClick={addPart} className="text-xs text-primary-600 font-bold px-2 py-1 rounded-lg border border-primary-200 hover:bg-primary-50">
              + 부품 추가
            </button>
          </div>
          <div className="space-y-3">
            {parts.map((p, i) => (
              <div key={i} className="border border-gray-100 rounded-xl p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-gray-500">부품 {i + 1}</span>
                  {parts.length > 1 && (
                    <button onClick={() => removePart(i)} className="text-xs text-red-400 hover:text-red-600">삭제</button>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-xs text-gray-500 mb-1 block">부품명 *</label>
                    <input
                      value={p.part_name}
                      onChange={e => updatePart(i, 'part_name', e.target.value)}
                      placeholder="점화플러그"
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-primary-400"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 mb-1 block">부품 번호</label>
                    <input
                      value={p.part_code}
                      onChange={e => updatePart(i, 'part_code', e.target.value)}
                      placeholder="12290-R40-H01"
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-primary-400 font-mono text-xs"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-xs text-gray-500 mb-1 block">단가 (원)</label>
                    <input
                      type="number"
                      value={p.unit_cost || ''}
                      onChange={e => updatePart(i, 'unit_cost', parseInt(e.target.value) || 0)}
                      placeholder="15000"
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-primary-400"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 mb-1 block">수량</label>
                    <input
                      type="number"
                      min={1}
                      value={p.qty}
                      onChange={e => updatePart(i, 'qty', parseInt(e.target.value) || 1)}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-primary-400"
                    />
                  </div>
                </div>
                {p.unit_cost > 0 && (
                  <p className="text-xs text-right text-gray-500">소계: {formatKRW(p.unit_cost * p.qty)}</p>
                )}
              </div>
            ))}
            {partsTotal > 0 && (
              <div className="flex justify-between px-2 text-sm font-bold text-gray-700">
                <span>부품 합계</span><span>{formatKRW(partsTotal)}</span>
              </div>
            )}
          </div>
        </div>

        {/* 공임비 + 합계 */}
        <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm space-y-3">
          <h2 className="font-bold text-gray-900">💰 비용 산출</h2>
          <div>
            <label className="text-xs font-semibold text-gray-600 mb-1.5 block">공임비 (원)</label>
            <input
              type="number"
              value={laborCost || ''}
              onChange={e => setLaborCost(parseInt(e.target.value) || 0)}
              placeholder="50000"
              className="w-full px-3 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-primary-400"
            />
          </div>
          {totalCost > 0 && (
            <div className="bg-gray-50 rounded-xl p-3 space-y-1.5">
              <div className="flex justify-between text-sm"><span className="text-gray-500">부품비</span><span>{formatKRW(partsTotal)}</span></div>
              <div className="flex justify-between text-sm"><span className="text-gray-500">공임비</span><span>{formatKRW(laborCost)}</span></div>
              <div className="flex justify-between font-bold text-gray-900 border-t border-gray-200 pt-1.5">
                <span>합계</span><span className="text-primary-600 text-base">{formatKRW(totalCost)}</span>
              </div>
            </div>
          )}
        </div>

        {/* 정비사 메모 */}
        <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm">
          <label className="text-sm font-bold text-gray-900 mb-2 block">💬 정비사 메모 (소비자에게 표시)</label>
          <textarea
            value={mechanicNotes}
            onChange={e => setMechanicNotes(e.target.value)}
            placeholder="진단 결과 요약, 수리 방법 설명, 고객에게 전달할 추가 사항 등을 작성해주세요."
            rows={4}
            className="w-full px-3 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-primary-400 resize-none"
          />
        </div>

        {/* 진단 사진 첨부 */}
        <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-bold text-gray-900">📷 진단 사진 첨부 (선택)</span>
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
              className="text-xs text-primary-600 font-bold px-2 py-1 rounded-lg border border-primary-200 hover:bg-primary-50 disabled:opacity-50"
            >
              {uploading ? '업로드 중...' : '+ 사진 추가'}
            </button>
          </div>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={handlePhotoUpload}
          />
          {photos.length > 0 ? (
            <div className="flex gap-2 flex-wrap">
              {photos.map((url, i) => (
                <div key={i} className="relative">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={url} alt="" className="w-20 h-20 rounded-xl object-cover border border-gray-200" />
                  <button
                    onClick={() => setPhotos(prev => prev.filter((_, idx) => idx !== i))}
                    className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white rounded-full text-xs flex items-center justify-center"
                  >×</button>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-gray-400">진단 상태, 부품 상태 등의 사진을 첨부할 수 있습니다</p>
          )}
        </div>
      </div>

      {/* 하단 버튼 */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 px-4 py-4">
        <button
          onClick={handleSave}
          disabled={saving || uploading}
          className="w-full py-4 bg-primary-600 text-white font-bold rounded-2xl hover:bg-primary-700 disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {saving ? <><span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> 저장 중...</>
          : uploading ? <><span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> 사진 업로드 중...</>
          : '📋 진단 결과 저장 및 소비자에게 알림'}
        </button>
        <p className="text-center text-xs text-gray-400 mt-2">소비자에게 정밀진단 결과가 전송됩니다</p>
      </div>
    </div>
  )
}
