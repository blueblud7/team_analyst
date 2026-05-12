'use client'

import { useState, useEffect, useCallback } from 'react'
import type { TaggedEvent, ProviderName, CompareResult, ScoreRow } from '@/lib/models'
import { PROVIDER_CONFIG } from '@/lib/config'
import { SAMPLES } from '@/lib/samples'

const PROVIDER_NAMES = Object.keys(PROVIDER_CONFIG) as ProviderName[]
const TAGGER_CRITERIA = [
  { key: 'ticker_accuracy', label: 'Ticker 정확도', max: 5 },
  { key: 'json_valid', label: 'JSON 스키마 준수', max: 5 },
  { key: 'key_claims_quality', label: 'Key Claims 추출', max: 5 },
]
const SENTIMENT_CRITERIA = [
  { key: 'sentiment_accuracy', label: 'Sentiment 정확도', max: 5 },
  { key: 'conviction_nuance', label: 'Conviction Nuance', max: 5 },
]

function sentimentColor(score: number | null) {
  if (score === null) return 'text-gray-400'
  if (score >= 0.5) return 'text-green-600 font-bold'
  if (score >= 0.1) return 'text-green-500'
  if (score <= -0.5) return 'text-red-600 font-bold'
  if (score <= -0.1) return 'text-red-500'
  return 'text-gray-600'
}

