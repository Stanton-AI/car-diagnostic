import type { Metadata } from 'next'
import Script from 'next/script'
import './globals.css'
import FeedbackButton from '@/components/shared/FeedbackButton'
import AmplitudeInit from '@/components/shared/AmplitudeInit'

export const metadata: Metadata = {
  title: '정비톡 - 내 차 3분만에 점검하기',
  description: '증상을 알려주세요. AI가 원인과 수리 비용을 분석해 드립니다.',
  keywords: ['자동차 진단', '중정비', 'AI 진단', '수리 비용', '정비소'],
  openGraph: {
    title: '정비톡 - 내 차 3분만에 점검하기',
    description: '증상을 알려주세요. AI가 원인과 수리 비용을 분석해 드립니다.',
    type: 'website',
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <head>
        {/* Google AdSense — 소유권 인증용 (SSR HTML에 포함) */}
        <meta name="google-adsense-account" content="ca-pub-2199747031677342" />
      </head>
      <body>
        {/* Google AdSense — beforeInteractive로 SSR HTML <head>에 삽입 */}
        <Script
          strategy="beforeInteractive"
          src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-2199747031677342"
          crossOrigin="anonymous"
        />
        <div className="min-h-screen max-w-[480px] mx-auto bg-white shadow-xl relative">
          <AmplitudeInit />
          {children}
          <FeedbackButton />
        </div>
      </body>
    </html>
  )
}
