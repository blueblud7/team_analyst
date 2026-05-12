import type { ProviderName, Tier } from './models'

interface TierConfig {
  model: string
  priceIn: number
  priceOut: number
}

interface ProviderConfig {
  enabled: boolean
  baseUrl?: string
  tiers: Record<Tier, TierConfig>
  notes: string
}

export const PROVIDER_CONFIG: Record<ProviderName, ProviderConfig> = {
  openai: {
    enabled: true,
    tiers: {
      low:  { model: 'gpt-4o-mini',  priceIn: 0.15,  priceOut: 0.60  },
      mid:  { model: 'gpt-4o-mini',  priceIn: 0.15,  priceOut: 0.60  },
      high: { model: 'gpt-4o',       priceIn: 2.50,  priceOut: 10.00 },
    },
    notes: 'Strict JSON output 강함',
  },
  anthropic: {
    enabled: false,
    tiers: {
      low:  { model: 'claude-haiku-4-5-20251001', priceIn: 1.00,  priceOut: 5.00  },
      mid:  { model: 'claude-sonnet-4-6',          priceIn: 3.00,  priceOut: 15.00 },
      high: { model: 'claude-opus-4-7',            priceIn: 5.00,  priceOut: 25.00 },
    },
    notes: '한국어 nuance 최강, 가장 비쌈',
  },
  deepseek: {
    enabled: false,
    baseUrl: 'https://api.deepseek.com/v1',
    tiers: {
      low:  { model: 'deepseek-chat',     priceIn: 0.28, priceOut: 0.42 },
      mid:  { model: 'deepseek-chat',     priceIn: 0.28, priceOut: 0.42 },
      high: { model: 'deepseek-reasoner', priceIn: 0.28, priceOut: 0.42 },
    },
    notes: '압도적 저가, 중국 서버 경유 주의',
  },
  qwen: {
    enabled: false,
    baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    tiers: {
      low:  { model: 'qwen-turbo', priceIn: 0.065, priceOut: 0.26  },
      mid:  { model: 'qwen-plus',  priceIn: 0.325, priceOut: 1.95  },
      high: { model: 'qwen-max',   priceIn: 0.78,  priceOut: 3.90  },
    },
    notes: '한국어 강함, 다크호스',
  },
  google: {
    enabled: false,
    tiers: {
      low:  { model: 'gemini-2.0-flash-lite', priceIn: 0.10, priceOut: 0.40  },
      mid:  { model: 'gemini-2.0-flash',      priceIn: 0.50, priceOut: 3.00  },
      high: { model: 'gemini-2.5-pro',        priceIn: 2.00, priceOut: 12.00 },
    },
    notes: '멀티모달, PDF 직접 입력 가능',
  },
}

export const CHANNEL_CONFIG: Record<string, { tier: number; weight: number }> = {
  '키움증권_한지영':   { tier: 1, weight: 1.0 },
  '미래에셋증권_퀀트': { tier: 1, weight: 1.0 },
  '유진투자증권_리포트': { tier: 1, weight: 1.0 },
  '한화투자증권_리포트': { tier: 1, weight: 1.0 },
  '삼성증권_리포트':   { tier: 1, weight: 1.0 },
  '실명_애널_채널_예시': { tier: 2, weight: 0.7 },
  '채권_아침시황':     { tier: 3, weight: 0.5 },
  '주식_아침시황':     { tier: 3, weight: 0.5 },
  '연준_발언_클리핑':  { tier: 3, weight: 0.5 },
  '한국경제_텔레그램': { tier: 3, weight: 0.5 },
  '익명_추천주_채널':  { tier: 4, weight: 0.2 },
}

export function getChannelMeta(channel: string) {
  return CHANNEL_CONFIG[channel] ?? { tier: 4, weight: 0.2 }
}

export function enabledProviders(): ProviderName[] {
  return (Object.keys(PROVIDER_CONFIG) as ProviderName[]).filter(
    p => PROVIDER_CONFIG[p].enabled
  )
}

export function computeCost(provider: ProviderName, tier: Tier, inTok: number, outTok: number): number {
  const { priceIn, priceOut } = PROVIDER_CONFIG[provider].tiers[tier]
  return (inTok * priceIn + outTok * priceOut) / 1_000_000
}
