'use client'

import { useState, useEffect } from 'react'
import type { TaggedEvent, ProviderName, CompareResult, ScoreRow } from '@/lib/models'
import { PROVIDER_CONFIG } from '@/lib/config'
import { SAMPLES } from '@/lib/samples'
import type { NewsItem } from '@/app/api/news/route'

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

function RunPanel({ newsItems }: { newsItems: NewsItem[] }) {
  const [selectedProviders, setSelectedProviders] = useState<ProviderName[]>(
    PROVIDER_NAMES.filter(p => PROVIDER_CONFIG[p].enabled)
  )
  const [task, setTask] = useState<'tagger' | 'sentiment'>('tagger')
  const [useNewsItems, setUseNewsItems] = useState(false)
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
      const body: Record<string, unknown> = { providers: selectedProviders, task }
      if (useNewsItems && newsItems.length > 0) {
        body.items = newsItems.map(n => ({
          source_channel: n.source_channel,
          raw_summary: n.raw_summary,
          source_url: n.source_url,
        }))
      }
      const res = await fetch('/api/compare', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) throw new Error(await res.text())
      const data = await res.json()
      setResult(data)
      const firstProvider = Object.keys(data.results)[0]
      setActiveProvider(firstProvider ?? null)
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
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={useNewsItems}
              onChange={e => setUseNewsItems(e.target.checked)}
              disabled={newsItems.length === 0}
              className="rounded"
            />
            <span className="text-sm text-gray-700">
              수집된 뉴스 사용
              {newsItems.length > 0
                ? <span className="ml-1 text-blue-600 font-medium">({newsItems.length}건)</span>
                : <span className="ml-1 text-gray-400">(뉴스 수집 탭에서 먼저 가져오세요)</span>
              }
            </span>
          </label>
          {!useNewsItems && (
            <p className="text-xs text-gray-400 mt-1 ml-6">내장 샘플 {SAMPLES.length}개 사용 중</p>
          )}
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

// ── News Panel ────────────────────────────────────────────────────────────────

const SOURCE_TYPES: Record<string, string> = {
  neon_message: '텔레그램',
  neon_summary: 'AI요약',
  dart: 'DART',
  cnn: 'CNN',
  sample: '샘플',
}

interface DbChannel { id: string; title: string; username: string | null; type: string; message_count: number }

function NewsPanel({ onNewsLoaded }: { onNewsLoaded: (items: NewsItem[]) => void }) {
  const [loading, setLoading] = useState(false)
  const [items, setItems] = useState<NewsItem[]>([])
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [dbStatus, setDbStatus] = useState<{ channels: number; messages: number; connected: boolean } | null>(null)
  const [dbChannels, setDbChannels] = useState<DbChannel[]>([])
  const [error, setError] = useState<string | null>(null)
  const [sources, setSources] = useState({ neon: true, dart: true, cnn: false })
  const [days, setDays] = useState(3)
  const [limit, setLimit] = useState(100)
  const [selectedChannels, setSelectedChannels] = useState<Set<string>>(new Set())
  const [showChannelFilter, setShowChannelFilter] = useState(false)

  // auto-check DB status on mount
  useEffect(() => {
    fetch('/api/news?sources=neon&limit=0&days=1')
      .then(r => r.json())
      .then(d => {
        setDbStatus(d.db)
        if (d.channels?.length) setDbChannels(d.channels)
      })
      .catch(() => {})
  }, [])

  async function fetchNews() {
    setLoading(true)
    setError(null)
    try {
      const active = Object.entries(sources).filter(([, v]) => v).map(([k]) => k).join(',')
      const channelParam = selectedChannels.size > 0 ? `&channels=${[...selectedChannels].join(',')}` : ''
      const res = await fetch(`/api/news?sources=${active}&days=${days}&limit=${limit}${channelParam}`)
      const data = await res.json()
      setItems(data.items ?? [])
      setDbStatus(data.db)
      if (data.channels?.length) setDbChannels(data.channels)
      setSelected(new Set((data.items ?? []).map((_: unknown, i: number) => i)))
      if (data.errors?.length) setError(data.errors.join(' | '))
    } catch (e) {
      setError(String(e))
    } finally {
      setLoading(false)
    }
  }

  function toggleItem(i: number) {
    setSelected(prev => { const n = new Set(prev); n.has(i) ? n.delete(i) : n.add(i); return n })
  }
  function toggleChannel(id: string) {
    setSelectedChannels(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n })
  }

  function sendToAnalysis() {
    onNewsLoaded(items.filter((_, i) => selected.has(i)))
  }

  const tierColors: Record<number, string> = {
    1: 'bg-indigo-100 text-indigo-700',
    2: 'bg-blue-100 text-blue-700',
    3: 'bg-gray-100 text-gray-600',
    4: 'bg-yellow-100 text-yellow-700',
  }

  return (
    <div className="space-y-5">
      {/* Controls */}
      <div className="bg-white rounded-xl border p-5 space-y-4">
        <h2 className="font-semibold text-gray-800">데이터 수집 설정</h2>

        {/* Source toggles */}
        <div className="flex flex-wrap gap-3">
          {(['neon', 'dart', 'cnn'] as const).map(k => (
            <label key={k} className={`flex items-center gap-2 px-3 py-2 rounded-lg border cursor-pointer text-sm transition ${sources[k] ? 'border-blue-400 bg-blue-50' : 'border-gray-200'}`}>
              <input type="checkbox" checked={sources[k]} onChange={e => setSources(p => ({ ...p, [k]: e.target.checked }))} />
              <span className="font-medium">{k === 'neon' ? '텔레그램 DB' : k === 'dart' ? 'DART 공시' : 'CNN RSS'}</span>
              {k === 'neon' && dbStatus?.connected && (
                <span className="text-xs text-gray-500">{dbStatus.messages.toLocaleString()}건</span>
              )}
            </label>
          ))}
        </div>

        {/* Neon filters */}
        {sources.neon && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
            <div>
              <label className="block text-xs text-gray-500 mb-1">기간</label>
              <select value={days} onChange={e => setDays(Number(e.target.value))} className="w-full border rounded px-2 py-1.5 text-sm">
                <option value={1}>최근 1일</option>
                <option value={3}>최근 3일</option>
                <option value={7}>최근 7일</option>
                <option value={14}>최근 14일</option>
                <option value={30}>최근 30일</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">최대 건수</label>
              <select value={limit} onChange={e => setLimit(Number(e.target.value))} className="w-full border rounded px-2 py-1.5 text-sm">
                <option value={50}>50건</option>
                <option value={100}>100건</option>
                <option value={200}>200건</option>
                <option value={500}>500건</option>
              </select>
            </div>
            <div className="sm:col-span-2 flex items-end">
              <button
                onClick={() => setShowChannelFilter(p => !p)}
                className="text-xs text-blue-600 hover:underline"
              >
                채널 필터 {selectedChannels.size > 0 ? `(${selectedChannels.size}개 선택)` : '(전체)'}
              </button>
            </div>
          </div>
        )}

        {/* Channel filter */}
        {showChannelFilter && dbChannels.length > 0 && (
          <div className="border rounded-lg p-3 max-h-56 overflow-y-auto space-y-1">
            <div className="flex gap-2 mb-2">
              <button onClick={() => setSelectedChannels(new Set(dbChannels.map(c => c.id)))} className="text-xs text-blue-600 hover:underline">전체선택</button>
              <button onClick={() => setSelectedChannels(new Set())} className="text-xs text-gray-500 hover:underline">전체해제</button>
            </div>
            {dbChannels.filter(c => c.message_count > 0).map(ch => (
              <label key={ch.id} className="flex items-center gap-2 text-xs cursor-pointer hover:bg-gray-50 px-1 py-0.5 rounded">
                <input type="checkbox" checked={selectedChannels.has(ch.id)} onChange={() => toggleChannel(ch.id)} />
                <span className="flex-1 truncate">{ch.title}</span>
                <span className="text-gray-400 shrink-0">{ch.message_count.toLocaleString()}건</span>
              </label>
            ))}
          </div>
        )}

        <button
          onClick={fetchNews}
          disabled={loading}
          className="px-5 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition"
        >
          {loading ? '수집 중...' : '데이터 가져오기'}
        </button>
        {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
      </div>

      {/* Items list */}
      {items.length > 0 && (
        <div className="bg-white rounded-xl border p-5">
          <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
            <h3 className="font-semibold text-gray-800">수집된 항목 <span className="text-blue-600">{items.length}건</span></h3>
            <div className="flex gap-2 items-center">
              <button onClick={() => setSelected(new Set(items.map((_, i) => i)))} className="text-xs text-blue-600 hover:underline">전체선택</button>
              <button onClick={() => setSelected(new Set())} className="text-xs text-gray-500 hover:underline">전체해제</button>
              <button
                onClick={sendToAnalysis}
                disabled={selected.size === 0}
                className="px-3 py-1.5 bg-green-600 text-white text-xs font-medium rounded-lg hover:bg-green-700 disabled:opacity-50 transition"
              >
                선택 {selected.size}건 → 브리핑 전달
              </button>
            </div>
          </div>
          <div className="space-y-1.5 max-h-[560px] overflow-y-auto pr-1">
            {items.map((item, i) => (
              <label key={i} className={`flex gap-3 p-3 rounded-lg border cursor-pointer transition ${selected.has(i) ? 'border-blue-300 bg-blue-50' : 'border-gray-100 hover:border-gray-200'}`}>
                <input type="checkbox" checked={selected.has(i)} onChange={() => toggleItem(i)} className="mt-0.5 shrink-0" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 mb-0.5 flex-wrap">
                    <span className={`text-xs px-1.5 py-0.5 rounded font-medium shrink-0 ${
                      item.source_type === 'dart' ? 'bg-blue-100 text-blue-700' :
                      item.source_type === 'cnn' ? 'bg-orange-100 text-orange-700' :
                      'bg-purple-100 text-purple-700'
                    }`}>
                      {SOURCE_TYPES[item.source_type] ?? item.source_type}
                    </span>
                    <span className="text-xs text-gray-600 font-medium truncate max-w-[200px]">{item.source_channel}</span>
                    <span className="text-xs text-gray-400 ml-auto shrink-0">
                      {new Date(item.posted_at).toLocaleString('ko-KR', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  <p className="text-xs text-gray-700 line-clamp-2 leading-relaxed">{item.raw_summary.slice(0, 180)}</p>
                </div>
              </label>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Briefing Panel ────────────────────────────────────────────────────────────

interface HistoryEntry {
  id: string
  ts: string
  provider: string
  itemCount: number
  report: string
  slot: string | null
}

const PUBLISH_SLOTS = ['장전', '장중', '장후'] as const

function renderMarkdown(text: string) {
  return text.split('\n').map((line, i) => {
    if (line.startsWith('# '))  return <h1 key={i} className="text-xl font-bold text-gray-900 mt-4 mb-2">{line.slice(2)}</h1>
    if (line.startsWith('## ')) return <h2 key={i} className="text-base font-bold text-gray-800 mt-4 mb-1 border-b pb-1">{line.slice(3)}</h2>
    if (line.startsWith('### ')) return <h3 key={i} className="text-sm font-semibold text-gray-700 mt-3 mb-1">{line.slice(4)}</h3>
    if (line === '---') return <hr key={i} className="my-3 border-gray-200" />
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
  })
}

const AUTO_SLOTS = [
  { key: 'pre',  label: '장전', time: '08:00', kstHour: 8,  desc: '전일 16시 → 08시' },
  { key: 'mid',  label: '장중', time: '12:00', kstHour: 12, desc: '08시 → 12시' },
  { key: 'post', label: '장후', time: '16:00', kstHour: 16, desc: '12시 → 16시' },
]

function TodayBriefingStatus() {
  const [status, setStatus] = useState<Record<string, string | null>>({ '장전': null, '장중': null, '장후': null })
  const [generating, setGenerating] = useState<string | null>(null)
  const [genError, setGenError] = useState<string | null>(null)

  const kstNowHour = parseInt(new Date().toLocaleString('en-US', { timeZone: 'Asia/Seoul', hour: 'numeric', hour12: false })) % 24
  const kstTodayStr = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Seoul' })

  useEffect(() => {
    fetch('/api/briefings')
      .then(r => r.json())
      .then(({ briefings = [] }) => {
        const s: Record<string, string | null> = { '장전': null, '장중': null, '장후': null }
        briefings.forEach((b: { slot: string; created_at: string }) => {
          const bKST = new Date(new Date(b.created_at).getTime() + 9 * 3600_000).toISOString().slice(0, 10)
          if (bKST === kstTodayStr) s[b.slot] = b.created_at
        })
        setStatus(s)
      })
      .catch(() => {})
  }, [kstTodayStr])

  async function generate(slotKey: string, slotLabel: string) {
    setGenerating(slotLabel)
    setGenError(null)
    try {
      const res = await fetch(`/api/cron/briefing?slot=${slotKey}`)
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? res.statusText)
      setStatus(prev => ({ ...prev, [slotLabel]: new Date().toISOString() }))
    } catch (e) {
      setGenError(String(e))
    } finally {
      setGenerating(null)
    }
  }

  return (
    <div className="bg-white rounded-xl border p-5">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold text-gray-800">오늘 자동 브리핑 현황</h3>
        <span className="text-xs text-gray-400">KST 기준 · {kstTodayStr}</span>
      </div>
      <div className="grid grid-cols-3 gap-3">
        {AUTO_SLOTS.map(slot => {
          const done = status[slot.label]
          const slotPassed = kstNowHour >= slot.kstHour

          return (
            <div key={slot.key} className={`rounded-xl border p-4 ${done ? 'border-green-200 bg-green-50' : 'border-gray-200'}`}>
              <div className="text-sm font-bold text-gray-800">{slot.label}</div>
              <div className="text-xs text-gray-400 mt-0.5">{slot.time} · {slot.desc}</div>
              {done ? (
                <div className="text-xs text-green-700 mt-3 font-medium">
                  ✓ {new Date(new Date(done).getTime() + 9*3600_000)
                    .toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })} 게시
                </div>
              ) : (
                <button
                  onClick={() => generate(slot.key, slot.label)}
                  disabled={!!generating || !slotPassed}
                  className={`mt-3 w-full text-xs py-1.5 rounded-lg border font-medium transition ${
                    !slotPassed
                      ? 'border-gray-200 text-gray-300 cursor-default'
                      : generating === slot.label
                      ? 'border-blue-300 text-blue-500 bg-blue-50'
                      : 'border-gray-300 text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  {!slotPassed ? `${slot.time} 자동 예정` : generating === slot.label ? '생성 중...' : '지금 생성'}
                </button>
              )}
            </div>
          )
        })}
      </div>
      {genError && <p className="text-xs text-red-500 mt-2">{genError}</p>}
      <p className="text-xs text-gray-400 mt-3">각 슬롯은 해당 시간대 뉴스만 수집해 자동 브리핑을 생성합니다. 매일 Vercel Cron으로 자동 실행.</p>
    </div>
  )
}

function BriefingPanel({ newsItems }: { newsItems: NewsItem[] }) {
  const [loading, setLoading] = useState(false)
  const [report, setReport] = useState('')
  const [provider, setProvider] = useState<ProviderName>('openai')
  const [error, setError] = useState<string | null>(null)
  const [itemCount, setItemCount] = useState(50)
  const [history, setHistory] = useState<HistoryEntry[]>([])
  const [activeId, setActiveId] = useState<string | null>(null)
  const [publishing, setPublishing] = useState(false)
  const [publishedSlot, setPublishedSlot] = useState<string | null>(null)

  useEffect(() => {
    try {
      const raw = localStorage.getItem('briefingHistory')
      if (raw) setHistory(JSON.parse(raw))
    } catch {}
  }, [])

  function saveToHistory(r: string, prov: string, count: number) {
    const entry: HistoryEntry = {
      id: Date.now().toString(),
      ts: new Date().toISOString(),
      provider: prov,
      itemCount: count,
      report: r,
      slot: null,
    }
    const next = [entry, ...history].slice(0, 20)
    setHistory(next)
    setActiveId(entry.id)
    try { localStorage.setItem('briefingHistory', JSON.stringify(next)) } catch {}
  }

  function updateHistorySlot(id: string, slot: string) {
    const next = history.map(h => h.id === id ? { ...h, slot } : h)
    setHistory(next)
    try { localStorage.setItem('briefingHistory', JSON.stringify(next)) } catch {}
  }

  async function generate() {
    if (!newsItems.length) return
    setLoading(true)
    setReport('')
    setError(null)
    setActiveId(null)
    setPublishedSlot(null)

    const items = newsItems.slice(0, itemCount)
    let full = ''
    try {
      const res = await fetch('/api/report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items, provider, tier: 'high' }),
      })
      if (!res.ok || !res.body) throw new Error(await res.text())

      const reader = res.body.getReader()
      const dec = new TextDecoder()
      let buf = ''
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buf += dec.decode(value, { stream: true })
        const lines = buf.split('\n')
        buf = lines.pop() ?? ''
        for (const line of lines) {
          if (line.startsWith('0:')) {
            try { const t = JSON.parse(line.slice(2)); full += t; setReport(p => p + t) } catch { /* skip */ }
          }
        }
      }
      saveToHistory(full, provider, items.length)
    } catch (e) {
      setError(String(e))
    } finally {
      setLoading(false)
    }
  }

  async function publish(slot: string) {
    if (!report || publishing) return
    setPublishing(true)
    try {
      await fetch('/api/briefings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slot, content: report, provider, itemCount }),
      })
      setPublishedSlot(slot)
      if (activeId) updateHistorySlot(activeId, slot)
    } catch (e) {
      setError(String(e))
    } finally {
      setPublishing(false)
    }
  }

  function loadHistory(entry: HistoryEntry) {
    setReport(entry.report)
    setActiveId(entry.id)
    setPublishedSlot(entry.slot)
    setError(null)
  }

  return (
    <div className="space-y-5">
      {/* Today auto-briefing status */}
      <TodayBriefingStatus />

      {/* History */}
      {history.length > 0 && (
        <div className="bg-white rounded-xl border p-4">
          <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">브리핑 히스토리 ({history.length}건)</h3>
          <div className="space-y-1 max-h-44 overflow-y-auto">
            {history.map(h => (
              <button
                key={h.id}
                onClick={() => loadHistory(h)}
                className={`w-full text-left px-3 py-2 rounded-lg text-xs transition ${
                  activeId === h.id ? 'bg-gray-900 text-white' : 'bg-gray-50 hover:bg-gray-100 text-gray-700'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium">
                    {new Date(h.ts).toLocaleString('ko-KR', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                  </span>
                  <span className={activeId === h.id ? 'text-gray-400' : 'text-gray-400'}>
                    {h.provider} · {h.itemCount}건{h.slot ? ` · ${h.slot} ✓` : ''}
                  </span>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Controls */}
      <div className="bg-white rounded-xl border p-5 space-y-4">
        <div>
          <h2 className="font-bold text-gray-900 text-lg">알파리서치 브리핑</h2>
          <p className="text-sm text-gray-500 mt-0.5">수집된 뉴스를 종합해 AI 리서치 센터장 관점의 일일 코멘트를 생성합니다.</p>
        </div>

        {newsItems.length === 0 ? (
          <div className="text-sm text-gray-400 bg-gray-50 rounded-lg p-4">
            먼저 <strong>뉴스 수집</strong> 탭에서 데이터를 가져온 후 분석에 전달하세요.
          </div>
        ) : (
          <div className="flex flex-wrap gap-4 items-end">
            <div>
              <label className="block text-xs text-gray-500 mb-1">LLM 모델</label>
              <select value={provider} onChange={e => setProvider(e.target.value as ProviderName)} className="border rounded px-2 py-1.5 text-sm">
                {PROVIDER_NAMES.filter(p => PROVIDER_CONFIG[p].enabled).map(p => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">투입 뉴스 수</label>
              <select value={itemCount} onChange={e => setItemCount(Number(e.target.value))} className="border rounded px-2 py-1.5 text-sm">
                <option value={20}>20건</option>
                <option value={50}>50건</option>
                <option value={100}>100건</option>
                <option value={200}>200건</option>
              </select>
              <span className="ml-2 text-xs text-gray-400">/ 전체 {newsItems.length}건</span>
            </div>
            <button
              onClick={generate}
              disabled={loading}
              className="px-6 py-2 bg-gray-900 text-white rounded-lg font-medium hover:bg-gray-700 disabled:opacity-50 transition"
            >
              {loading ? '분석 중...' : '브리핑 생성'}
            </button>
          </div>
        )}

        {error && <p className="text-sm text-red-500">{error}</p>}
      </div>

      {/* Report output */}
      {(report || loading) && (
        <div className="bg-white rounded-xl border p-6">
          <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-gray-900" />
              <span className="text-sm font-semibold text-gray-700">알파리서치 (AlphaResearch)</span>
              <span className="text-xs text-gray-400">AI 리서치 센터장</span>
            </div>
            {report && !loading && (
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs text-gray-500">공개 게시:</span>
                {PUBLISH_SLOTS.map(slot => (
                  <button
                    key={slot}
                    onClick={() => publish(slot)}
                    disabled={publishing}
                    className={`px-2.5 py-1 text-xs rounded-md border font-medium transition ${
                      publishedSlot === slot
                        ? 'bg-green-600 text-white border-green-600'
                        : 'text-gray-600 border-gray-300 hover:border-gray-500 hover:bg-gray-50'
                    }`}
                  >
                    {slot}{publishedSlot === slot ? ' ✓' : ''}
                  </button>
                ))}
                <button
                  onClick={() => navigator.clipboard.writeText(report)}
                  className="text-xs text-gray-400 hover:text-gray-600 ml-1"
                >
                  복사
                </button>
              </div>
            )}
          </div>
          {publishedSlot && (
            <div className="mb-4 text-xs text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-2">
              ✓ {publishedSlot} 브리핑으로 공개 페이지에 게시되었습니다. <a href="/" target="_blank" className="underline">공개 페이지 보기 →</a>
            </div>
          )}
          <div className="prose-sm max-w-none">
            {renderMarkdown(report)}
            {loading && <span className="inline-block w-1.5 h-4 bg-gray-400 animate-pulse ml-0.5" />}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Root Dashboard ─────────────────────────────────────────────────────────────

export default function Dashboard() {
  const [tab, setTab] = useState<'news' | 'briefing' | 'run' | 'score' | 'matrix'>('news')
  const [newsItems, setNewsItems] = useState<NewsItem[]>([])

  const tabs = [
    { key: 'news' as const, label: '뉴스 수집' },
    { key: 'briefing' as const, label: '알파리서치 브리핑' },
    { key: 'run' as const, label: '실험 실행 (개별)' },
    { key: 'score' as const, label: '채점' },
    { key: 'matrix' as const, label: '비용/품질' },
  ]

  function handleNewsLoaded(items: NewsItem[]) {
    setNewsItems(items)
    setTab('briefing')
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b px-6 py-4">
        <h1 className="text-xl font-bold text-gray-900">알파리서치 Admin — AI 리서치 센터장 브리핑 시스템</h1>
        <p className="text-sm text-gray-500 mt-0.5">텔레그램 채널 19,000+ 메시지 → 알파리서치 종합 브리핑 · <a href="/" target="_blank" className="text-blue-500 hover:underline">공개 페이지 →</a></p>
      </header>

      <div className="px-6 pt-5">
        <div className="flex gap-1 bg-gray-100 p-1 rounded-lg w-fit flex-wrap">
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
              {(t.key === 'briefing' || t.key === 'run') && newsItems.length > 0 && (
                <span className="ml-1.5 text-xs bg-blue-600 text-white px-1.5 py-0.5 rounded-full">{newsItems.length}</span>
              )}
            </button>
          ))}
        </div>
      </div>

      <main className="px-6 py-5 max-w-4xl">
        {tab === 'news' && <NewsPanel onNewsLoaded={handleNewsLoaded} />}
        {tab === 'briefing' && <BriefingPanel newsItems={newsItems} />}
        {tab === 'run' && <RunPanel newsItems={newsItems} />}
        {tab === 'score' && <ScoringPanel />}
        {tab === 'matrix' && <MatrixPanel />}
      </main>
    </div>
  )
}
