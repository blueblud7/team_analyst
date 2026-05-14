export interface MarketIndicator {
  symbol: string
  name: string
  price: number
  changePct: number
  currency: string
  decimals: number
}

export const MARKET_SYMBOLS = [
  { symbol: '^KS11',  name: 'KOSPI',   currency: 'KRW', decimals: 0  },
  { symbol: '^KQ11',  name: 'KOSDAQ',  currency: 'KRW', decimals: 2  },
  { symbol: '^IXIC',  name: 'NASDAQ',  currency: 'USD', decimals: 0  },
  { symbol: '^GSPC',  name: 'S&P500',  currency: 'USD', decimals: 0  },
  { symbol: '^DJI',   name: 'DOW',     currency: 'USD', decimals: 0  },
  { symbol: 'GC=F',   name: '금(Gold)', currency: 'USD', decimals: 1  },
  { symbol: 'CL=F',   name: 'WTI유가',  currency: 'USD', decimals: 2  },
  { symbol: '^TNX',   name: '미국10Y',  currency: '%',   decimals: 3  },
]

export async function fetchMarketIndicators(): Promise<MarketIndicator[]> {
  const symbols = MARKET_SYMBOLS.map(s => s.symbol).join(',')
  const url = `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${encodeURIComponent(symbols)}&fields=regularMarketPrice,regularMarketChangePercent`

  const res = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; AlphaResearch/1.0)' },
    cache: 'no-store',
  })
  if (!res.ok) throw new Error(`Yahoo Finance: HTTP ${res.status}`)

  const json = await res.json()
  const quotes: Record<string, unknown>[] = json?.quoteResponse?.result ?? []

  return MARKET_SYMBOLS.flatMap(meta => {
    const q = quotes.find(r => r.symbol === meta.symbol)
    if (!q) return []
    return [{
      symbol: meta.symbol,
      name: meta.name,
      price: Number(q.regularMarketPrice ?? 0),
      changePct: Number(q.regularMarketChangePercent ?? 0),
      currency: meta.currency,
      decimals: meta.decimals,
    }]
  })
}

export function formatMarketForPrompt(indicators: MarketIndicator[]): string {
  if (!indicators.length) return ''
  const rows = indicators.map(i => {
    const sign = i.changePct >= 0 ? '▲' : '▼'
    const price = i.price.toFixed(i.decimals)
    return `${i.name} ${price} ${sign}${Math.abs(i.changePct).toFixed(2)}%`
  })
  return `## 주요 시장 지표 스냅샷\n${rows.join('  |  ')}`
}
