'use client'

import { useState, useCallback } from 'react'
import Link from 'next/link'
import type { MacroCritiqueResult, WatchItem } from '@/lib/models'

// ── Regime config ─────────────────────────────────────────────────────────────
const REGIME_CONFIG = {
  risk_on:     { label: 'Risk-On',     bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200', dot: 'bg-emerald-500' },
  risk_off:    { label: 'Risk-Off',    bg: 'bg-red-50',     text: 'text-red-700',     border: 'border-red-200',     dot: 'bg-red-500'     },
  neutral:     { label: 'Neutral',     bg: 'bg-gray-50',    text: 'text-gray-600',    border: 'border-gray-200',    dot: 'bg-gray-400'    },
  rotational:  { label: 'Rotational',  bg: 'bg-amber-50',   text: 'text-amber-700',   border: 'border-amber-200',   dot: 'bg-amber-500'   },
} as const

const ALIGNMENT_CONFIG = {
  tailwind: { label: '순풍', bg: 'bg-emerald-100', text: 'text-emerald-700' },
  headwind: { label: '역풍', bg: 'bg-red-100',     text: 'text-red-700'    },
  neutral:  { label: '중립', bg: 'bg-gray-100',    text: 'text-gray-500'   },
} as const

const PRIORITY_CONFIG = {
  high:   { label: '주요', bg: 'bg-red-100',   text: 'text-red-700'   },
  medium: { label: '참고', bg: 'bg-amber-100', text: 'text-amber-700' },
} as const

const SIGNAL_CONFIG = {
  breakout:     { label: '돌파',   icon: '↑' },
  reversal:     { label: '반전',   icon: '⇄' },
  confirmation: { label: '확인',   icon: '✓' },
  risk:         { label: '리스크', icon: '⚠' },
} as const

// ── Sub-components ────────────────────────────────────────────────────────────

function RegimeBadge({ regime }: { regime: MacroCritiqueResult['market_regime'] }) {
  const cfg = REGIME_CONFIG[regime]
  return (
    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-semibold border ${cfg.bg} ${cfg.text} ${cfg.border}`}>
      <span className={`w-2 h-2 rounded-full ${cfg.dot}`} />
      {cfg.label}
    </span>
  )
}

function ConfidenceBar({ value }: { value: number }) {
  const pct = Math.round(value * 100)
  const color = pct >= 70 ? 'bg-emerald-500' : pct >= 50 ? 'bg-amber-500' : 'bg-red-400'
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-24 bg-gray-200 rounded-full overflow-hidden">
        <div className={`h-full ${color} rounded-full`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs text-gray-500">{pct}%</span>
    </div>
  )
}

function WatchCard({ item }: { item: WatchItem }) {
  const priority = PRIORITY_CONFIG[item.priority]
  const signal = SIGNAL_CONFIG[item.signal_type]
  return (
    <div className="bg-white border rounded-lg p-4 space-y-2">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="font-mono text-sm font-semibold text-gray-900">{item.target}</span>
          <span className="text-xs text-gray-400">{item.target_type === 'sector' ? '섹터' : '종목'}</span>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${priority.bg} ${priority.text}`}>{priority.label}</span>
          <span className="text-xs text-gray-400">{signal.icon} {signal.label}</span>
        </div>
      </div>
      <p className="text-sm text-gray-600 leading-relaxed">{item.reason}</p>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="text-xs font-bold text-gray-400 tracking-widest uppercase">{title}</h2>
      {children}
    </section>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function MacroPage() {
  const [result, setResult] = useState<MacroCritiqueResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [provider, setProvider] = useState<'anthropic' | 'openai'>('anthropic')

  const runAnalysis = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/macro/critique', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider, tier: 'high' }),
      })
      if (!res.ok) {
        const { error: msg } = await res.json().catch(() => ({ error: `HTTP ${res.status}` }))
        throw new Error(msg)
      }
      const data: MacroCritiqueResult = await res.json()
      setResult(data)
    } catch (e) {
      setError(String(e))
    } finally {
      setLoading(false)
    }
  }, [provider])

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b">
        <div className="max-w-3xl mx-auto px-6 py-6">
          <div className="flex items-end justify-between">
            <div>
              <p className="text-xs font-semibold text-gray-400 tracking-widest uppercase mb-1">AlphaResearch</p>
              <h1 className="text-2xl font-bold text-gray-900 tracking-tight">매크로 전략 뷰</h1>
              <p className="text-sm text-gray-500 mt-0.5">워런버핏 시각의 시장 종합 분석</p>
            </div>
            <Link href="/" className="text-sm text-gray-400 hover:text-gray-600 transition">
              ← 브리핑
            </Link>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-8 space-y-8">
        {/* Run controls */}
        <div className="bg-white rounded-xl border p-5 flex items-center justify-between gap-4">
          <div className="space-y-1">
            <p className="text-sm font-medium text-gray-800">실시간 매크로 분석 실행</p>
            <p className="text-xs text-gray-400">Yahoo Finance + FMP + CNN RSS를 종합해 워런버핏 에이전트가 분석합니다.</p>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <select
              value={provider}
              onChange={e => setProvider(e.target.value as 'anthropic' | 'openai')}
              className="text-xs border rounded px-2 py-1.5 text-gray-600 bg-white"
            >
              <option value="anthropic">Claude (Opus)</option>
              <option value="openai">GPT</option>
            </select>
            <button
              onClick={runAnalysis}
              disabled={loading}
              className="px-4 py-2 bg-gray-900 text-white text-sm font-medium rounded-lg hover:bg-gray-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? '분석 중...' : '분석 실행'}
            </button>
          </div>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-sm text-red-700">{error}</div>
        )}

        {loading && (
          <div className="text-center py-16 text-gray-400 space-y-2">
            <div className="text-2xl animate-pulse">◎</div>
            <p className="text-sm">매크로 데이터 수집 및 분석 중...</p>
            <p className="text-xs text-gray-300">Yahoo Finance · FMP · CNN RSS 조회 후 WB 에이전트 실행</p>
          </div>
        )}

        {result && !loading && (
          <>
            {/* Regime + confidence */}
            <div className="bg-white rounded-xl border p-5 flex items-center justify-between">
              <div className="space-y-2">
                <p className="text-xs text-gray-400 font-medium uppercase tracking-wide">장세 판단</p>
                <RegimeBadge regime={result.market_regime} />
                <p className="text-sm text-gray-600 max-w-sm">{result.regime_rationale}</p>
              </div>
              <div className="text-right space-y-1 shrink-0">
                <p className="text-xs text-gray-400">신뢰도</p>
                <ConfidenceBar value={result.confidence} />
                <p className="text-xs text-gray-300">{result.week_start} 기준</p>
              </div>
            </div>

            {/* Key insight */}
            <div className="bg-gray-900 text-white rounded-xl p-6 space-y-3">
              <p className="text-xs font-semibold text-gray-400 tracking-widest uppercase">핵심 인사이트</p>
              <blockquote className="text-base leading-relaxed font-medium">{result.key_insight}</blockquote>
            </div>

            {/* Leading / Lagging */}
            <div className="grid grid-cols-2 gap-4">
              <Section title="주도 섹터">
                <div className="space-y-2">
                  {result.leading_sectors.length === 0 ? (
                    <p className="text-sm text-gray-400 bg-white border rounded-lg p-4">데이터 없음</p>
                  ) : result.leading_sectors.map((s, i) => (
                    <div key={i} className="bg-white border rounded-lg p-3 space-y-1">
                      <span className="inline-flex items-center gap-1 text-sm font-semibold text-emerald-700">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                        {s.sector}
                      </span>
                      <p className="text-xs text-gray-500 leading-relaxed">{s.reason}</p>
                    </div>
                  ))}
                </div>
              </Section>

              <Section title="부진 섹터">
                <div className="space-y-2">
                  {result.lagging_sectors.length === 0 ? (
                    <p className="text-sm text-gray-400 bg-white border rounded-lg p-4">데이터 없음</p>
                  ) : result.lagging_sectors.map((s, i) => (
                    <div key={i} className="bg-white border rounded-lg p-3 space-y-1">
                      <span className="inline-flex items-center gap-1 text-sm font-semibold text-red-600">
                        <span className="w-1.5 h-1.5 rounded-full bg-red-400" />
                        {s.sector}
                      </span>
                      <p className="text-xs text-gray-500 leading-relaxed">{s.reason}</p>
                    </div>
                  ))}
                </div>
              </Section>
            </div>

            {/* Rotation signal */}
            {result.rotation_signal && (
              <Section title="로테이션 신호">
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                  <p className="text-sm text-amber-800 leading-relaxed">{result.rotation_signal}</p>
                </div>
              </Section>
            )}

            {/* Macro alignment */}
            {Object.keys(result.macro_alignment).length > 0 && (
              <Section title="섹터별 매크로 정합성">
                <div className="bg-white border rounded-xl p-4">
                  <div className="flex flex-wrap gap-2">
                    {Object.entries(result.macro_alignment).map(([sector, alignment]) => {
                      const cfg = ALIGNMENT_CONFIG[alignment as keyof typeof ALIGNMENT_CONFIG] ?? ALIGNMENT_CONFIG.neutral
                      return (
                        <div key={sector} className="flex items-center gap-1.5 border rounded-full px-3 py-1">
                          <span className="text-sm text-gray-700">{sector}</span>
                          <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${cfg.bg} ${cfg.text}`}>{cfg.label}</span>
                        </div>
                      )
                    })}
                  </div>
                </div>
              </Section>
            )}

            {/* Watch list */}
            <Section title={`Watch List (${result.watch_list.length})`}>
              <div className="space-y-3">
                {result.watch_list.map((item, i) => <WatchCard key={i} item={item} />)}
              </div>
            </Section>

            {/* Contrarian view */}
            {result.contrarian_view && (
              <Section title="역발상 시각">
                <div className="bg-violet-50 border border-violet-200 rounded-lg p-4">
                  <p className="text-sm text-violet-800 leading-relaxed">{result.contrarian_view}</p>
                </div>
              </Section>
            )}

            {/* Next week agenda */}
            <Section title="다음 주 체크포인트">
              <div className="bg-white border rounded-xl p-4">
                <ol className="space-y-2">
                  {result.next_week_agenda.map((item, i) => (
                    <li key={i} className="flex items-start gap-3 text-sm text-gray-700">
                      <span className="shrink-0 w-5 h-5 rounded-full bg-gray-100 text-gray-500 text-xs flex items-center justify-center font-medium mt-0.5">{i + 1}</span>
                      {item}
                    </li>
                  ))}
                </ol>
              </div>
            </Section>

            {/* Meta */}
            <p className="text-xs text-gray-300 text-center pb-4">
              provider: {result.provider} · latency: {result.latency_ms ? `${(result.latency_ms / 1000).toFixed(1)}s` : '-'} · cost: {result.cost_usd ? `$${result.cost_usd.toFixed(4)}` : '-'}
            </p>
          </>
        )}
      </main>

      <footer className="max-w-3xl mx-auto px-6 py-8 border-t">
        <p className="text-xs text-gray-400 text-center">⚠️ 본 분석은 AI 생성 결과로, 투자 추천이 아닙니다.</p>
      </footer>
    </div>
  )
}
