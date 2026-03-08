'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

interface AdminConfig {
  id: number
  diagnosis_mode: 'free' | 'paid' | 'ab_test'
  free_users_ratio: number
  guest_max_diagnosis: number
  user_daily_limit: number
  maintenance_banner: string | null
  updated_at: string
}

interface Stats {
  totalDiagnoses: number
  todayDiagnoses: number
  urgencyBreakdown: { HIGH: number; MID: number; LOW: number }
  categoryBreakdown: Record<string, number>
}

export default function AdminPage() {
  const router = useRouter()
  const supabase = createClient()
  const [config, setConfig] = useState<AdminConfig | null>(null)
  const [stats, setStats] = useState<Stats | null>(null)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [banner, setBanner] = useState('')

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.replace('/login'); return }

      const { data: profile } = await supabase.from('users').select('role').eq('id', user.id).single()
      if (profile?.role !== 'admin') { router.replace('/main'); return }

      const { data: cfg } = await supabase.from('admin_config').select('*').single()
      setConfig(cfg)
      setBanner(cfg?.maintenance_banner ?? '')

      // 통계
      const today = new Date(); today.setHours(0,0,0,0)
      const [{ count: total }, { count: todayCount }, { data: urgencies }] = await Promise.all([
        supabase.from('conversations').select('*', { count: 'exact', head: true }).not('final_result', 'is', null),
        supabase.from('conversations').select('*', { count: 'exact', head: true }).gte('created_at', today.toISOString()).not('final_result', 'is', null),
        supabase.from('conversations').select('urgency, category').not('final_result', 'is', null),
      ])

      const urgencyBreakdown = { HIGH: 0, MID: 0, LOW: 0 }
      const categoryBreakdown: Record<string, number> = {}
      for (const row of urgencies ?? []) {
        if (row.urgency && row.urgency in urgencyBreakdown) {
          urgencyBreakdown[row.urgency as keyof typeof urgencyBreakdown]++
        }
        if (row.category) categoryBreakdown[row.category] = (categoryBreakdown[row.category] ?? 0) + 1
      }

      setStats({ totalDiagnoses: total ?? 0, todayDiagnoses: todayCount ?? 0, urgencyBreakdown, categoryBreakdown })
    }
    load()
  }, [router])

  const save = async () => {
    if (!config) return
    setSaving(true)
    const { error } = await supabase
      .from('admin_config')
      .update({
        diagnosis_mode: config.diagnosis_mode,
        free_users_ratio: config.free_users_ratio,
        guest_max_diagnosis: config.guest_max_diagnosis,
        user_daily_limit: config.user_daily_limit,
        maintenance_banner: banner || null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', 1)
    setSaving(false)
    if (!error) { setSaved(true); setTimeout(() => setSaved(false), 2000) }
  }

  if (!config) return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="w-8 h-8 border-2 border-primary-200 border-t-primary-600 rounded-full animate-spin" />
    </div>
  )

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 px-4 py-4 flex items-center gap-3">
        <button onClick={() => router.push('/main')} className="text-gray-400 hover:text-gray-600">←</button>
        <h1 className="text-lg font-black text-gray-900">관리자 대시보드</h1>
      </header>

      <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">

        {/* 진단 통계 */}
        {stats && (
          <section className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
            <h2 className="font-bold text-gray-900 mb-4">📊 진단 통계</h2>
            <div className="grid grid-cols-2 gap-3 mb-4">
              <div className="bg-primary-50 rounded-xl p-3 text-center">
                <p className="text-2xl font-black text-primary-600">{stats.totalDiagnoses}</p>
                <p className="text-xs text-gray-500 mt-0.5">누적 진단 수</p>
              </div>
              <div className="bg-green-50 rounded-xl p-3 text-center">
                <p className="text-2xl font-black text-green-600">{stats.todayDiagnoses}</p>
                <p className="text-xs text-gray-500 mt-0.5">오늘 진단 수</p>
              </div>
            </div>
            <div className="space-y-1.5">
              {[
                { label: '즉시 점검 필요', value: stats.urgencyBreakdown.HIGH, color: 'bg-red-400', total: stats.totalDiagnoses },
                { label: '조기 점검 권장', value: stats.urgencyBreakdown.MID, color: 'bg-amber-400', total: stats.totalDiagnoses },
                { label: '여유 있게 점검', value: stats.urgencyBreakdown.LOW, color: 'bg-green-400', total: stats.totalDiagnoses },
              ].map(item => (
                <div key={item.label} className="flex items-center gap-2">
                  <span className="text-xs text-gray-500 w-24 flex-shrink-0">{item.label}</span>
                  <div className="flex-1 bg-gray-100 rounded-full h-2">
                    <div className={`${item.color} h-2 rounded-full`} style={{ width: `${item.total ? (item.value / item.total * 100) : 0}%` }} />
                  </div>
                  <span className="text-xs text-gray-600 font-semibold w-6 text-right">{item.value}</span>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* 과금 모드 제어 (A/B 테스트 핵심) */}
        <section className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
          <h2 className="font-bold text-gray-900 mb-1">⚙️ 진단 과금 모드</h2>
          <p className="text-xs text-gray-400 mb-4">변경 즉시 전체 사용자에게 적용됩니다</p>

          <div className="space-y-2 mb-4">
            {[
              { value: 'free', label: '무료', desc: '모든 사용자 무제한 무료 진단' },
              { value: 'paid', label: '유료', desc: '로그인 후 첫 1회 이후 유료 전환' },
              { value: 'ab_test', label: 'A/B 테스트', desc: '비율 설정으로 무료/유료 분리 실험' },
            ].map(opt => (
              <label key={opt.value} className={`flex items-center gap-3 p-3.5 rounded-xl border cursor-pointer transition-colors ${config.diagnosis_mode === opt.value ? 'bg-primary-50 border-primary-300' : 'bg-gray-50 border-gray-200 hover:border-gray-300'}`}>
                <input
                  type="radio"
                  name="diagMode"
                  value={opt.value}
                  checked={config.diagnosis_mode === opt.value}
                  onChange={() => setConfig(c => c ? { ...c, diagnosis_mode: opt.value as AdminConfig['diagnosis_mode'] } : c)}
                  className="accent-primary-600"
                />
                <div>
                  <p className={`text-sm font-bold ${config.diagnosis_mode === opt.value ? 'text-primary-700' : 'text-gray-700'}`}>{opt.label}</p>
                  <p className="text-xs text-gray-400">{opt.desc}</p>
                </div>
              </label>
            ))}
          </div>

          {/* A/B 비율 슬라이더 */}
          {config.diagnosis_mode === 'ab_test' && (
            <div className="bg-amber-50 rounded-xl p-4 border border-amber-200">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-bold text-amber-800">무료 사용자 비율</span>
                <span className="text-lg font-black text-amber-700">{config.free_users_ratio}%</span>
              </div>
              <input
                type="range"
                min="0" max="100" step="5"
                value={config.free_users_ratio}
                onChange={e => setConfig(c => c ? { ...c, free_users_ratio: Number(e.target.value) } : c)}
                className="w-full accent-amber-500"
              />
              <div className="flex justify-between text-xs text-amber-600 mt-1">
                <span>0% (전체 유료)</span>
                <span>100% (전체 무료)</span>
              </div>
            </div>
          )}
        </section>

        {/* 진단 횟수 제한 */}
        <section className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
          <h2 className="font-bold text-gray-900 mb-4">🔢 진단 횟수 제한</h2>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-semibold text-gray-700 mb-1.5 block">
                비로그인 사용자 최대 진단 횟수
              </label>
              <div className="flex items-center gap-3">
                <input
                  type="number"
                  min="0" max="10"
                  value={config.guest_max_diagnosis}
                  onChange={e => setConfig(c => c ? { ...c, guest_max_diagnosis: Number(e.target.value) } : c)}
                  className="w-20 px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-primary-400 text-center font-bold"
                />
                <span className="text-sm text-gray-500">회 (0 = 비로그인 차단)</span>
              </div>
            </div>
            <div>
              <label className="text-sm font-semibold text-gray-700 mb-1.5 block">
                로그인 사용자 일일 진단 한도
              </label>
              <div className="flex items-center gap-3">
                <input
                  type="number"
                  min="0" max="100"
                  value={config.user_daily_limit}
                  onChange={e => setConfig(c => c ? { ...c, user_daily_limit: Number(e.target.value) } : c)}
                  className="w-20 px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-primary-400 text-center font-bold"
                />
                <span className="text-sm text-gray-500">회 (0 = 무제한)</span>
              </div>
            </div>
          </div>
        </section>

        {/* 공지 배너 */}
        <section className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
          <h2 className="font-bold text-gray-900 mb-1">📢 홈 공지 배너</h2>
          <p className="text-xs text-gray-400 mb-3">비워두면 배너 미표시</p>
          <input
            type="text"
            value={banner}
            onChange={e => setBanner(e.target.value)}
            placeholder="예: 서비스 점검이 예정되어 있습니다..."
            className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-primary-400"
          />
        </section>

        {/* 저장 버튼 */}
        <button
          onClick={save}
          disabled={saving}
          className="w-full py-4 bg-primary-600 text-white font-bold rounded-2xl hover:bg-primary-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {saving ? <span className="animate-spin">⟳</span> : null}
          {saved ? '✓ 저장됨' : '설정 저장'}
        </button>
      </div>
    </div>
  )
}
