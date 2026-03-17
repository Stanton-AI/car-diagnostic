'use client'
import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { formatKRW } from '@/lib/utils'
import { CATEGORY_TAXONOMY, MAJOR_CATEGORIES, type MajorCategory } from '@/lib/categoryTaxonomy'

type Tab = 'overview' | 'marketplace' | 'feedback' | 'board' | 'settings'

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
  majorBreakdown: Record<MajorCategory, number>
  subBreakdown: Record<string, number>
  users: {
    total: number
    today: number
    week: number
    daily: Record<string, number>
  }
  vehicles: {
    total: number
    yearBands: Record<string, number>
    mileageBands: Record<string, number>
    fuelBreakdown: Record<string, number>
  }
}

interface MarketStats {
  totalRequests: number; openRequests: number; totalBids: number; totalJobs: number
  pendingShops: number; activeShops: number; totalRevenue: number; commissionRevenue: number
}

interface PendingShop {
  id: string; name: string; owner_name: string; phone: string
  address: string; business_number: string | null; created_at: string
}

interface FeedbackItem {
  id: string
  content: string
  page: string | null
  phone: string | null
  created_at: string
  user_id: string | null
  users: { display_name: string | null; email: string | null } | null
}

interface BoardPost {
  id: string; category: string; title: string; content: string
  like_count: number; view_count: number; created_at: string; user_id: string
}

