'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'

interface BriefingRecord {
  id: number
  slot: string
  content: string
  provider: string
  item_count: number
  created_at: string
}

interface MarketIndicator {
  symbol: string
  name: string
  price: number
  changePct: number
  currency: string
  decimals: number
}

function TickerItem({ ind }: { ind: MarketIndicator }) {
  const up = ind.changePct >= 0
  return (
    <div className="flex items-baseline gap-1.5 shrink-0 px-4">
      <span className="text-xs text-gray-500">{ind.name}</span>
      <span className="text-sm font-semibold tabular-nums text-white">
        {ind.price.toFixed(ind.decimals)}
      </span>
      <span className={`text-xs font-medium tabular-nums ${up ? 'text-red-400' : 'text-blue-400'}`}>
        {up ? '▲' : '▼'}{Math.abs(ind.changePct).toFixed(2)}%
      </span>
      <span className="text-gray-700 text-xs ml-2">|</span>
    </div>
  )
}

function MarketStrip() {
  const [indicators, setIndicators] = useState<MarketIndicator[]>([])
  const [updatedAt, setUpdatedAt] = useState<string | null>(null)

  useEffect(() => {
    function load() {
      fetch('/api/market')
        .then(r => r.json())
        .then(({ indicators = [], updatedAt }) => {
          setIndicators(indicators)
          setUpdatedAt(updatedAt)
        })
        .catch(() => {})
    }
    load()
    const id = setInterval(load, 60_000)
    return () => clearInterval(id)
  }, [])

  if (!indicators.length) return null

  // Duplicate for seamless loop
  const both = [...indicators, ...indicators]

  return (
    <div className="bg-gray-900 text-white border-b border-gray-800 overflow-hidden relative">
      {/* Time badge — fixed left */}
      {updatedAt && (
        <div className="absolute left-0 top-0 bottom-0 z-10 flex items-center pl-3 pr-4 bg-gradient-to-r from-gray-900 via-gray-900 to-transparent pointer-events-none">
          <span className="text-xs text-gray-500 tabular-nums">
            {new Date(updatedAt).toLocaleTimeString('ko-KR', { timeZone: 'Asia/Seoul', hour: '2-digit', minute: '2-digit' })}
          </span>
        </div>
      )}
      {/* Scrolling ticker */}
      <div className="flex animate-ticker py-2 pl-16">
        {both.map((ind, i) => <TickerItem key={`${ind.symbol}-${i}`} ind={ind} />)}
      </div>
    </div>
  )
}

const SLOTS = [
  { key: '장전', en: 'Pre-Market',  accent: 'border-blue-500',   badge: 'bg-blue-50 text-blue-700'   },
  { key: '장중', en: 'Intraday',    accent: 'border-emerald-500', badge: 'bg-emerald-50 text-emerald-700' },
  { key: '장후', en: 'Post-Market', accent: 'border-violet-500',  badge: 'bg-violet-50 text-violet-700'  },
]

function getKSTToday(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Seoul' })
}

function addDays(dateStr: string, n: number): string {
  const d = new Date(dateStr + 'T12:00:00Z')
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}

function formatKSTDate(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00+09:00')
  return d.toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'short' })
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)
  const copy = useCallback(() => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }, [text])
  return (
    <button
      onClick={copy}
      title={copied ? '복사됨' : '복사'}
      className="p-1.5 rounded hover:bg-gray-100 transition text-gray-400 hover:text-gray-600 shrink-0"
    >
      {copied ? (
        <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 text-green-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="20 6 9 17 4 12" />
        </svg>
      ) : (
        <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
          <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
        </svg>
      )}
    </button>
  )
}

// Section header color scheme
const SECTION_STYLES: Array<{ match: RegExp; bg: string; text: string; bar: string; icon: string }> = [
  { match: /핵심\s*메시지|핵심\s*신호|요약/,   bg: 'bg-blue-50',   text: 'text-blue-800',   bar: 'bg-blue-500',   icon: '◈' },
  { match: /섹터|동향|종목/,                    bg: 'bg-teal-50',   text: 'text-teal-800',   bar: 'bg-teal-500',   icon: '◉' },
  { match: /신호|주목|이슈|변곡/,               bg: 'bg-amber-50',  text: 'text-amber-800',  bar: 'bg-amber-500',  icon: '◆' },
  { match: /체크|내일|점검|포인트|어젠다/,      bg: 'bg-emerald-50',text: 'text-emerald-800',bar: 'bg-emerald-500',icon: '◇' },
  { match: /지표|시장/,                         bg: 'bg-gray-100',  text: 'text-gray-700',   bar: 'bg-gray-400',   icon: '◎' },
]

