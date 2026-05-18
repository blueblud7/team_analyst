import type { MacroSnapshot } from './models'

export interface MarketIndicator {
  symbol: string
  name: string
  price: number
  changePct: number
  currency: string
  decimals: number
}

export const MARKET_SYMBOLS = [
  // 국내 지수
  { symbol: '^KS11',    name: 'KOSPI',    currency: 'KRW', decimals: 0   },
  { symbol: '^KQ11',    name: 'KOSDAQ',   currency: 'KRW', decimals: 2   },
  // 미국 지수
  { symbol: '^IXIC',    name: 'NASDAQ',   currency: 'USD', decimals: 0   },
  { symbol: '^GSPC',    name: 'S&P500',   currency: 'USD', decimals: 0   },
  { symbol: '^DJI',     name: 'DOW',      currency: 'USD', decimals: 0   },
  { symbol: '^SOX',     name: 'SOX',      currency: 'USD', decimals: 0   },
  // 금리/환율
  { symbol: '^TNX',     name: '미국10Y',   currency: '%',   decimals: 3   },
  { symbol: 'USDKRW=X', name: '원/달러',   currency: 'KRW', decimals: 0   },
  { symbol: 'DX=F',     name: 'DXY',      currency: 'USD', decimals: 2   },
  // 원자재/공포지수
  { symbol: 'CL=F',     name: 'WTI',      currency: 'USD', decimals: 2   },
  { symbol: 'GC=F',     name: '금(Gold)', currency: 'USD', decimals: 1   },
  { symbol: '^VIX',     name: 'VIX',      currency: '',    decimals: 2   },
]

// symbol → snapshot field mapping
const SYMBOL_TO_SNAPSHOT: Partial<Record<string, keyof MacroSnapshot>> = {
  'USDKRW=X': 'usd_krw',
  '^TNX':     'us_10y',
  'DX=F':     'dxy',
  'CL=F':     'wti',
  '^VIX':     'vix',
}
const SYMBOL_TO_CHANGE: Partial<Record<string, keyof MacroSnapshot>> = {
  '^KS11':  'kospi_change_pct',
  '^IXIC':  'nasdaq_change_pct',
  '^SOX':   'sox_change_pct',
}

async function fetchOneSymbol(meta: typeof MARKET_SYMBOLS[number]): Promise<MarketIndicator | null> {
  try {
    const url = `https://query2.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(meta.symbol)}?interval=1d&range=1d`
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36' },
      cache: 'no-store',
    })
    if (!res.ok) return null
    const json = await res.json()
    const m = json?.chart?.result?.[0]?.meta
    if (!m) return null
    const price: number = m.regularMarketPrice ?? m.chartPreviousClose ?? 0
    const prev: number = m.previousClose ?? m.chartPreviousClose ?? price
    const changePct = prev ? ((price - prev) / prev) * 100 : 0
    return { symbol: meta.symbol, name: meta.name, price, changePct, currency: meta.currency, decimals: meta.decimals }
  } catch {
    return null
  }
}

export async function fetchMarketIndicators(): Promise<MarketIndicator[]> {
  const results = await Promise.all(MARKET_SYMBOLS.map(fetchOneSymbol))
  return results.filter((r): r is MarketIndicator => r !== null)
}

export function buildMacroSnapshot(indicators: MarketIndicator[]): MacroSnapshot {
  const snapshot: MacroSnapshot = {}
  for (const ind of indicators) {
    const priceField = SYMBOL_TO_SNAPSHOT[ind.symbol]
    if (priceField) snapshot[priceField] = ind.price

    const changeField = SYMBOL_TO_CHANGE[ind.symbol]
    if (changeField) snapshot[changeField] = Math.round(ind.changePct * 100) / 100
  }
  return snapshot
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
