import type { TaggedEvent, WeeklyMetrics } from './models'

function computeWsi(events: TaggedEvent[]): number {
  const valid = events.filter(e => e.sentiment_score !== null && e.conviction !== null)
  if (!valid.length) return 0
  const num = valid.reduce((s, e) => s + e.sentiment_score! * e.conviction! * e.channel_weight, 0)
  const den = valid.reduce((s, e) => s + e.conviction! * e.channel_weight, 0)
  return den ? num / den : 0
}

function computeDivergence(events: TaggedEvent[]): number {
  const scores = events.map(e => e.sentiment_score).filter((s): s is number => s !== null)
  if (scores.length < 2) return 0
  const mean = scores.reduce((a, b) => a + b, 0) / scores.length
  const variance = scores.reduce((s, x) => s + (x - mean) ** 2, 0) / scores.length
  return Math.sqrt(variance)
}

function checkAlerts(velocity: number, divergence: number): string[] {
  const alerts: string[] = []
  if (Math.abs(velocity) > 0.3) {
    const dir = velocity > 0 ? '상승' : '하락'
    alerts.push(`VELOCITY_ALERT: ${velocity.toFixed(3)} — 주간 톤 급변(${dir})`)
  }
  if (divergence > 0.5) {
    alerts.push(`DIVERGENCE_ALERT: ${divergence.toFixed(3)} — 의견 양극화 (변곡점 가능성)`)
  }
  return alerts
}

export function buildWeeklyMetrics(
  ticker: string,
  weekStart: string,
  eventsNow: TaggedEvent[],
  eventsPrev: TaggedEvent[],
  provider = '',
): WeeklyMetrics {
  const wsiNow = computeWsi(eventsNow)
  const wsiPrev = computeWsi(eventsPrev)
  const velocity = wsiNow - wsiPrev
  const divergence = computeDivergence(eventsNow)
  return {
    ticker,
    week_start: weekStart,
    wsi: Math.round(wsiNow * 10000) / 10000,
    velocity: Math.round(velocity * 10000) / 10000,
    divergence: Math.round(divergence * 10000) / 10000,
    event_count: eventsNow.length,
    alerts: checkAlerts(velocity, divergence),
    provider,
  }
}
