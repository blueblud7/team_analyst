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
