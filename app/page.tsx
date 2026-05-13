import { getLatestBriefings, BriefingRecord } from '@/lib/db'
import Link from 'next/link'

export const revalidate = 30

const SLOTS = [
  { key: '장전', en: 'Pre-Market',  accent: 'border-blue-500',   badge: 'bg-blue-50 text-blue-700'   },
  { key: '장중', en: 'Intraday',    accent: 'border-emerald-500', badge: 'bg-emerald-50 text-emerald-700' },
  { key: '장후', en: 'Post-Market', accent: 'border-violet-500',  badge: 'bg-violet-50 text-violet-700'  },
]

function BriefingContent({ content }: { content: string }) {
  const lines = content.split('\n')
  return (
    <div>
      {lines.map((line, i) => {
        if (line.startsWith('# '))  return <h1 key={i} className="text-xl font-bold text-gray-900 mt-4 mb-2">{line.slice(2)}</h1>
        if (line.startsWith('## ')) return <h2 key={i} className="text-base font-bold text-gray-800 mt-4 mb-1 border-b border-gray-100 pb-1">{line.slice(3)}</h2>
        if (line.startsWith('### ')) return <h3 key={i} className="text-sm font-semibold text-gray-700 mt-3 mb-1">{line.slice(4)}</h3>
        if (line === '---') return <hr key={i} className="my-3 border-gray-100" />
        if (line.startsWith('⚠️')) return <p key={i} className="text-xs text-gray-400 mt-2">{line}</p>
        if (line.trim() === '') return <div key={i} className="h-1" />
        const parts = line.split(/(\*\*[^*]+\*\*)/)
        return (
          <p key={i} className="text-sm text-gray-700 leading-relaxed">
            {parts.map((p, j) =>
              p.startsWith('**') && p.endsWith('**')
                ? <strong key={j}>{p.slice(2, -2)}</strong>
                : p
            )}
          </p>
        )
      })}
    </div>
  )
}

export default async function PublicPage() {
  let briefings: BriefingRecord[] = []
  try { briefings = await getLatestBriefings() } catch { /* DB not configured */ }

  const bySlot: Record<string, BriefingRecord | undefined> = {}
  briefings.forEach(b => { bySlot[b.slot] = b })

  const today = new Date().toLocaleDateString('ko-KR', {
    year: 'numeric', month: 'long', day: 'numeric', weekday: 'long',
  })

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b">
        <div className="max-w-3xl mx-auto px-6 py-6 flex items-end justify-between">
          <div>
            <p className="text-xs font-semibold text-gray-400 tracking-widest uppercase mb-1">AlphaResearch</p>
            <h1 className="text-2xl font-bold text-gray-900 tracking-tight">알파리서치</h1>
            <p className="text-sm text-gray-500 mt-0.5">AI 리서치 센터장 · 일일 시장 브리핑</p>
          </div>
          <span className="text-sm text-gray-400 hidden sm:block">{today}</span>
        </div>
      </header>

      {/* Briefing sections */}
      <main className="max-w-3xl mx-auto px-6 py-8 space-y-6">
        {SLOTS.map(({ key, en, accent, badge }) => {
          const b = bySlot[key]
          return (
            <section key={key} className={`bg-white rounded-xl border-l-4 ${accent} shadow-sm overflow-hidden`}>
              <div className="p-6">
                <div className="flex items-start justify-between mb-5 gap-3">
                  <div>
                    <span className={`inline-block text-xs font-semibold px-2 py-0.5 rounded-full ${badge} mb-1`}>{en}</span>
                    <h2 className="text-lg font-bold text-gray-900">{key} 브리핑</h2>
                  </div>
                  {b ? (
                    <span className="text-xs text-gray-400 shrink-0 pt-1">
                      {new Date(b.created_at).toLocaleString('ko-KR', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })} 게시
                    </span>
                  ) : (
                    <span className="text-xs text-gray-300 shrink-0 pt-1">미게시</span>
                  )}
                </div>
                {b ? (
                  <BriefingContent content={b.content} />
                ) : (
                  <div className="text-sm text-gray-400 bg-gray-50 rounded-lg p-8 text-center">
                    {key} 브리핑이 아직 게시되지 않았습니다.
                  </div>
                )}
              </div>
            </section>
          )
        })}
      </main>

      {/* Footer */}
      <footer className="max-w-3xl mx-auto px-6 py-8 border-t">
        <p className="text-xs text-gray-400 text-center">
          ⚠️ 본 브리핑은 AI 생성 분석 결과로, 투자 추천이 아닙니다.
        </p>
        <p className="text-center mt-3">
          <Link href="/admin" className="text-xs text-gray-300 hover:text-gray-500 transition">관리자</Link>
        </p>
      </footer>
    </div>
  )
}
