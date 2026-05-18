// Financial Modeling Prep — sector performance + macro news
// API key: FMP_API_KEY env var (free tier: 250 req/day)

export interface FmpSectorPerformance {
  sector: string        // US GICS sector name (e.g. "Technology")
  changesPercentage: string  // e.g. "+2.34%"
  changePct: number     // parsed float
}

// US GICS sector → Korean canonical sector mapping
const US_TO_KR_SECTOR: Record<string, string> = {
  'Technology':             '반도체',
  'Communication Services': 'AI/플랫폼',
  'Consumer Discretionary': '소비재/유통',
  'Consumer Staples':       '소비재/유통',
  'Energy':                 '에너지/화학',
  'Financials':             '금융',
  'Health Care':            '바이오/제약',
  'Industrials':            '건설/부동산',
  'Materials':              '에너지/화학',
  'Real Estate':            '건설/부동산',
  'Utilities':              '에너지/화학',
}

export async function fetchUsSectorPerformance(): Promise<FmpSectorPerformance[]> {
  const apiKey = process.env.FMP_API_KEY
  if (!apiKey) return []

  try {
    const res = await fetch(
      `https://financialmodelingprep.com/api/v3/sectors-performance?apikey=${apiKey}`,
      { next: { revalidate: 3600 } },
    )
    if (!res.ok) return []

    const data: Array<{ sector: string; changesPercentage: string }> = await res.json()
    return data.map(row => ({
      sector: row.sector,
      changesPercentage: row.changesPercentage,
      changePct: parseFloat(row.changesPercentage.replace('%', '')) || 0,
    }))
  } catch {
    return []
  }
}

// Convert US sector performance to Korean sector context string for prompts
export function formatSectorPerformanceForPrompt(sectors: FmpSectorPerformance[]): string {
  if (!sectors.length) return ''

  const sorted = [...sectors].sort((a, b) => b.changePct - a.changePct)
  const rows = sorted.map(s => {
    const kr = US_TO_KR_SECTOR[s.sector] ?? s.sector
    const sign = s.changePct >= 0 ? '▲' : '▼'
    return `${s.sector}(${kr}) ${sign}${Math.abs(s.changePct).toFixed(2)}%`
  })

  return `## 미국 섹터 등락 (FMP)\n${rows.join('  |  ')}`
}

// FMP economic calendar — upcoming high-impact events
export interface FmpEconomicEvent {
  event: string
  date: string
  country: string
  impact: 'High' | 'Medium' | 'Low'
  actual: string | null
  estimate: string | null
}

export async function fetchEconomicCalendar(days = 7): Promise<FmpEconomicEvent[]> {
  const apiKey = process.env.FMP_API_KEY
  if (!apiKey) return []

  try {
    const from = new Date().toISOString().split('T')[0]
    const to = new Date(Date.now() + days * 86400_000).toISOString().split('T')[0]
    const res = await fetch(
      `https://financialmodelingprep.com/api/v3/economic_calendar?from=${from}&to=${to}&apikey=${apiKey}`,
      { next: { revalidate: 3600 } },
    )
    if (!res.ok) return []

    const data: FmpEconomicEvent[] = await res.json()
    return data.filter(e => e.impact === 'High' && e.country === 'US').slice(0, 10)
  } catch {
    return []
  }
}

export function formatCalendarForPrompt(events: FmpEconomicEvent[]): string {
  if (!events.length) return ''
  const rows = events.map(e => `${e.date} | ${e.event} | 예상: ${e.estimate ?? '-'} / 실제: ${e.actual ?? '미발표'}`)
  return `## 주요 경제 일정 (FMP)\n${rows.join('\n')}`
}
