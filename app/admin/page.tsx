'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { formatKRW } from '@/lib/utils'

type Tab = 'overview' | 'marketplace' | 'settings'

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

interface MarketStats {
  totalRequests: number
  openRequests: number
  totalBids: number
  totalJobs: number
  pendingShops: number
  activeShops: number
  totalRevenue: number
  commissionRevenue: number
}

interface PendingShop {
  id: string
  name: string
  owner_name: string
  phone: string
  address: string
  business_number: string | null
  created_at: string
}

export default function AdminPage() {
  const router = useRouter()
  const supabase = createClient()
  const [tab, setTab] = useState<Tab>('overview')
  const [config, setConfig] = useState<AdminConfig | null>(null)
  const [stats, setStats] = useState<Stats | null>(null)
  const [marketStats, setMarketStats] = useState<MarketStats | null>(null)
  const [pendingShops, setPendingShops] = useState<PendingShop[]>([])
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [banner, setBanner] = useState('')
  const [approvingShop, setApprovingShop] = useState<string | null>(null)

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.replace('/login'); return }

      const { data: profile } = await supabase.from('users').select('role').eq('id', user.id).single()
      if (profile?.role !== 'admin') { router.replace('/main'); return }

      const { data: cfg } = await supabase.from('admin_config').select('*').single()
      setConfig(cfg)
      setBanner(cfg?.maintenance_banner ?? '')

      // 진단 통계
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

      // 마켓플레이스 통계
      try {
        const [
          { count: totalReq }, { count: openReq }, { count: totalBids },
          { count: totalJobsCnt }, { count: pendingShopsCnt }, { count: activeShopsCnt },
          { data: jobs }, { data: pending },
        ] = await Promise.all([
          supabase.from('repair_requests').select('*', { count: 'exact', head: true }),
          supabase.from('repair_requests').select('*', { count: 'exact', head: true }).in('status', ['open','bidding']),
          supabase.from('shop_bids').select('*', { count: 'exact', head: true }),
          supabase.from('repair_jobs').select('*', { count: 'exact', head: true }),
          supabase.from('partner_shops').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
          supabase.from('partner_shops').select('*', { count: 'exact', head: true }).eq('status', 'active'),
          supabase.from('repair_jobs').select('actual_total_cost').eq('status', 'completed').eq('payment_status', 'paid'),
          supabase.from('partner_shops').select('id, name, owner_name, phone, address, business_number, created_at').eq('status', 'pending').order('created_at', { ascending: true }),
        ])
        const totalRev = (jobs ?? []).reduce((s, j) => s + (j.actual_total_cost ?? 0), 0)
        setMarketStats({
          totalRequests: totalReq ?? 0, openRequests: openReq ?? 0,
          totalBids: totalBids ?? 0, totalJobs: totalJobsCnt ?? 0,
          pendingShops: pendingShopsCnt ?? 0, activeShops: activeShopsCnt ?? 0,
          totalRevenue: totalRev, commissionRevenue: Math.round(totalRev * 0.10),
        })
        setPendingShops(pending ?? [])
      } catch { /* 마켓 테이블 없으면 skip */ }
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

  const approveShop = async (shopId: string, approve: boolean) => {
    setApprovingShop(shopId)
    await supabase.from('partner_shops').update({
      status: approve ? 'active' : 'suspended',
      updated_at: new Date().toISOString(),
    }).eq('id', shopId)
    setPendingShops(prev => prev.filter(s => s.id !== shopId))
    setApprovingShop(null)
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

      {/* 탭 */}
      <div className="bg-white border-b border-gray-200 flex">
        {([
          { key: 'overview' as Tab,    label: '📊 진단 통계',    badge: 0 },
          { key: 'marketplace' as Tab, label: '🏪 마켓플레이스', badge: marketStats?.pendingShops ?? 0 },
          { key: 'settings' as Tab,    label: '⚙️ 설정',         badge: 0 },
        ]).map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex-1 py-3 text-sm font-semibold relative transition-colors ${
              tab === t.key ? 'text-primary-600 border-b-2 border-primary-600' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {t.label}
            {t.badge > 0 ? (
              <span className="absolute -top-1 right-1/4 w-4 h-4 bg-red-500 rounded-full text-[10px] text-white flex items-center justify-center font-bold">
                {t.badge}
              </span>
            ) : null}
          </button>
        ))}
      </div>

      <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">

      {/* ─── 탭: 진단 통계 ─── */}
      {tab === 'overview' && stats && (
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

      {/* ─── 탭: 마켓플레이스 ─── */}
      {tab === 'marketplace' && (
        <>
          {/* 마켓플레이스 통계 */}
          {marketStats && (
            <section className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
              <h2 className="font-bold text-gray-900 mb-4">🏪 마켓플레이스 현황</h2>
              <div className="grid grid-cols-2 gap-3 mb-4">
                {[
                  { label: '총 견적 요청', value: marketStats.totalRequests, sub: `진행중 ${marketStats.openRequests}건` },
                  { label: '총 입찰 수',   value: marketStats.totalBids,     sub: '' },
                  { label: '완료 작업',    value: marketStats.totalJobs,     sub: '' },
                  { label: '활성 파트너',  value: marketStats.activeShops,   sub: `승인대기 ${marketStats.pendingShops}` },
                ].map(item => (
                  <div key={item.label} className="bg-gray-50 rounded-xl p-3 text-center">
                    <p className="text-2xl font-black text-gray-800">{item.value}</p>
                    <p className="text-xs text-gray-500 mt-0.5">{item.label}</p>
                    {item.sub && <p className="text-[10px] text-gray-400">{item.sub}</p>}
                  </div>
                ))}
              </div>
              <div className="bg-green-50 rounded-xl p-3 border border-green-100">
                <p className="text-xs text-green-600 mb-1">💰 결제 수익 (플랫폼 수수료 10%)</p>
                <p className="text-2xl font-black text-green-700">{formatKRW(marketStats.commissionRevenue)}</p>
                <p className="text-xs text-green-500">총 거래액 {formatKRW(marketStats.totalRevenue)}</p>
              </div>
            </section>
          )}

          {/* 파트너 승인 대기 */}
          <section className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
            <h2 className="font-bold text-gray-900 mb-4">
              🔔 파트너 승인 대기
              {pendingShops.length > 0 && (
                <span className="ml-2 bg-red-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">{pendingShops.length}</span>
              )}
            </h2>
            {pendingShops.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-4">대기 중인 신청이 없습니다</p>
            ) : pendingShops.map(shop => (
              <div key={shop.id} className="border border-gray-100 rounded-xl p-4 mb-3 last:mb-0">
                <div className="mb-2">
                  <p className="font-bold text-gray-900">{shop.name}</p>
                  <p className="text-sm text-gray-600">{shop.owner_name} · {shop.phone}</p>
                  <p className="text-xs text-gray-400">{shop.address}</p>
                  {shop.business_number && <p className="text-xs text-gray-400">사업자: {shop.business_number}</p>}
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => approveShop(shop.id, true)}
                    disabled={approvingShop === shop.id}
                    className="flex-1 py-2.5 bg-green-600 text-white rounded-xl text-sm font-bold hover:bg-green-700 disabled:opacity-50"
                  >
                    ✅ 승인
                  </button>
                  <button
                    onClick={() => approveShop(shop.id, false)}
                    disabled={approvingShop === shop.id}
                    className="flex-1 py-2.5 bg-gray-200 text-gray-600 rounded-xl text-sm font-bold hover:bg-gray-300 disabled:opacity-50"
                  >
                    ❌ 거절
                  </button>
                </div>
              </div>
            ))}
          </section>
        </>
      )}

      {/* ─── 탭: 설정 ─── */}
      {tab === 'settings' && (
        <>
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
        </>
      )}

      </div>
    </div>
  )
}
