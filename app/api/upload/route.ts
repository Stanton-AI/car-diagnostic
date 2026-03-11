import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

const MAX_SIZE = 10 * 1024 * 1024 // 10MB
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'application/pdf']

// POST /api/upload — 파일 업로드 (Supabase Storage)
export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const formData = await req.formData()
    const file = formData.get('file') as File | null
    const folder = (formData.get('folder') as string) || 'misc'

    if (!file) return NextResponse.json({ error: '파일이 없습니다' }, { status: 400 })
    if (file.size > MAX_SIZE) return NextResponse.json({ error: '파일 크기가 10MB를 초과합니다' }, { status: 400 })
    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json({ error: '지원하지 않는 파일 형식입니다 (jpg/png/webp/pdf)' }, { status: 400 })
    }

    const ext = file.name.split('.').pop() ?? 'jpg'
    const path = `${folder}/${user.id}/${Date.now()}.${ext}`

    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    // service client로 Storage에 업로드 (RLS 정책 설정 전에도 작동하도록)
    const svc = createServiceClient()
    const { error: uploadErr } = await svc.storage
      .from('repair-files')
      .upload(path, buffer, {
        contentType: file.type,
        upsert: false,
      })

    if (uploadErr) {
      console.error('[upload]', uploadErr)
      return NextResponse.json({ error: `업로드 실패: ${uploadErr.message}` }, { status: 500 })
    }

    // Public URL 생성
    const { data: { publicUrl } } = svc.storage
      .from('repair-files')
      .getPublicUrl(path)

    return NextResponse.json({ url: publicUrl, path })
  } catch (e: unknown) {
    console.error('[upload]', e)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
