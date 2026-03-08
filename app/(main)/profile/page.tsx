'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { UserProfile } from '@/types'

export default function ProfilePage() {
  const router = useRouter()
  const supabase = createClient()
  const [user, setUser] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [loggingOut, setLoggingOut] = useState(false)

  useEffect(() => {
    const load = async () => {
      const { data: { user: authUser } } = await supabase.auth.getUser()
      if (!authUser) { router.replace('/'); return }
      const { data: profile } = await supabase.from('users').select('*').eq('id', authUser.id).single()
      setUser(profile)
      setLoading(false)
    }
    load()
  }, [])

  const handleLogout = async () => {
    setLoggingOut(true)
    await supabase.auth.signOut()
    router.replace('/')
  }

  if (loading) return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="w-10 h-10 border-2 border-primary-200 border-t-primary-600 rounded-full animate-spin" />
    </div>
  )

  const displayName = user?.displayName ?? '사용자'
  const initial = displayName[0]?.toUpperCase() ?? 'U'

  return (
    <div className="flex flex-col min-h-screen bg-surface-50">
      {/* 헤더 */}
      <header className="bg-white px-5 pt-12 pb-4 flex items-center gap-3 border-b border-gray-100">
        <button onClick={() => router.back()} className="text-gray-400 hover:text-gray-600 transition-colors p-1">
          ←
        </button>
        <h1 className="text-lg font-black text-gray-900">내 프로필</h1>
      </header>

      <div className="flex-1 px-4 py-6 space-y-4">
        {/* 프로필 카드 */}
        <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm flex items-center gap-4">
          <div className="w-16 h-16 rounded-full bg-primary-100 flex items-center justify-center overflow-hidden flex-shrink-0">
            {user?.avatarUrl ? (
              <img src={user.avatarUrl} alt="" className="w-full h-full object-cover" />
            ) : (
              <span className="text-primary-600 font-black text-2xl">{initial}</span>
            )}
          </div>
          <div>
            <p className="font-bold text-gray-900 text-lg">{displayName}</p>
            <p className="text-sm text-gray-500">{user?.email ?? ''}</p>
          </div>
        </div>

        {/* 메뉴 */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <button
            onClick={() => router.push('/history')}
            className="w-full flex items-center justify-between px-5 py-4 hover:bg-gray-50 transition-colors border-b border-gray-50"
          >
            <div className="flex items-center gap-3">
              <span className="text-lg">📋</span>
              <span className="font-semibold text-gray-800 text-sm">진단 내역</span>
            </div>
            <span className="text-gray-300">→</span>
          </button>
          <button
            onClick={() => router.push('/vehicles/new')}
            className="w-full flex items-center justify-between px-5 py-4 hover:bg-gray-50 transition-colors"
          >
            <div className="flex items-center gap-3">
              <span className="text-lg">🚗</span>
              <span className="font-semibold text-gray-800 text-sm">차량 정보 관리</span>
            </div>
            <span className="text-gray-300">→</span>
          </button>
        </div>

        {/* 로그아웃 */}
        <button
          onClick={handleLogout}
          disabled={loggingOut}
          className="w-full py-4 bg-white border border-red-200 text-red-500 font-bold rounded-2xl text-sm hover:bg-red-50 transition-colors disabled:opacity-50 shadow-sm"
        >
          {loggingOut ? '로그아웃 중...' : '로그아웃'}
        </button>
      </div>
    </div>
  )
}