export default function AdminPage() {
  const router = useRouter()
  const supabase = createClient()
  const [tab, setTab] = useState<Tab>('overview')
  const [config, setConfig] = useState<AdminConfig | null>(null)
  const [stats, setStats] = useState<Stats | null>(null)
  const [marketStats, setMarketStats] = useState<MarketStats | null>(null)
  const [pendingShops, setPendingShops] = useState<PendingShop[]>([])
  const [feedbackList, setFeedbackList] = useState<FeedbackItem[]>([])
  const [boardPosts, setBoardPosts] = useState<BoardPost[]>([])
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [banner, setBanner] = useState('')
  const [approvingShop, setApprovingShop] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.replace('/login'); return }
      const { data: profile } = await supabase.from('users').select('role').eq('id', user.id).single()
      if (profile?.role !== 'admin') { router.replace('/main'); return }

      // config (anon key OK — SELECT is public)
      const { data: cfg } = await supabase.from('admin_config').select('*').single()
      setConfig(cfg)
      setBanner(cfg?.maintenance_banner ?? '')

      // stats via API (service role)
      const [statsRes, mktRes] = await Promise.all([
        fetch('/api/admin/stats'),
        fetch('/api/admin/marketplace'),
      ])
      if (statsRes.ok) setStats(await statsRes.json())
      if (mktRes.ok) {
        const mkt = await mktRes.json()
        setMarketStats(mkt.stats)
        setPendingShops(mkt.pendingShops ?? [])
      }
    }
    init()
  }, [router])

  const loadFeedback = useCallback(async () => {
    const res = await fetch('/api/admin/feedback')
    if (res.ok) setFeedbackList(await res.json())
  }, [])

  const loadBoard = useCallback(async () => {
    const res = await fetch('/api/admin/board')
    if (res.ok) setBoardPosts(await res.json())
  }, [])

  useEffect(() => {
    if (tab === 'feedback' && feedbackList.length === 0) loadFeedback()
    if (tab === 'board' && boardPosts.length === 0) loadBoard()
  }, [tab, feedbackList.length, boardPosts.length, loadFeedback, loadBoard])

  const save = async () => {
    if (!config) return
    setSaving(true)
    const res = await fetch('/api/admin/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...config, maintenance_banner: banner }),
    })
    setSaving(false)
    if (res.ok) { setSaved(true); setTimeout(() => setSaved(false), 2000) }
  }

  const approveShop = async (shopId: string, approve: boolean) => {
    setApprovingShop(shopId)
    const res = await fetch(`/api/admin/shops/${shopId}/approve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ approve }),
    })
    if (res.ok) setPendingShops(prev => prev.filter(s => s.id !== shopId))
    setApprovingShop(null)
  }

  const deleteFeedback = async (id: string) => {
    setDeletingId(id)
    await fetch('/api/admin/feedback', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    })
    setFeedbackList(prev => prev.filter(f => f.id !== id))
    setDeletingId(null)
  }

  const deletePost = async (id: string) => {
    if (!confirm('이 게시물을 삭제하시겠습니까?')) return
    setDeletingId(id)
    await fetch('/api/admin/board', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    })
    setBoardPosts(prev => prev.filter(p => p.id !== id))
    setDeletingId(null)
  }

  if (!config) return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="w-8 h-8 border-2 border-primary-200 border-t-primary-600 rounded-full animate-spin" />
    </div>
  )

  const tabs: { key: Tab; label: string; badge?: number }[] = [
    { key: 'overview',     label: '📊 통계' },
    { key: 'marketplace',  label: '🏪 마켓', badge: pendingShops.length || undefined },
    { key: 'feedback',     label: '💬 피드백', badge: feedbackList.length || undefined },
    { key: 'board',        label: '📝 게시판' },
    { key: 'settings',     label: '⚙️ 설정' },
  ]

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 px-4 py-4 flex items-center gap-3">
        <button onClick={() => router.push('/main')} className="text-gray-400 hover:text-gray-600">←</button>
        <h1 className="text-lg font-black text-gray-900">관리자 대시보드</h1>
      </header>

      {/* 탭 */}
      <div className="bg-white border-b border-gray-200 flex overflow-x-auto">
        {tabs.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex-shrink-0 px-3 py-3 text-xs font-semibold relative transition-colors ${
              tab === t.key ? 'text-primary-600 border-b-2 border-primary-600' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {t.label}
            {t.badge ? (
              <span className="absolute -top-1 right-0 w-4 h-4 bg-red-500 rounded-full text-[9px] text-white flex items-center justify-center font-bold">
                {t.badge > 9 ? '9+' : t.badge}
              </span>
            ) : null}
          </button>
        ))}
      </div>

      <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">

        {/* ─── 탭: 진단 통계 ─── */}
        {tab === 'overview' && (
          stats ? (
            <div className="space-y-4">

              {/* KPI 카드 */}
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm text-center">
                  <p className="text-3xl font-black text-primary-600">{stats.totalDiagnoses}</p>
                  <p className="text-xs text-gray-500 mt-1">누적 진단 수</p>
                </div>
                <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm text-center">
                  <p className="text-3xl font-black text-green-600">{stats.todayDiagnoses}</p>
                  <p className="text-xs text-gray-500 mt-1">오늘 진단 수</p>
                </div>
              </div>

              {/* 긴급도 분포 */}
              <section className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
                <h2 className="font-bold text-gray-900 mb-4 text-sm">🚨 긴급도 분포</h2>
                <div className="space-y-3">
                  {[
                    { label: '즉시 점검 필요', value: stats.urgencyBreakdown.HIGH, color: 'bg-red-400', badge: 'HIGH' },
                    { label: '조기 점검 권장', value: stats.urgencyBreakdown.MID,  color: 'bg-amber-400', badge: 'MID' },
                    { label: '여유 있게 점검', value: stats.urgencyBreakdown.LOW,  color: 'bg-green-400', badge: 'LOW' },
                  ].map(item => {
                    const pct = stats.totalDiagnoses ? Math.round(item.value / stats.totalDiagnoses * 100) : 0
                    return (
                      <div key={item.badge}>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs text-gray-600">{item.label}</span>
                          <span className="text-xs font-bold text-gray-700">{item.value}건 <span className="text-gray-400 font-normal">({pct}%)</span></span>
                        </div>
                        <div className="w-full bg-gray-100 rounded-full h-2.5">
                          <div className={`${item.color} h-2.5 rounded-full transition-all`} style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    )
                  })}
                </div>
              </section>

              {/* 대분류 카테고리 차트 */}
              <section className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
                <h2 className="font-bold text-gray-900 mb-4 text-sm">📂 대분류 카테고리 통계</h2>
                {(() => {
                  const sorted = MAJOR_CATEGORIES
                    .map(m => ({ major: m, count: stats.majorBreakdown?.[m] ?? 0, ...CATEGORY_TAXONOMY[m] }))
                    .filter(d => d.count > 0)
                    .sort((a, b) => b.count - a.count)
                  const maxVal = sorted[0]?.count ?? 1
                  if (sorted.length === 0) return <p className="text-xs text-gray-400 text-center py-4">데이터 없음</p>
                  return (
                    <div className="space-y-3">
                      {sorted.map(({ major, count, icon, color, textColor }) => {
                        const pct = Math.round(count / stats.totalDiagnoses * 100)
                        const barPct = Math.round(count / maxVal * 100)
                        return (
                          <div key={major}>
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-xs text-gray-700 font-medium">{icon} {major}</span>
                              <span className={`text-xs font-bold ${textColor}`}>{count}건 <span className="text-gray-400 font-normal">({pct}%)</span></span>
                            </div>
                            <div className="w-full bg-gray-100 rounded-full h-2.5">
                              <div className={`${color} h-2.5 rounded-full transition-all`} style={{ width: `${barPct}%` }} />
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )
                })()}
              </section>

              {/* 중분류 상세 (접히는 방식으로 대분류별) */}
              <section className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
                <h2 className="font-bold text-gray-900 mb-4 text-sm">🔍 중분류 상세 통계</h2>
                {(() => {
                  const subEntries = Object.entries(stats.subBreakdown ?? {})
                    .sort((a, b) => b[1] - a[1])
                  if (subEntries.length === 0) return <p className="text-xs text-gray-400 text-center py-4">데이터 없음</p>
                  const maxSub = subEntries[0]?.[1] ?? 1

                  // 대분류별로 그룹핑
                  const groups: Record<string, Array<[string, number]>> = {}
                  for (const [key, cnt] of subEntries) {
                    const [major] = key.split(' > ', 1)
                    if (!groups[major]) groups[major] = []
                    groups[major].push([key, cnt])
                  }

                  return (
                    <div className="space-y-4">
                      {Object.entries(groups).map(([major, subs]) => {
                        const info = CATEGORY_TAXONOMY[major as MajorCategory]
                        if (!info) return null
                        return (
                          <div key={major}>
                            <p className="text-xs font-bold text-gray-500 mb-2">{info.icon} {major}</p>
                            <div className="space-y-2 pl-2">
                              {subs.map(([key, cnt]) => {
                                const subLabel = key.split(' > ')[1] ?? key
                                const barPct = Math.round(cnt / maxSub * 100)
                                return (
                                  <div key={key}>
                                    <div className="flex items-center justify-between mb-0.5">
                                      <span className="text-xs text-gray-600">{subLabel}</span>
                                      <span className={`text-xs font-semibold ${info.textColor}`}>{cnt}건</span>
                                    </div>
                                    <div className="w-full bg-gray-100 rounded-full h-1.5">
                                      <div className={`${info.color} h-1.5 rounded-full`} style={{ width: `${barPct}%` }} />
                                    </div>
                                  </div>
                                )
                              })}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )
                })()}
              </section>

              {/* ── 가입자 통계 ── */}
              {stats.users && (
                <section className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
                  <h2 className="font-bold text-gray-900 mb-4 text-sm">👥 가입자 현황</h2>
                  <div className="grid grid-cols-3 gap-3 mb-4">
                    {[
                      { label: '총 가입자', value: stats.users.total, color: 'text-primary-600' },
                      { label: '오늘 신규',  value: stats.users.today, color: 'text-green-600' },
                      { label: '7일 신규',   value: stats.users.week,  color: 'text-amber-600' },
                    ].map(item => (
                      <div key={item.label} className="bg-gray-50 rounded-xl p-3 text-center">
                        <p className={`text-2xl font-black ${item.color}`}>{item.value}</p>
                        <p className="text-[11px] text-gray-500 mt-0.5">{item.label}</p>
                      </div>
                    ))}
                  </div>
                  {/* 최근 7일 일별 가입자 바차트 */}
                  <p className="text-[11px] text-gray-400 mb-2">최근 7일 일별 신규 가입</p>
                  <div className="flex items-end gap-1.5 h-16">
                    {Object.entries(stats.users.daily).map(([date, cnt]) => {
                      const maxD = Math.max(...Object.values(stats.users.daily), 1)
                      const h = Math.round((cnt / maxD) * 100)
                      const label = new Date(date).toLocaleDateString('ko-KR', { month: 'numeric', day: 'numeric' })
                      return (
                        <div key={date} className="flex-1 flex flex-col items-center gap-0.5">
                          <span className="text-[9px] text-gray-500">{cnt > 0 ? cnt : ''}</span>
                          <div className="w-full rounded-t-sm bg-primary-200 relative" style={{ height: `${Math.max(h, cnt > 0 ? 8 : 2)}%` }}>
                            {cnt > 0 && <div className="absolute inset-0 bg-primary-400 rounded-t-sm" />}
                          </div>
                          <span className="text-[9px] text-gray-400">{label}</span>
                        </div>
                      )
                    })}
                  </div>
                </section>
              )}

              {/* ── 차량 통계 ── */}
              {stats.vehicles && (
                <section className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
                  <h2 className="font-bold text-gray-900 mb-1 text-sm">🚗 등록 차량 통계</h2>
                  <p className="text-xs text-gray-400 mb-4">총 {stats.vehicles.total}대 등록</p>

                  {/* 차령 분포 */}
                  <p className="text-xs font-semibold text-gray-600 mb-2">📅 차령 (2026년 기준)</p>
                  <div className="space-y-2 mb-4">
                    {Object.entries(stats.vehicles.yearBands).filter(([, v]) => v > 0).map(([band, cnt]) => {
                      const max = Math.max(...Object.values(stats.vehicles.yearBands), 1)
                      const pct = Math.round(cnt / max * 100)
                      return (
                        <div key={band}>
                          <div className="flex items-center justify-between mb-0.5">
                            <span className="text-xs text-gray-600">{band}</span>
                            <span className="text-xs font-bold text-blue-600">{cnt}대</span>
                          </div>
                          <div className="w-full bg-gray-100 rounded-full h-2">
                            <div className="bg-blue-400 h-2 rounded-full transition-all" style={{ width: `${pct}%` }} />
                          </div>
                        </div>
                      )
                    })}
                  </div>

                  {/* 주행거리 분포 */}
                  <p className="text-xs font-semibold text-gray-600 mb-2">📏 주행거리 구간</p>
                  <div className="space-y-2 mb-4">
                    {Object.entries(stats.vehicles.mileageBands).filter(([, v]) => v > 0).map(([band, cnt]) => {
                      const max = Math.max(...Object.values(stats.vehicles.mileageBands), 1)
                      const pct = Math.round(cnt / max * 100)
                      return (
                        <div key={band}>
                          <div className="flex items-center justify-between mb-0.5">
                            <span className="text-xs text-gray-600">{band}</span>
                            <span className="text-xs font-bold text-orange-500">{cnt}대</span>
                          </div>
                          <div className="w-full bg-gray-100 rounded-full h-2">
                            <div className="bg-orange-400 h-2 rounded-full transition-all" style={{ width: `${pct}%` }} />
                          </div>
                        </div>
                      )
                    })}
                  </div>

                  {/* 연료 타입 */}
                  <p className="text-xs font-semibold text-gray-600 mb-2">⛽ 연료 타입</p>
                  <div className="flex flex-wrap gap-2">
                    {Object.entries(stats.vehicles.fuelBreakdown).map(([fuel, cnt]) => (
                      <div key={fuel} className="bg-gray-50 border border-gray-100 rounded-xl px-3 py-2 text-center min-w-[60px]">
                        <p className="text-base font-black text-gray-700">{cnt}</p>
                        <p className="text-[10px] text-gray-400">{fuel}</p>
                      </div>
                    ))}
                  </div>
                </section>
              )}

            </div>
          ) : (
            <div className="text-center py-12 text-gray-400 text-sm">통계 로딩 중...</div>
          )
        )}

        {/* ─── 탭: 마켓플레이스 ─── */}
        {tab === 'marketplace' && (
          <>
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
                    <p className="text-xs text-gray-300 mt-1">{new Date(shop.created_at).toLocaleDateString('ko-KR')} 신청</p>
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

        {/* ─── 탭: 피드백 ─── */}
        {tab === 'feedback' && (
          <FeedbackTab
            feedbackList={feedbackList}
            deletingId={deletingId}
            onDelete={deleteFeedback}
            onRefresh={loadFeedback}
          />
        )}

        {/* ─── 탭: 게시판 ─── */}
        {tab === 'board' && (
          <section className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-bold text-gray-900">📝 게시판 관리</h2>
              <button onClick={loadBoard} className="text-xs text-primary-600 font-semibold hover:underline">새로고침</button>
            </div>
            {boardPosts.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-8">게시물이 없습니다</p>
            ) : boardPosts.map(post => (
              <div key={post.id} className="border-b border-gray-50 last:border-0 py-3 flex items-start gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-[10px] font-semibold text-primary-600 bg-primary-50 px-1.5 py-0.5 rounded">{post.category}</span>
                    <span className="text-sm font-semibold text-gray-800 truncate">{post.title}</span>
                  </div>
                  <p className="text-xs text-gray-400 truncate">{post.content.slice(0, 60)}{post.content.length > 60 ? '...' : ''}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-[10px] text-gray-300">👍 {post.like_count} · 조회 {post.view_count}</span>
                    <span className="text-[10px] text-gray-300">{new Date(post.created_at).toLocaleDateString('ko-KR')}</span>
                  </div>
                </div>
                <button
                  onClick={() => deletePost(post.id)}
                  disabled={deletingId === post.id}
                  className="flex-shrink-0 text-xs text-red-400 font-semibold hover:text-red-600 border border-red-100 px-2 py-1 rounded-lg disabled:opacity-30"
                >
                  삭제
                </button>
              </div>
            ))}
          </section>
        )}

        {/* ─── 탭: 설정 ─── */}
        {tab === 'settings' && (
          <>
            <section className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
              <h2 className="font-bold text-gray-900 mb-1">⚙️ 진단 과금 모드</h2>
              <p className="text-xs text-gray-400 mb-4">변경 즉시 전체 사용자에게 적용됩니다</p>
              <div className="space-y-2 mb-4">
                {[
                  { value: 'free',    label: '무료',      desc: '모든 사용자 무제한 무료 진단' },
                  { value: 'paid',    label: '유료',      desc: '로그인 필수 + 일일 한도 적용' },
                  { value: 'ab_test', label: 'A/B 테스트', desc: '비율 설정으로 무료/유료 분리 실험' },
                ].map(opt => (
                  <label key={opt.value} className={`flex items-center gap-3 p-3.5 rounded-xl border cursor-pointer transition-colors ${config.diagnosis_mode === opt.value ? 'bg-primary-50 border-primary-300' : 'bg-gray-50 border-gray-200 hover:border-gray-300'}`}>
                    <input
                      type="radio" name="diagMode" value={opt.value}
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
              {config.diagnosis_mode === 'ab_test' && (
                <div className="bg-amber-50 rounded-xl p-4 border border-amber-200">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-bold text-amber-800">무료 사용자 비율</span>
                    <span className="text-lg font-black text-amber-700">{config.free_users_ratio}%</span>
                  </div>
                  <input type="range" min="0" max="100" step="5"
                    value={config.free_users_ratio}
                    onChange={e => setConfig(c => c ? { ...c, free_users_ratio: Number(e.target.value) } : c)}
                    className="w-full accent-amber-500"
                  />
                  <div className="flex justify-between text-xs text-amber-600 mt-1">
                    <span>0% (전체 유료)</span><span>100% (전체 무료)</span>
                  </div>
                </div>
              )}
            </section>

            <section className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
              <h2 className="font-bold text-gray-900 mb-4">🔢 진단 횟수 제한</h2>
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-semibold text-gray-700 mb-1.5 block">비로그인 사용자 최대 진단 횟수</label>
                  <div className="flex items-center gap-3">
                    <input type="number" min="0" max="10"
                      value={config.guest_max_diagnosis}
                      onChange={e => setConfig(c => c ? { ...c, guest_max_diagnosis: Number(e.target.value) } : c)}
                      className="w-20 px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-primary-400 text-center font-bold"
                    />
                    <span className="text-sm text-gray-500">회 (0 = 비로그인 차단)</span>
                  </div>
                </div>
                <div>
                  <label className="text-sm font-semibold text-gray-700 mb-1.5 block">로그인 사용자 일일 진단 한도</label>
                  <div className="flex items-center gap-3">
                    <input type="number" min="0" max="100"
                      value={config.user_daily_limit}
                      onChange={e => setConfig(c => c ? { ...c, user_daily_limit: Number(e.target.value) } : c)}
                      className="w-20 px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-primary-400 text-center font-bold"
                    />
                    <span className="text-sm text-gray-500">회 (0 = 무제한)</span>
                  </div>
                </div>
              </div>
            </section>

            <section className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
              <h2 className="font-bold text-gray-900 mb-1">📢 홈 공지 배너</h2>
              <p className="text-xs text-gray-400 mb-3">비워두면 배너 미표시</p>
              <input
                type="text" value={banner} onChange={e => setBanner(e.target.value)}
                placeholder="예: 서비스 점검이 예정되어 있습니다..."
                className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-primary-400"
              />
            </section>

            <button onClick={save} disabled={saving}
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

/* ─── 피드백 탭 서브컴포넌트 ─── */
function FeedbackTab({
  feedbackList,
  deletingId,
  onDelete,
  onRefresh,
}: {
  feedbackList: FeedbackItem[]
  deletingId: string | null
  onDelete: (id: string) => void
  onRefresh: () => void
}) {
  const [expandedId, setExpandedId] = useState<string | null>(null)

  return (
    <section className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-bold text-gray-900">💬 사용자 피드백</h2>
        <button onClick={onRefresh} className="text-xs text-primary-600 font-semibold hover:underline">새로고침</button>
      </div>
      {feedbackList.length === 0 ? (
        <p className="text-sm text-gray-400 text-center py-8">접수된 피드백이 없습니다</p>
      ) : feedbackList.map(fb => {
        const isLong = fb.content.length > 80
        const isExpanded = expandedId === fb.id
        const author = fb.users?.display_name ?? fb.users?.email ?? null

        return (
          <div key={fb.id} className="border-b border-gray-100 last:border-0 py-4">
            {/* 작성자 정보 행 */}
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-semibold text-gray-700">
                  {author ?? (fb.user_id ? '회원' : '비로그인')}
                </span>
                {fb.users?.email && (
                  <span className="text-[11px] text-gray-400">{fb.users.email}</span>
                )}
                {fb.phone && (
                  <a
                    href={`tel:${fb.phone}`}
                    className="text-[11px] text-primary-600 font-semibold bg-primary-50 px-2 py-0.5 rounded-full hover:bg-primary-100 transition-colors"
                  >
                    📞 {fb.phone}
                  </a>
                )}
                {fb.page && (
                  <span className="text-[10px] text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">{fb.page}</span>
                )}
              </div>
              <span className="text-[10px] text-gray-300 shrink-0 ml-2">
                {new Date(fb.created_at).toLocaleDateString('ko-KR')}{' '}
                {new Date(fb.created_at).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>

            {/* 본문 */}
            <div className="bg-gray-50 rounded-xl px-4 py-3">
              <p className="text-sm text-gray-800 leading-relaxed whitespace-pre-wrap">
                {isLong && !isExpanded
                  ? fb.content.slice(0, 80) + '…'
                  : fb.content}
              </p>
              {isLong && (
                <button
                  onClick={() => setExpandedId(isExpanded ? null : fb.id)}
                  className="text-xs text-primary-500 font-semibold mt-1 hover:underline"
                >
                  {isExpanded ? '접기 ▲' : '전문 보기 ▼'}
                </button>
              )}
            </div>

            {/* 삭제 버튼 */}
            <div className="flex justify-end mt-2">
              <button
                onClick={() => onDelete(fb.id)}
                disabled={deletingId === fb.id}
                className="text-xs text-red-400 font-semibold hover:text-red-600 border border-red-100 px-3 py-1 rounded-lg disabled:opacity-30 transition-colors"
              >
                {deletingId === fb.id ? '삭제 중…' : '삭제'}
              </button>
            </div>
          </div>
        )
      })}
    </section>
  )
}
