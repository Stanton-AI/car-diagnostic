'use client'
import { useState, useEffect, useRef } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { getMyShop } from '@/lib/marketplace'

interface RepairUpdate {
  id: string
  content: string
  photos: string[]
  estimated_completion_at: string | null
  created_at: string
}

function fmtDT(iso: string) {
  return new Date(iso).toLocaleString('ko-KR', {
    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
  })
}

export default function RepairUpdatesPage() {
  const router = useRouter()
  const { id: jobId } = useParams<{ id: string }>()
  const supabase = createClient()
  const fileRef = useRef<HTMLInputElement>(null)

  const [updates, setUpdates] = useState<RepairUpdate[]>([])
  const [loading, setLoading] = useState(true)
  const [posting, setPosting] = useState(false)
  const [changeCount, setChangeCount] = useState(0)

  // 새 업데이트 폼
  const [content, setContent] = useState('')
  const [etaDate, setEtaDate] = useState('')
  const [etaTime, setEtaTime] = useState('')
  const [photos, setPhotos] = useState<string[]>([])
  const [uploading, setUploading] = useState(false)

  useEffect(() => {
    const load = async () => {
      const shop = await getMyShop(supabase)
      if (!shop || shop.status !== 'active') { router.replace('/partner'); return }

      const [jobRes, updatesRes] = await Promise.all([
        supabase
          .from('repair_jobs')
          .select('completion_change_count')
          .eq('id', jobId)
          .single(),
        fetch(`/api/repair-jobs/${jobId}/updates`),
      ])

      if (jobRes.data) setChangeCount(jobRes.data.completion_change_count ?? 0)
      if (updatesRes.ok) {
        const data = await updatesRes.json()
        setUpdates(data)
      }
      setLoading(false)
    }
    load()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jobId])

  const uploadPhoto = async (file: File) => {
    const formData = new FormData()
    formData.append('file', file)
    formData.append('folder', 'repair-updates')
    const res = await fetch('/api/upload', { method: 'POST', body: formData })
    if (!res.ok) throw new Error('업로드 실패')
    const data = await res.json()
    return data.url as string
  }

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? [])
    if (!files.length) return
    setUploading(true)
    try {
      const urls = await Promise.all(files.map(uploadPhoto))
      setPhotos(prev => [...prev, ...urls])
    } catch {
      alert('이미지 업로드에 실패했습니다.')
    } finally {
      setUploading(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  const handlePost = async () => {
    if (!content.trim()) { alert('내용을 입력해주세요'); return }
    setPosting(true)
    try {
      let estimatedCompletionAt: string | undefined
      if (etaDate) {
        estimatedCompletionAt = etaTime
          ? `${etaDate}T${etaTime}:00`
          : `${etaDate}T17:00:00`
      }
      const res = await fetch(`/api/repair-jobs/${jobId}/updates`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content, photos, estimatedCompletionAt }),
      })
      if (res.ok) {
        const newUpdate = await res.json()
        setUpdates(prev => [...prev, newUpdate])
        setContent('')
        setEtaDate('')
        setEtaTime('')
        setPhotos([])
        if (estimatedCompletionAt) setChangeCount(prev => prev + 1)
      } else {
        const err = await res.json()
        alert(err.error ?? '업데이트 실패')
      }
    } finally {
      setPosting(false)
    }
  }

  if (loading) return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="w-8 h-8 border-2 border-primary-200 border-t-primary-600 rounded-full animate-spin" />
    </div>
  )

  return (
    <div className="flex flex-col min-h-screen bg-surface-50">
      <header className="bg-white px-4 pt-14 pb-4 flex items-center gap-3 border-b border-gray-100">
        <button onClick={() => router.back()} className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-500">←</button>
        <h1 className="text-lg font-black text-gray-900">수리 현황 업데이트</h1>
      </header>

      <div className="px-4 py-4 space-y-4 pb-8">

        {/* 업데이트 추가 폼 */}
        <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm space-y-3">
          <h2 className="font-bold text-gray-900">📝 새 업데이트 작성</h2>
          <p className="text-xs text-gray-400">소비자에게 실시간으로 알림이 전송됩니다</p>

          <textarea
            value={content}
            onChange={e => setContent(e.target.value)}
            placeholder="수리 진행 상황, 발견된 추가 사항, 부품 교체 내용 등을 작성해주세요..."
            rows={4}
            className="w-full px-3 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-primary-400 resize-none"
          />

          {/* 사진 업로드 */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-gray-600">📷 사진 첨부 (선택)</span>
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
              onChange={handleFileChange}
            />
            {photos.length > 0 && (
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
            )}
          </div>

          {/* 예상 완료시간 */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-semibold text-gray-600">🕐 예상 완료시간 변경 (선택)</label>
              <span className={`text-xs px-2 py-0.5 rounded-full font-bold border ${
                changeCount >= 3
                  ? 'bg-red-50 text-red-500 border-red-200'
                  : 'bg-gray-50 text-gray-500 border-gray-200'
              }`}>
                {changeCount}/3회 사용
              </span>
            </div>
            {changeCount < 3 ? (
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs text-gray-400 mb-1 block">날짜</label>
                  <input
                    type="date"
                    value={etaDate}
                    onChange={e => setEtaDate(e.target.value)}
                    min={new Date().toISOString().split('T')[0]}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-primary-400"
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-400 mb-1 block">시간 (선택)</label>
                  <input
                    type="time"
                    value={etaTime}
                    onChange={e => setEtaTime(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-primary-400"
                  />
                </div>
              </div>
            ) : (
              <p className="text-xs text-red-500 bg-red-50 rounded-lg p-2 border border-red-100">
                예상 완료시간은 최대 3회까지만 변경할 수 있습니다.
              </p>
            )}
          </div>

          <button
            onClick={handlePost}
            disabled={posting || !content.trim()}
            className="w-full py-3 bg-purple-600 text-white font-bold rounded-xl hover:bg-purple-700 disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {posting
              ? <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> 전송 중...</>
              : '📤 업데이트 전송 (소비자 알림)'}
          </button>
        </div>

        {/* 업데이트 타임라인 */}
        <div>
          <h2 className="text-sm font-bold text-gray-500 mb-3">업데이트 기록 ({updates.length}건)</h2>
          {updates.length === 0 ? (
            <div className="bg-white rounded-2xl p-6 text-center border border-gray-100 text-gray-400 text-sm">
              아직 업데이트가 없습니다
            </div>
          ) : (
            <div className="space-y-3">
              {[...updates].reverse().map(u => (
                <div key={u.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <p className="text-xs text-gray-400">{fmtDT(u.created_at)}</p>
                    {u.estimated_completion_at && (
                      <span className="text-xs bg-blue-50 text-blue-600 border border-blue-200 px-2 py-0.5 rounded-full font-bold flex-shrink-0">
                        🕐 완료 예정: {fmtDT(u.estimated_completion_at)}
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-gray-700 leading-relaxed">{u.content}</p>
                  {u.photos?.length > 0 && (
                    <div className="flex gap-2 mt-2 flex-wrap">
                      {u.photos.map((url, pi) => (
                        <a key={pi} href={url} target="_blank" rel="noopener noreferrer">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={url} alt="" className="w-20 h-20 rounded-xl object-cover border border-gray-200" />
                        </a>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
