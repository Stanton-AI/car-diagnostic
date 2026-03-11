import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// GET /api/partner-shops — 활성 파트너 정비소 목록 / 내 샵 조회
export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient()
    const mine = req.nextUrl.searchParams.get('mine')

    if (mine === '1') {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

      const { data } = await supabase
        .from('partner_shops')
        .select('*')
        .eq('user_id', user.id)
        .single()

      return NextResponse.json(data ?? null)
    }

    const { data, error } = await supabase
      .from('partner_shops')
      .select('id, name, address, phone, categories, rating, review_count, total_jobs, description, profile_image_url')
      .eq('status', 'active')
      .order('rating', { ascending: false })

    if (error) throw error
    return NextResponse.json(data ?? [])
  } catch (e) {
    console.error('[partner-shops GET]', e)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
