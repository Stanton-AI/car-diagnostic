'use client'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'

export default function HomePage() {
  const router = useRouter()

  useEffect(() => {
    const check = async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (user) router.replace('/main')
    }
    check()
  }, [router])

  return (
    <div className="flex flex-col min-h-screen bg-white">
      {/* 히어로 */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 pt-16 pb-10 text-center">
        {/* 로고 */}
        <div className="w-16 h-16 bg-primary-600 rounded-2xl flex items-center justify-center mb-6 shadow-lg shadow-primary-200">
          <span className="text-white text-2xl font-black">M</span>
        </div>
        <h1 className="text-3xl font-black text-gray-900 mb-2 tracking-tight">
          MIKY
        </h1>
        <p className="text-primary-600 font-semibold text-sm mb-8 tracking-widest uppercase">
          AI 자동차 진단 어드바이저
        </p>

        <p className="text-gray-600 text-base leading-relaxed mb-10 max-w-xs">
          차량 증상을 알려주시면<br />
          <span className="text-gray-900 font-semibold">원인 · 확률 · 예상 수리비용</span>을<br />
          AI가 즉시 분석해 드립니다
        </p>

        {/* 특장점 */}
        <div className="w-full max-w-sm grid grid-cols-3 gap-3 mb-10">
          {[
            { icon: '🔍', text: '원인 확률\n분석' },
            { icon: '💰', text: '수리비용\n사전 파악' },
            { icon: '🏪', text: '파트너\n정비소 연결' },
          ].map((item, i) => (
            <div key={i} className="bg-surface-50 rounded-2xl p-3 text-center border border-surface-200">
              <div className="text-2xl mb-1">{item.icon}</div>
              <p className="text-xs text-gray-600 font-medium whitespace-pre-line leading-tight">{item.text}</p>
            </div>
          ))}
        </div>

        {/* CTA */}
        <Link
          href="/chat"
          className="w-full max-w-sm bg-primary-600 hover:bg-primary-700 text-white font-bold py-4 rounded-2xl text-base transition-all active:scale-[0.98] shadow-lg shadow-primary-200 flex items-center justify-center gap-2"
        >
          <span>지금 바로 진단하기</span>
          <span className="text-lg">→</span>
        </Link>
        <p className="text-xs text-gray-400 mt-3">로그인 없이도 진단 가능</p>
      </div>

      {/* 하단 로그인 */}
      <div className="px-6 pb-8 text-center">
        <p className="text-sm text-gray-500">
          이미 계정이 있으신가요?{' '}
          <Link href="/login" className="text-primary-600 font-semibold">
            로그인
          </Link>
        </p>
      </div>
    </div>
  )
}