function getSectionStyle(title: string) {
  for (const s of SECTION_STYLES) {
    if (s.match.test(title)) return s
  }
  return { bg: 'bg-gray-50', text: 'text-gray-700', bar: 'bg-gray-300', icon: '○' }
}

// Highlight numbers and percentages inline
function InlineText({ text }: { text: string }) {
  // Split on **bold**, numbers with %, ▲▼
  const parts = text.split(/(\*\*[^*]+\*\*|[+-]?\d+\.?\d*%|▲\d+\.?\d*%|▼\d+\.?\d*%)/g)
  return (
    <>
      {parts.map((p, i) => {
        if (p.startsWith('**') && p.endsWith('**'))
          return <strong key={i} className="font-semibold text-gray-900">{p.slice(2, -2)}</strong>
        if (/▲/.test(p) || (/^[+]?\d/.test(p) && p.endsWith('%') && !p.startsWith('-')))
          return <span key={i} className="font-semibold text-red-500 tabular-nums">{p}</span>
        if (/▼/.test(p) || (/-\d/.test(p) && p.endsWith('%')))
          return <span key={i} className="font-semibold text-blue-500 tabular-nums">{p}</span>
        if (/\d+\.?\d*%$/.test(p))
          return <span key={i} className="font-medium text-gray-600 tabular-nums">{p}</span>
        return <span key={i}>{p}</span>
      })}
    </>
  )
}

function BriefingContent({ content }: { content: string }) {
  let currentSection = ''

  return (
    <div className="space-y-0.5">
      {content.split('\n').map((line, i) => {
        if (line.startsWith('# ')) {
          return (
            <h1 key={i} className="text-lg font-bold text-gray-900 mt-5 mb-3 pb-2 border-b-2 border-gray-200">
              {line.slice(2)}
            </h1>
          )
        }

        if (line.startsWith('## ')) {
          const title = line.slice(3)
          currentSection = title
          const s = getSectionStyle(title)
          return (
            <div key={i} className={`flex items-center gap-2 mt-5 mb-2 px-3 py-1.5 rounded-lg ${s.bg}`}>
              <span className={`text-xs font-bold ${s.text} opacity-60`}>{s.icon}</span>
              <h2 className={`text-sm font-bold ${s.text}`}>{title}</h2>
            </div>
          )
        }

        if (line.startsWith('### ')) {
          return (
            <h3 key={i} className="text-sm font-semibold text-gray-700 mt-3 mb-1 pl-1">
              {line.slice(4)}
            </h3>
          )
        }

        if (line === '---') return <hr key={i} className="my-4 border-gray-100" />

        if (line.startsWith('⚠️')) {
          return <p key={i} className="text-xs text-gray-400 mt-3 pt-2 border-t border-gray-100">{line}</p>
        }

        if (line.trim() === '') return <div key={i} className="h-1" />

        // Bullet list item
        if (line.match(/^[-•]\s/)) {
          const s = getSectionStyle(currentSection)
          return (
            <div key={i} className="flex items-start gap-2 pl-2 py-0.5">
              <span className={`mt-1.5 w-1.5 h-1.5 rounded-full shrink-0 ${s.bar}`} />
              <p className="text-sm text-gray-700 leading-relaxed">
                <InlineText text={line.slice(2)} />
              </p>
            </div>
          )
        }

        // Numbered list
        if (line.match(/^\d+\.\s/)) {
          const [num, ...rest] = line.split(/\.\s(.*)/)
          return (
            <div key={i} className="flex items-start gap-2 pl-2 py-0.5">
              <span className="shrink-0 w-5 h-5 rounded-full bg-gray-200 text-gray-500 text-xs flex items-center justify-center font-semibold mt-0.5">{num}</span>
              <p className="text-sm text-gray-700 leading-relaxed"><InlineText text={rest[0] ?? ''} /></p>
            </div>
          )
        }

        return (
          <p key={i} className="text-sm text-gray-700 leading-relaxed pl-1">
            <InlineText text={line} />
          </p>
        )
      })}
    </div>
  )
}

