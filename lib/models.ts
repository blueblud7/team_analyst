export type EventType = 'report' | 'news' | 'comment' | 'earnings' | 'macro'
export type SentimentLabel = 'very_negative' | 'negative' | 'neutral' | 'positive' | 'very_positive'
export type ProviderName = 'openai' | 'anthropic' | 'deepseek' | 'qwen' | 'google'
export type Tier = 'low' | 'mid' | 'high'

export interface TaggedEvent {
  id: string
  ingested_at: string
  source_channel: string
  channel_tier: number
  channel_weight: number
  tickers: string[]
  sectors: string[]
  event_type: EventType
  sentiment_score: number | null
  sentiment_label: SentimentLabel | null
  conviction: number | null
  key_claims: string[]
  raw_summary: string
  source_url: string
  provider: string
  latency_ms: number | null
  input_tokens: number | null
  output_tokens: number | null
  cost_usd: number | null
  parse_error: string | null
}

export interface WeeklyMetrics {
  ticker: string
  week_start: string
  wsi: number
  velocity: number
  divergence: number
  event_count: number
  alerts: string[]
  provider: string
}

export interface CompareResult {
  task: 'tagger' | 'sentiment'
  results: Record<ProviderName, TaggedEvent[]>
  cost_summary: Record<ProviderName, { total_usd: number; ok: number; fail: number }>
}

export interface ScoreRow {
  task: string
  provider: string
  sample_idx: number
  scores: Record<string, number>
  created_at: string
}

// ── Macro Critic Types ────────────────────────────────────────────────────────

export type MarketRegime = 'risk_on' | 'risk_off' | 'neutral' | 'rotational'
export type MacroAlignment = 'tailwind' | 'headwind' | 'neutral'
export type WatchPriority = 'high' | 'medium'
export type SignalType = 'breakout' | 'reversal' | 'confirmation' | 'risk'

export interface MacroSnapshot {
  usd_krw?: number
  us_10y?: number
  dxy?: number
  wti?: number
  vix?: number
  kospi_change_pct?: number
  nasdaq_change_pct?: number
  sox_change_pct?: number
  [key: string]: number | undefined
}

export interface SectorMetrics {
  wsi: number
  velocity: number
  divergence: number
  event_count: number
  top_tickers?: string[]
  alerts?: string[]
}

export interface MacroCritiqueInput {
  week_start: string
  macro: MacroSnapshot
  sectors: Record<string, SectorMetrics>
}

export interface WatchItem {
  target: string
  target_type: 'ticker' | 'sector'
  reason: string
  priority: WatchPriority
  signal_type: SignalType
}

export type ReviewHorizon = '1d' | '1w' | '1m'

export interface CritiqueReviewResult {
  overall_accuracy: number
  regime_score: number
  leading_sector_score: number
  watchlist_score: number
  what_we_got_right: string[]
  what_we_got_wrong: string[]
  missed_signals: string[]
  learning: string
  confidence_in_review: number
}

export interface CritiqueRecord {
  id: number
  week_start: string
  result: MacroCritiqueResult
  created_at: string
  reviews: ReviewRecord[]
}

export interface ReviewRecord {
  id: number
  critique_id: number
  horizon: ReviewHorizon
  review_date: string
  actual_snapshot: MacroSnapshot
  scores: CritiqueReviewResult
  reviewed_at: string
}

export interface MacroCritiqueResult {
  week_start: string
  market_regime: MarketRegime
  regime_rationale: string
  leading_sectors: Array<{ sector: string; reason: string }>
  lagging_sectors: Array<{ sector: string; reason: string }>
  rotation_signal: string | null
  macro_alignment: Record<string, MacroAlignment>
  watch_list: WatchItem[]
  contrarian_view: string | null
  key_insight: string
  next_week_agenda: string[]
  confidence: number
  provider: string
  latency_ms: number | null
  cost_usd: number | null
}

export function makeEvent(overrides: Partial<TaggedEvent> = {}): TaggedEvent {
  return {
    id: crypto.randomUUID(),
    ingested_at: new Date().toISOString(),
    source_channel: '',
    channel_tier: 4,
    channel_weight: 0.2,
    tickers: [],
    sectors: [],
    event_type: 'news',
    sentiment_score: null,
    sentiment_label: null,
    conviction: null,
    key_claims: [],
    raw_summary: '',
    source_url: '',
    provider: '',
    latency_ms: null,
    input_tokens: null,
    output_tokens: null,
    cost_usd: null,
    parse_error: null,
    ...overrides,
  }
}
