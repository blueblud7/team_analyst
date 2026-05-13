import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: '알파리서치 — AI 리서치 센터장 브리핑',
  description: '알파리서치 AI가 매일 장전·장중·장후 시장 브리핑을 제공합니다.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body className="antialiased">{children}</body>
    </html>
  )
}