export default function PublicPage() {
  const [date, setDate] = useState(getKSTToday())
  const [briefings, setBriefings] = useState<BriefingRecord[]>([])
  const [loading, setLoading] = useState(true)

  const today = getKSTToday()
  const isToday = date === today

  useEffect(() => {
    setLoading(true)
    fetch(`/api/briefings?date=${date}`)
      .then(r => r.json())
      .then(({ briefings = [] }) => setBriefings(briefings))
      .catch(() => setBriefings([]))
      .finally(() => setLoading(false))
  }, [date])

  const bySlot: Record<string, BriefingRecord | undefined> = {}
  briefings.forEach(b => { bySlot[b.slot] = b })

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b">
        <div className="max-w-3xl mx-auto px-6 py-6">
          <div className="flex items-end justify-between">
            <div>
              <p className="text-xs font-semibold text-gray-400 tracking-widest uppercase mb-1">AlphaResearch</p>
              <h1 className="text-2xl font-bold text-gray-900 tracking-tight">알파리서치</h1>
              <p className="text-sm text-gray-500 mt-0.5">AI 리서치 센터장 · 일일 시장 브리핑</p>
            </div>
            <Link
              href="/macro"
              className="text-sm font-medium text-gray-500 hover:text-gray-900 border border-gray-200 hover:border-gray-400 px-3 py-1.5 rounded-lg transition"
            >
              매크로 뷰 →
            </Link>
          </div>
        </div>
      </header>

      {/* Market indicators strip */}
      <MarketStrip />

      {/* Date navigation */}
      <div className="bg-white border-b">
        <div className="max-w-3xl mx-auto px-6 py-3 flex items-center justify-between">
          <button
            onClick={() => setDate(d => addDays(d, -1))}
            className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-800 transition px-2 py-1 rounded hover:bg-gray-100"
          >
            ← 전일
          </button>

          <div className="text-center">
            <span className="text-sm font-semibold text-gray-800">{formatKSTDate(date)}</span>
            {isToday && <span className="ml-2 text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">오늘</span>}
          </div>

          <button
            onClick={() => setDate(d => addDays(d, 1))}
            disabled={isToday}
            className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-800 transition px-2 py-1 rounded hover:bg-gray-100 disabled:opacity-30 disabled:cursor-default"
          >
            익일 →
          </button>
        </div>
      </div>

      {/* Briefing sections */}
      <main className="max-w-3xl mx-auto px-6 py-8 space-y-6">
        {loading ? (
          <div className="text-center py-16 text-gray-400 text-sm">브리핑 불러오는 중...</div>
        ) : (
          SLOTS.map(({ key, en, accent, badge }) => {
            const b = bySlot[key]
            return (
              <section key={key} className={`bg-white rounded-xl border-l-4 ${accent} shadow-sm overflow-hidden`}>
                <div className="p-6">
                  <div className="flex items-start justify-between mb-5 gap-3">
                    <div>
                      <span className={`inline-block text-xs font-semibold px-2 py-0.5 rounded-full ${badge} mb-1`}>{en}</span>
                      <h2 className="text-lg font-bold text-gray-900">{key} 브리핑</h2>
                    </div>
                    <div className="flex items-center gap-2 shrink-0 pt-1">
                      {b && <CopyButton text={b.content} />}
                      {b ? (
                        <span className="text-xs text-gray-400">
                          {new Date(b.created_at).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })} · {b.item_count}건
                        </span>
                      ) : (
                        <span className="text-xs text-gray-300">미게시</span>
                      )}
                    </div>
                  </div>
                  {b ? (
                    <BriefingContent content={b.content} />
                  ) : (
                    <div className="text-sm text-gray-400 bg-gray-50 rounded-lg p-8 text-center">
                      {isToday ? `${key} 브리핑이 아직 생성되지 않았습니다.` : `${key} 브리핑이 없습니다.`}
                    </div>
                  )}
                </div>
              </section>
            )
          })
        )}
      </main>

      {/* Footer */}
      <footer className="max-w-3xl mx-auto px-6 py-8 border-t">
        <p className="text-xs text-gray-400 text-center">⚠️ 본 브리핑은 AI 생성 분석 결과로, 투자 추천이 아닙니다.</p>
        <p className="text-center mt-3">
          <Link href="/admin" className="text-xs text-gray-300 hover:text-gray-500 transition">관리자</Link>
        </p>
      </footer>
    </div>
  )
}
