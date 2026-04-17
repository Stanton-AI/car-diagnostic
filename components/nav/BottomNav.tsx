'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

const NAV_ITEMS = [
  {
    label: '홈',
    href: '/main',
    icon: (active: boolean) => (
      <svg width="20" height="20" viewBox="0 0 24 24" fill={active ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth={active ? 0 : 1.8} strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 9.5L12 3l9 6.5V20a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9.5z" />
        {!active && <path d="M9 21V12h6v9" />}
      </svg>
    ),
  },
  {
    label: '진단이력',
    href: '/history',
    icon: (active: boolean) => (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2.2 : 1.8} strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="9" />
        <polyline points="12 7 12 12 15 15" />
      </svg>
    ),
  },
  {
    label: '게시판',
    href: '/board',
    icon: (active: boolean) => (
      <svg width="20" height="20" viewBox="0 0 24 24" fill={active ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth={active ? 0 : 1.8} strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
      </svg>
    ),
  },
  {
    label: '더보기',
    href: '/profile',
    icon: (active: boolean) => (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2.2 : 1.8} strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="8" r="4" />
        <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" />
      </svg>
    ),
  },
]

export default function BottomNav() {
  const pathname = usePathname()

  return (
    <div className="flex-shrink-0 px-4 pb-2 pt-1 safe-area-pb">
      <nav
        className="flex items-center justify-around h-14 px-2 rounded-2xl"
        style={{
          background: 'rgba(255, 255, 255, 0.88)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          boxShadow: '0 4px 24px rgba(0, 0, 0, 0.06), 0 0 0 1px rgba(0, 0, 0, 0.03)',
        }}
      >
        {NAV_ITEMS.map(({ label, href, icon }) => {
          const active = pathname === href || (href === '/main' && pathname === '/')
          return (
            <Link
              key={href}
              href={href}
              className="relative flex flex-col items-center justify-center gap-0.5 flex-1 h-full transition-all duration-200"
            >
              {/* 활성 탭 배경 글로우 */}
              {active && (
                <div
                  className="absolute inset-x-2 inset-y-1.5 rounded-xl -z-10"
                  style={{
                    background: 'linear-gradient(135deg, rgba(91,79,207,0.08) 0%, rgba(124,111,224,0.05) 100%)',
                  }}
                />
              )}
              <span className={`transition-colors duration-200 ${active ? 'text-primary-600' : 'text-gray-400'}`}>
                {icon(active)}
              </span>
              <span className={`text-[10px] leading-none transition-all duration-200 ${
                active ? 'text-primary-600 font-bold' : 'text-gray-400 font-medium'
              }`}>
                {label}
              </span>
              {/* 활성 도트 인디케이터 */}
              {active && (
                <div className="absolute -bottom-0.5 w-1 h-1 rounded-full bg-primary-500" />
              )}
            </Link>
          )
        })}
      </nav>
    </div>
  )
}
