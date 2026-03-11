'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { getMyShop } from '@/lib/marketplace'
import { formatKRW } from '@/lib/utils'
import type { PartnerShop } from '@/types'

interface DashStats {
  todayRequests: number
  openBids: number
  completedJobs: number
  totalRevenue: number
  pendingBids: number
  unreadNotifications: number
  activeJobs: number
}

export default function PartnerDashboard() {
  const router = useRouter()
  const supabase = createClient()
  const [shop, setShop] = useState<PartnerShop | null>(null)
  const [stats, setStats] = useState<DashStats | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.replace('/login?redirect=/partner'); return }

      const myShop = await getMyShop(supabase)
      if (!myShop) { router.replace('/partner/register'); return }
      setShop(myShop)

      if (myShop.status === 'pending') {
        setLoading(false)
        return
      }

      // 통계
      const today = new Date(); today.setHours(0,0,0,0)
      const [
        { count: todayReq },
        { count: openBids },
        { data: jobs },
        { count: pendingBids },
        { count: unread },
        { count: activeJobsCount },
      ] = await Promise.all([
        supabase.from('repair_requests').select('*', { count: 'exact', head: true })
          .in('status', ['open','bidding']).gte('created_at', today.toISOString()),
        supabase.from('shop_bids').select('*', { count: 'exact', head: true })
          .eq('shop_id', myShop.id).eq('status', 'accepted'),
        supabase.from('repair_jobs').select('actual_total_cost, status')
          .eq('shop_id', myShop.id).eq('status', 'completed'),
        supabase.from('shop_bids').select('*', { count: 'exact', head: true })
          .eq('shop_id', myShop.id).eq('status', 'pending'),
        supabase.from('notifications').select('*', { count: 'exact', head: true })
          .eq('shop_id', myShop.id).eq('is_read', false),
        supabase.from('repair_jobs').select('*', { count: 'exact', head: true })
          .eq('shop_id', myShop.id).in('status', ['scheduled', 'in_progress']),
      ])

      const totalRevenue = (jobs ?? []).reduce((sum, j) => sum + (j.actual_total_cost ?? 0), 0)
      setStats({
        todayRequests: todayReq ?? 0,
        openBids: openBids ?? 0,
        completedJobs: jobs?.length ?? 0,
        totalRevenue,
        pendingBids: pendingBids ?? 0,
        unreadNotifications: unread ?? 0,
        activeJobs: activeJobsCount ?? 0,
      })
      setLoading(false)
    }
    load()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (loading) return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="w-8 h-8 border-2 border-blue-200 border-t-blue-600 rounded-full animate-spin" />
    </div>
  )

  // 승인 대기 중
  if (shop?.status === 'pending') {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="text-center max-w-sm">
          <div className="text-5xl mb-4">⏳</div>
          <h1 className="text-xl font-black text-gray-900 mb-2">승인 검토 중</h1>
          <p className="text-sm text-gray-500 mb-6">
            <strong>{shop.name}</strong> 파트너 신청을 검토 중입니다.<br />
            보통 1~2 영업일 내 처리됩니다.
          </p>
          <button onClick={() => router.push('/main')} className="text-sm text-gray-400 hover:text-gray-600">
            홈으로 돌아가기
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col min-h-screen">
      {/* 헤더 */}
      <header className="bg-white border-b border-gray-200 px-4 py-4 flex items-center gap-3">
        <div className="flex-1">
          <p className="text-xs text-gray-400">파트너 대시보드</p>
          <h1 className="text-lg font-black text-gray-900">{shop?.name}</h1>
        </div>
        <div className="relative">
          <button
            onClick={() => router.push('/partner/requests')}
            className="w-10 h-10 flex items-center justify-center rounded-full bg-gray-100 hover:bg-gray-200 text-gray-600"
          >
            🔔
          </button>
          {(stats?.unreadNotifications ?? 0) > 0 && (
            <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center text-[10px] text-white font-bold">
              {stats!.unreadNotifications}
            </span>
          )}
        </div>
        <button
          onClick={() => router.push('/main')}
          className="text-xs text-gray-400 hover:text-gray-600"
        >
          소비자 앱 →
        </button>
      </header>

      <div className="px-4 py-4 space-y-4">

        {/* 요약 통계 — 클릭 시 해당 탭으로 이동 */}
        {stats && (
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: '오늘 새 요청',   value: stats.todayRequests,  color: 'text-blue-600',   bg: 'bg-blue-50',   icon: '📋', path: '/partner/requests?tab=new' },
              { label: '입찰 진행 중',   value: stats.pendingBids,    color: 'text-amber-600',  bg: 'bg-amber-50',  icon: '⏳', path: '/partner/requests?tab=bidding' },
              { label: '낙찰 완료',      value: stats.openBids,       color: 'text-green-600',  bg: 'bg-green-50',  icon: '✅', path: '/partner/requests?tab=won' },
              { label: '누적 완료 수리', value: stats.completedJobs,  color: 'text-purple-600', bg: 'bg-purple-50', icon: '🔧', path: '/partner/requests?tab=done' },
            ].map(item => (
              <button key={item.label} onClick={() => router.push(item.path)} className={`${item.bg} rounded-2xl p-4 text-center hover:brightness-95 active:scale-95 transition-all`}>
                <p className="text-2xl mb-1">{item.icon}</p>
                <p className={`text-2xl font-black ${item.color}`}>{item.value}</p>
                <p className="text-xs text-gray-500 mt-0.5">{item.label}</p>
              </button>
            ))}
          </div>
        )}

        {/* 매출 현황 */}
        {stats && (
          <div className="bg-gradient-to-br from-gray-800 to-gray-900 rounded-2xl p-4 text-white">
            <p className="text-xs text-gray-400">누적 완료 매출</p>
            <p className="text-3xl font-black mt-1">{formatKRW(stats.totalRevenue)}</p>
            <p className="text-xs text-gray-400 mt-1">
              평균 {stats.completedJobs > 0 ? formatKRW(Math.round(stats.totalRevenue / stats.completedJobs)) : '-'} / 건
            </p>
          </div>
        )}

        {/* 주요 메뉴 */}
        <div className="space-y-2">
          {[
            {
              icon: '📋', title: '견적 요청 보기',
              desc: `새로운 수리 요청 확인 및 입찰`,
              badge: stats?.todayRequests ?? 0,
              path: '/partner/requests',
              color: 'border-blue-100 hover:border-blue-300',
            },
            {
              icon: '🔧', title: '진행 중인 작업',
              desc: '낙찰된 수리 작업 관리',
              badge: stats?.activeJobs ?? 0,
              path: '/partner/jobs',
              color: 'border-gray-100 hover:border-gray-300',
            },
          ].map(item => (
            <button
              key={item.path}
              onClick={() => router.push(item.path)}
              className={`w-full bg-white rounded-2xl p-4 border ${item.color} flex items-center gap-4 transition-colors text-left shadow-sm`}
            >
              <span className="text-2xl">{item.icon}</span>
              <div className="flex-1">
                <p className="font-bold text-gray-900">{item.title}</p>
                <p className="text-xs text-gray-400">{item.desc}</p>
              </div>
              {item.badge > 0 && (
                <span className="bg-red-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">{item.badge}</span>
              )}
              <span className="text-gray-300">→</span>
            </button>
          ))}
        </div>

        {/* 정비소 정보 */}
        <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-bold text-gray-900">정비소 정보</h3>
            <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
              shop?.status === 'active' ? 'text-green-600 bg-green-50' : 'text-amber-600 bg-amber-50'
            }`}>
              {shop?.status === 'active' ? '활성' : '비활성'}
            </span>
          </div>
          <div className="space-y-1.5 text-sm text-gray-600">
            <p>📍 {shop?.address}</p>
            <p>📞 {shop?.phone}</p>
            <p>⭐ {shop?.rating?.toFixed(1) ?? '-'} ({shop?.reviewCount ?? 0}개 리뷰)</p>
          </div>
          <div className="mt-3 pt-3 border-t border-gray-100 flex items-center justify-between text-xs text-gray-400">
            <span>구독: {shop?.subscriptionPlan === 'free' ? '무료' : shop?.subscriptionPlan}</span>
            <span>수수료: {((shop?.commissionRate ?? 0.10) * 100).toFixed(0)}%</span>
          </div>
        </div>
      </div>
    </div>
  )
}