function badge(label: string | null) {
  if (!label) return null
  const colors: Record<string, string> = {
    very_positive: 'bg-green-100 text-green-800',
    positive: 'bg-green-50 text-green-700',
    neutral: 'bg-gray-100 text-gray-700',
    negative: 'bg-red-50 text-red-700',
    very_negative: 'bg-red-100 text-red-800',
  }
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full ${colors[label] ?? 'bg-gray-100'}`}>
      {label}
    </span>
  )
}

// ── Run Panel ──────────────────────────────────────────────────────────────────

function RunPanel() {
  const [selectedProviders, setSelectedProviders] = useState<ProviderName[]>(
    PROVIDER_NAMES.filter(p => PROVIDER_CONFIG[p].enabled)
  )
  const [task, setTask] = useState<'tagger' | 'sentiment'>('tagger')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<CompareResult | null>(null)
  const [activeProvider, setActiveProvider] = useState<string | null>(null)
  const [sampleIdx, setSampleIdx] = useState(0)

  function toggleProvider(p: ProviderName) {
    setSelectedProviders(prev =>
      prev.includes(p) ? prev.filter(x => x !== p) : [...prev, p]
    )
  }

  async function runCompare() {
    if (!selectedProviders.length) return
    setLoading(true)
    setError(null)
    setResult(null)
    try {
      const res = await fetch('/api/compare', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ providers: selectedProviders, task }),
      })
      if (!res.ok) throw new Error(await res.text())
      const data = await res.json()
      setResult(data)
      const firstProvider = Object.keys(data.results)[0]
      setActiveProvider(firstProvider ?? null)

      // save to localStorage for scoring tab
      localStorage.setItem('compareResult', JSON.stringify(data))
    } catch (e) {
      setError(String(e))
    } finally {
      setLoading(false)
    }
  }

  const events: TaggedEvent[] = activeProvider ? (result?.results[activeProvider as ProviderName] ?? []) : []
  const ev = events[sampleIdx]

  return (
    <div className="space-y-6">
      {/* Controls */}
      <div className="bg-white rounded-xl border p-5 space-y-4">
        <h2 className="font-semibold text-gray-800">실험 설정</h2>

        <div>
          <p className="text-sm text-gray-500 mb-2">Task</p>
          <div className="flex gap-3">
            {(['tagger', 'sentiment'] as const).map(t => (
              <button
                key={t}
                onClick={() => setTask(t)}
                className={`px-4 py-1.5 rounded-lg text-sm font-medium border transition ${
                  task === t
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'text-gray-600 border-gray-300 hover:border-blue-400'
                }`}
              >
                {t === 'tagger' ? 'Tagger (tag only)' : 'Tagger + Sentiment'}
              </button>
            ))}
          </div>
        </div>

        <div>
          <p className="text-sm text-gray-500 mb-2">LLM 프로바이더 (API 키 설정된 것만)</p>
          <div className="flex flex-wrap gap-2">
            {PROVIDER_NAMES.map(p => {
              const selected = selectedProviders.includes(p)
              const enabled = PROVIDER_CONFIG[p].enabled
              return (
                <button
                  key={p}
                  onClick={() => toggleProvider(p)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition ${
                    selected
                      ? 'bg-indigo-600 text-white border-indigo-600'
                      : enabled
                      ? 'text-gray-700 border-gray-300 hover:border-indigo-400'
                      : 'text-gray-400 border-gray-200 cursor-default'
                  }`}
                  disabled={!enabled && !selected}
                  title={PROVIDER_CONFIG[p].notes}
                >
                  {p}
                  {!enabled && <span className="ml-1 text-xs">(disabled)</span>}
                </button>
              )
            })}
          </div>
        </div>

        <div>
          <p className="text-sm text-gray-500 mb-1">샘플: {SAMPLES.length}개 (data/samples/)</p>
        </div>

        <button
          onClick={runCompare}
          disabled={loading || !selectedProviders.length}
          className="px-6 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
        >
          {loading ? '실행 중...' : '실험 실행 →'}
        </button>

        {error && (
          <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg p-3">
            {error}
          </div>
        )}
      </div>

      {/* Results */}
      {result && (
        <>
          {/* Cost summary */}
          <div className="bg-white rounded-xl border p-5">
            <h2 className="font-semibold text-gray-800 mb-3">비용 요약</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-gray-500 border-b">
                    <th className="pb-2 pr-4">Provider</th>
                    <th className="pb-2 pr-4">총 비용</th>
                    <th className="pb-2 pr-4">성공</th>
                    <th className="pb-2">실패</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(result.cost_summary).map(([p, s]) => (
                    <tr key={p} className="border-b last:border-0">
                      <td className="py-2 pr-4 font-medium">{p}</td>
                      <td className="py-2 pr-4">${s.total_usd.toFixed(4)}</td>
                      <td className="py-2 pr-4 text-green-600">{s.ok}</td>
                      <td className="py-2 text-red-500">{s.fail}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Event viewer */}
          <div className="bg-white rounded-xl border p-5 space-y-4">
            <div className="flex items-center gap-3">
              <h2 className="font-semibold text-gray-800">결과 뷰어</h2>
              <div className="flex gap-1">
                {Object.keys(result.results).map(p => (
                  <button
                    key={p}
                    onClick={() => { setActiveProvider(p); setSampleIdx(0) }}
                    className={`px-3 py-1 rounded text-xs font-medium border transition ${
                      activeProvider === p
                        ? 'bg-gray-800 text-white border-gray-800'
                        : 'text-gray-600 border-gray-300 hover:border-gray-500'
                    }`}
                  >
                    {p}
                  </button>
                ))}
              </div>
              <div className="ml-auto flex items-center gap-2 text-sm">
                <button
                  onClick={() => setSampleIdx(i => Math.max(0, i - 1))}
                  disabled={sampleIdx === 0}
                  className="px-2 py-1 border rounded disabled:opacity-40"
                >
                  ‹
                </button>
                <span className="text-gray-600">{sampleIdx + 1} / {events.length}</span>
                <button
                  onClick={() => setSampleIdx(i => Math.min(events.length - 1, i + 1))}
                  disabled={sampleIdx >= events.length - 1}
                  className="px-2 py-1 border rounded disabled:opacity-40"
                >
                  ›
                </button>
              </div>
            </div>

            {ev && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-gray-400 mb-1">원문 요약</p>
                  <div className="bg-gray-50 rounded-lg p-3 text-sm text-gray-700 whitespace-pre-wrap max-h-48 overflow-y-auto">
                    {ev.raw_summary}
                  </div>
                </div>
                <div className="space-y-2 text-sm">
                  <div className="flex flex-wrap gap-1">
                    {ev.tickers.map(t => (
                      <span key={t} className="bg-blue-100 text-blue-800 px-2 py-0.5 rounded text-xs font-mono">{t}</span>
                    ))}
                    {ev.sectors.map(s => (
                      <span key={s} className="bg-purple-100 text-purple-700 px-2 py-0.5 rounded text-xs">{s}</span>
                    ))}
                    <span className="bg-gray-100 text-gray-600 px-2 py-0.5 rounded text-xs">{ev.event_type}</span>
                  </div>
                  <div>
                    <p className="text-xs text-gray-400 mb-1">Key Claims</p>
                    <ul className="space-y-1">
                      {ev.key_claims.map((c, i) => (
                        <li key={i} className="text-gray-700 text-xs flex gap-1">
                          <span className="text-gray-400">·</span> {c}
                        </li>
                      ))}
                    </ul>
                  </div>
                  {ev.sentiment_score !== null && (
                    <div className="flex items-center gap-3">
                      <span className={`text-lg font-bold ${sentimentColor(ev.sentiment_score)}`}>
                        {ev.sentiment_score.toFixed(2)}
                      </span>
                      {badge(ev.sentiment_label)}
                      <span className="text-gray-500 text-xs">conviction: {ev.conviction?.toFixed(2)}</span>
                    </div>
                  )}
                  <div className="text-xs text-gray-400 flex gap-3">
                    <span>{ev.latency_ms}ms</span>
                    <span>${ev.cost_usd?.toFixed(5)}</span>
                    {ev.parse_error && <span className="text-red-500">parse error</span>}
                  </div>
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}

// ── Scoring Panel ─────────────────────────────────────────────────────────────

function ScoringPanel() {
  const [result, setResult] = useState<CompareResult | null>(null)
  const [masked, setMasked] = useState<Record<string, TaggedEvent[]>>({})
  const [mapping, setMapping] = useState<Record<string, string>>({})
  const [idx, setIdx] = useState(0)
  const [sampleIdx, setSampleIdx] = useState(0)
  const [scores, setScores] = useState<Record<string, number>>({})
  const [savedScores, setSavedScores] = useState<ScoreRow[]>([])
  const [task, setTask] = useState<'tagger' | 'sentiment'>('tagger')

  useEffect(() => {
    const raw = localStorage.getItem('compareResult')
    if (raw) {
      const r: CompareResult = JSON.parse(raw)
      setResult(r)
      setTask(r.task)
      setupMasked(r.results)
    }
    const ss = localStorage.getItem('scores')
    if (ss) setSavedScores(JSON.parse(ss))
  }, [])

  function setupMasked(results: Record<string, TaggedEvent[]>) {
    const entries = Object.entries(results)
    const shuffled = [...entries].sort(() => Math.random() - 0.5)
    const m: Record<string, TaggedEvent[]> = {}
    const mp: Record<string, string> = {}
    shuffled.forEach(([provider, events], i) => {
      const label = String.fromCharCode(65 + i)
      m[label] = events
      mp[label] = provider
    })
    setMasked(m)
    setMapping(mp)
    setIdx(0)
  }

  function saveScore() {
    const labels = Object.keys(masked)
    const label = labels[idx % labels.length]
    const row: ScoreRow = {
      task,
      provider: label,
      sample_idx: sampleIdx,
      scores: { ...scores },
      created_at: new Date().toISOString(),
    }
    const next = [...savedScores, row]
    setSavedScores(next)
    localStorage.setItem('scores', JSON.stringify(next))
    setIdx(i => i + 1)
    setSampleIdx(0)
    setScores({})
  }

  const criteria = task === 'tagger' ? TAGGER_CRITERIA : SENTIMENT_CRITERIA
  const labels = Object.keys(masked)
  const label = labels.length ? labels[idx % labels.length] : null
  const events = label ? masked[label] : []
  const ev = events[sampleIdx]

  if (!result) {
    return (
      <div className="bg-white rounded-xl border p-8 text-center text-gray-500">
        <p>실험 실행 탭에서 먼저 비교 실험을 실행하세요.</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl border p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-gray-800">
            블라인드 채점 — Provider <span className="text-blue-600">{label}</span>
          </h2>
          <div className="flex items-center gap-2 text-sm">
            <button
              onClick={() => setSampleIdx(i => Math.max(0, i - 1))}
              disabled={sampleIdx === 0}
              className="px-2 py-1 border rounded disabled:opacity-40"
            >‹</button>
            <span className="text-gray-600">{sampleIdx + 1} / {events.length}</span>
            <button
              onClick={() => setSampleIdx(i => Math.min(events.length - 1, i + 1))}
              disabled={sampleIdx >= events.length - 1}
              className="px-2 py-1 border rounded disabled:opacity-40"
            >›</button>
          </div>
        </div>

        {ev && (
          <div className="space-y-3">
            <div>
              <p className="text-xs text-gray-400 mb-1">원문 요약</p>
              <div className="bg-gray-50 rounded-lg p-3 text-sm text-gray-700 whitespace-pre-wrap max-h-36 overflow-y-auto">
                {ev.raw_summary}
              </div>
            </div>
            <div>
              <p className="text-xs text-gray-400 mb-1">LLM 출력</p>
              <div className="bg-gray-50 rounded-lg p-3 text-xs font-mono space-y-1">
                <div><span className="text-gray-400">tickers:</span> {ev.tickers.join(', ') || '—'}</div>
                <div><span className="text-gray-400">sectors:</span> {ev.sectors.join(', ') || '—'}</div>
                <div><span className="text-gray-400">event_type:</span> {ev.event_type}</div>
                <div><span className="text-gray-400">key_claims:</span></div>
                {ev.key_claims.map((c, i) => <div key={i} className="pl-4">· {c}</div>)}
                {ev.sentiment_score !== null && (
                  <>
                    <div><span className="text-gray-400">sentiment_score:</span> {ev.sentiment_score.toFixed(3)}</div>
                    <div><span className="text-gray-400">sentiment_label:</span> {ev.sentiment_label}</div>
                    <div><span className="text-gray-400">conviction:</span> {ev.conviction?.toFixed(3)}</div>
                  </>
                )}
                {ev.parse_error && <div className="text-red-500">parse_error: {ev.parse_error}</div>}
              </div>
            </div>
          </div>
        )}

        <div className="space-y-3 pt-2">
          {criteria.map(c => (
            <div key={c.key} className="flex items-center gap-3">
              <span className="text-sm text-gray-700 w-40 shrink-0">{c.label}</span>
              <input
                type="range"
                min={1}
                max={c.max}
                value={scores[c.key] ?? Math.ceil(c.max / 2)}
                onChange={e => setScores(prev => ({ ...prev, [c.key]: Number(e.target.value) }))}
                className="flex-1"
              />
              <span className="w-8 text-center text-sm font-medium text-blue-700">
                {scores[c.key] ?? Math.ceil(c.max / 2)}
              </span>
            </div>
          ))}
        </div>

        <button
          onClick={saveScore}
          className="px-5 py-2 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 transition"
        >
          채점 저장 → 다음 Provider
        </button>
      </div>

      {/* Reveal key */}
      <details className="bg-white rounded-xl border p-4">
        <summary className="cursor-pointer text-sm text-gray-500">채점 키 확인 (제출 후)</summary>
        <pre className="mt-3 text-xs bg-gray-50 p-3 rounded">{JSON.stringify(mapping, null, 2)}</pre>
      </details>

      {/* Score table */}
      {savedScores.length > 0 && (
        <div className="bg-white rounded-xl border p-5">
          <h3 className="font-semibold text-gray-800 mb-3">저장된 채점 ({savedScores.length}건)</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-left text-gray-400 border-b">
                  <th className="pb-2 pr-3">Provider</th>
                  <th className="pb-2 pr-3">Task</th>
                  {savedScores[0] && Object.keys(savedScores[0].scores).map(k => (
                    <th key={k} className="pb-2 pr-3">{k}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {savedScores.map((r, i) => (
                  <tr key={i} className="border-b last:border-0">
                    <td className="py-1.5 pr-3 font-medium">{mapping[r.provider] ?? r.provider}</td>
                    <td className="py-1.5 pr-3 text-gray-500">{r.task}</td>
                    {Object.values(r.scores).map((v, j) => (
                      <td key={j} className="py-1.5 pr-3">{v}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <button
            onClick={() => { setSavedScores([]); localStorage.removeItem('scores') }}
            className="mt-3 text-xs text-red-500 hover:underline"
          >
            채점 초기화
          </button>
        </div>
      )}
    </div>
  )
}

// ── Matrix Panel ──────────────────────────────────────────────────────────────

function MatrixPanel() {
  const [result, setResult] = useState<CompareResult | null>(null)
  const [scores, setScores] = useState<ScoreRow[]>([])

  useEffect(() => {
    const r = localStorage.getItem('compareResult')
    if (r) setResult(JSON.parse(r))
    const s = localStorage.getItem('scores')
    if (s) setScores(JSON.parse(s))
  }, [])

  if (!result) {
    return (
      <div className="bg-white rounded-xl border p-8 text-center text-gray-500">
        실험 실행 탭에서 먼저 비교 실험을 실행하세요.
      </div>
    )
  }

  const providers = Object.keys(result.results) as ProviderName[]

  // avg score per provider
  const scoreMap: Record<string, number | null> = {}
  if (scores.length) {
    providers.forEach(p => {
      const rows = scores.filter(r => r.provider === p || r.provider === p[0])
      if (!rows.length) { scoreMap[p] = null; return }
      const vals = rows.flatMap(r => Object.values(r.scores))
      scoreMap[p] = vals.reduce((a, b) => a + b, 0) / vals.length
    })
  }

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl border p-5">
        <h2 className="font-semibold text-gray-800 mb-4">비용 / 품질 매트릭스</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-500 border-b">
                <th className="pb-2 pr-4">Provider</th>
                <th className="pb-2 pr-4">총 비용 (USD)</th>
                <th className="pb-2 pr-4">성공률</th>
                <th className="pb-2 pr-4">평균 latency</th>
                <th className="pb-2">품질 점수</th>
              </tr>
            </thead>
            <tbody>
              {providers.map(p => {
                const events = result.results[p]
                const cs = result.cost_summary[p]
                const total = events.length
                const successRate = total ? ((cs.ok / total) * 100).toFixed(0) : '—'
                const avgLatency = total
                  ? Math.round(events.reduce((s, e) => s + (e.latency_ms ?? 0), 0) / total)
                  : null

                return (
                  <tr key={p} className="border-b last:border-0">
                    <td className="py-2.5 pr-4 font-medium">{p}</td>
                    <td className="py-2.5 pr-4">${cs.total_usd.toFixed(4)}</td>
                    <td className="py-2.5 pr-4">{successRate}%</td>
                    <td className="py-2.5 pr-4">{avgLatency ? `${avgLatency}ms` : '—'}</td>
                    <td className="py-2.5">{scoreMap[p] != null ? scoreMap[p]!.toFixed(1) : '—'}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div className="bg-white rounded-xl border p-5">
        <h3 className="font-semibold text-gray-800 mb-3">Provider별 샘플 상세</h3>
        <div className="space-y-2">
          {providers.map(p => {
            const events = result.results[p]
            return (
              <details key={p}>
                <summary className="cursor-pointer text-sm font-medium text-gray-700 py-1">
                  {p} ({events.length}개)
                </summary>
                <div className="mt-2 overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="text-gray-400 text-left border-b">
                        <th className="pb-1 pr-3">#</th>
                        <th className="pb-1 pr-3">채널</th>
                        <th className="pb-1 pr-3">tickers</th>
                        <th className="pb-1 pr-3">event_type</th>
                        <th className="pb-1 pr-3">sentiment</th>
                        <th className="pb-1 pr-3">conviction</th>
                        <th className="pb-1">latency</th>
                      </tr>
                    </thead>
                    <tbody>
                      {events.map((e, i) => (
                        <tr key={i} className="border-b last:border-0">
                          <td className="py-1 pr-3 text-gray-400">{i + 1}</td>
                          <td className="py-1 pr-3">{e.source_channel.slice(0, 12)}</td>
                          <td className="py-1 pr-3">{e.tickers.join(', ') || '—'}</td>
                          <td className="py-1 pr-3">{e.event_type}</td>
                          <td className={`py-1 pr-3 ${sentimentColor(e.sentiment_score)}`}>
                            {e.sentiment_score?.toFixed(2) ?? '—'}
                          </td>
                          <td className="py-1 pr-3">{e.conviction?.toFixed(2) ?? '—'}</td>
                          <td className="py-1">{e.latency_ms}ms</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </details>
            )
          })}
        </div>
      </div>
    </div>
  )
}

// ── Root Dashboard ─────────────────────────────────────────────────────────────

export default function Dashboard() {
  const [tab, setTab] = useState<'run' | 'score' | 'matrix'>('run')

  const tabs = [
    { key: 'run' as const, label: '실험 실행' },
    { key: 'score' as const, label: '블라인드 채점' },
    { key: 'matrix' as const, label: '비용/품질 매트릭스' },
  ]

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b px-6 py-4">
        <h1 className="text-xl font-bold text-gray-900">윤센이 PoC — AI 애널리스트 평가 대시보드</h1>
        <p className="text-sm text-gray-500 mt-0.5">5개 LLM 프로바이더 블라인드 비교 실험</p>
      </header>

      <div className="px-6 pt-5">
        <div className="flex gap-1 bg-gray-100 p-1 rounded-lg w-fit">
          {tabs.map(t => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`px-4 py-1.5 rounded-md text-sm font-medium transition ${
                tab === t.key
                  ? 'bg-white shadow text-gray-900'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <main className="px-6 py-5 max-w-5xl">
        {tab === 'run' && <RunPanel />}
        {tab === 'score' && <ScoringPanel />}
        {tab === 'matrix' && <MatrixPanel />}
      </main>
    </div>
  )
}
