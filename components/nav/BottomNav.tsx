'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

const NAV_ITEMS = [
  {
    label: '홈',
    href: '/main',
    icon: (active: boolean) => (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2 : 1.8} strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 9.5L12 3l9 6.5V20a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9.5z" />
        <path d="M9 21V12h6v9" />
      </svg>
    ),
  },
  {
    label: '진단이력',
    href: '/history',
    icon: (active: boolean) => (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2 : 1.8} strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="9" />
        <polyline points="12 7 12 12 15 15" />
      </svg>
    ),
  },
  {
    label: '게시판',
    href: '/board',
    icon: (active: boolean) => (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2 : 1.8} strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
      </svg>
    ),
  },
  {
    label: '더보기',
    href: '/profile',
    icon: (active: boolean) => (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2 : 1.8} strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="8" r="4" />
        <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" />
      </svg>
    ),
  },
]

export default function BottomNav() {
  const pathname = usePathname()

  return (
    <div className="flex-shrink-0 safe-area-pb" style={{ background: '#ffffff', borderTop: '1px solid rgba(0,0,0,0.06)' }}>
      <nav className="flex items-center justify-around h-16 px-2">
        {NAV_ITEMS.map(({ label, href, icon }) => {
          const active = pathname === href || (href === '/main' && pathname === '/')
          return (
            <Link
              key={href}
              href={href}
              className="relative flex flex-col items-center justify-center gap-1 flex-1 h-full transition-all duration-200"
            >
              {active ? (
                /* Active: solid pill with white icon + label */
                <div
                  className="flex flex-col items-center gap-0.5 px-4 py-1.5 rounded-2xl"
                  style={{ background: '#4C4DDC' }}
                >
                  <span className="text-white">{icon(true)}</span>
                  <span className="text-[10px] leading-none font-bold text-white">{label}</span>
                </div>
              ) : (
                /* Inactive: gray icon + small label */
                <div className="flex flex-col items-center gap-0.5 px-4 py-1.5">
                  <span className="text-gray-400">{icon(false)}</span>
                  <span className="text-[10px] leading-none font-medium text-gray-400">{label}</span>
                </div>
              )}
            </Link>
          )
        })}
      </nav>
    </div>
  )
}
