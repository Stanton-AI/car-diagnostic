import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { verifyAdmin } from '../_lib'

export async function GET() {
  if (!await verifyAdmin()) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const service = createServiceClient()

  try {
    const [
      { count: totalReq }, { count: openReq }, { count: totalBids },
      { count: totalJobsCnt }, { count: pendingShopsCnt }, { count: activeShopsCnt },
      { data: jobs }, { data: pending },
    ] = await Promise.all([
      service.from('repair_requests').select('*', { count: 'exact', head: true }),
      service.from('repair_requests').select('*', { count: 'exact', head: true }).in('status', ['open', 'bidding']),
      service.from('shop_bids').select('*', { count: 'exact', head: true }),
      service.from('repair_jobs').select('*', { count: 'exact', head: true }),
      service.from('partner_shops').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
      service.from('partner_shops').select('*', { count: 'exact', head: true }).eq('status', 'active'),
      service.from('repair_jobs').select('actual_total_cost').eq('status', 'completed').eq('payment_status', 'paid'),
      service.from('partner_shops').select('id, name, owner_name, phone, address, business_number, created_at').eq('status', 'pending').order('created_at', { ascending: true }),
    ])

    const totalRevenue = (jobs ?? []).reduce((s, j) => s + (j.actual_total_cost ?? 0), 0)

    return NextResponse.json({
      stats: {
        totalRequests: totalReq ?? 0, openRequests: openReq ?? 0,
        totalBids: totalBids ?? 0, totalJobs: totalJobsCnt ?? 0,
        pendingShops: pendingShopsCnt ?? 0, activeShops: activeShopsCnt ?? 0,
        totalRevenue, commissionRevenue: Math.round(totalRevenue * 0.10),
      },
      pendingShops: pending ?? [],
    })
  } catch {
    return NextResponse.json({ stats: null, pendingShops: [], error: '마켓 테이블 없음' })
  }
}
