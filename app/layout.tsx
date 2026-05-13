import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: '윤쎈 PoC — AI 애널리스트 평가',
  description: '5개 LLM 프로바이더 블라인드 비교 실험 대시보드',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body className="antialiased">{children}</body>
    </html>
  )
}
