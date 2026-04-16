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
        {/* Google AdSense — 승인 후 ca-pub-2199747031677342를 실제 퍼블리셔 ID로 교체 */}
        <Script
          async
          src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-2199747031677342"
          crossOrigin="anonymous"
          strategy="afterInteractive"
        />
      </head>
      <body>
        <div className="min-h-screen max-w-[480px] mx-auto bg-white shadow-xl relative">
          <AmplitudeInit />
          {children}
          <FeedbackButton />
        </div>
      </body>
    </html>
  )
}
