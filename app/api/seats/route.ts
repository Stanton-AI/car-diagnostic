import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

export const revalidate = 0 // 캐시 없음 — 항상 최신 count 반환

export async function GET() {
  try {
    const supabase = createServiceClient()
    const { count, error } = await supabase
      .from('users')
      .select('*', { count: 'exact', head: true })

    if (error) {
      console.error('[/api/seats] Supabase error:', error)
      return NextResponse.json({ count: 0 }, { status: 500 })
    }

    return NextResponse.json({ count: count ?? 0 })
  } catch (err) {
    console.error('[/api/seats] Unexpected error:', err)
    return NextResponse.json({ count: 0 }, { status: 500 })
  }
}
