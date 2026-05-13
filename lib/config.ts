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
  // ── Tier 1: 증권사 공식 리서치 ──────────────────────────────────────────────
  '키움증권 리서치센터':                    { tier: 1, weight: 1.0 },
  '키움증권 전략/시황 한지영':              { tier: 1, weight: 1.0 },
  '한화투자증권 리서치센터 투자전략팀':      { tier: 1, weight: 1.0 },
  '[미래에셋증권 전략/퀀트 유명간]':        { tier: 1, weight: 1.0 },
  '유안타 News 라운지':                    { tier: 1, weight: 1.0 },
  '[시그널랩] Signal Lab 리서치':          { tier: 1, weight: 1.0 },
  // ── Tier 2: 검증된 애널/전문 채널 ───────────────────────────────────────────
  'AWAKE - 실시간 주식 공시 정리채널':      { tier: 2, weight: 0.7 },
  'The Wall Street Journal World News':    { tier: 2, weight: 0.7 },
  '에테르의 일본&미국 리서치':              { tier: 2, weight: 0.7 },
  'Aurum Research - 투자 정보 공유':       { tier: 2, weight: 0.7 },
  '나박 AI : 제일 빠른 진짜 중요한 외신 속보': { tier: 2, weight: 0.7 },
  '한투증권 중국/신흥국 정정영':             { tier: 2, weight: 0.7 },
  'AI Report Digest':                      { tier: 2, weight: 0.7 },
  '매경 월가월부':                          { tier: 2, weight: 0.7 },
  '한경바이오인사이트':                     { tier: 2, weight: 0.7 },
  '미국 제약-바이오 주식/약장수':           { tier: 2, weight: 0.7 },
  '제약/바이오/미용 원리버 Oneriver':       { tier: 2, weight: 0.7 },
  '글로벌바이오아저씨':                     { tier: 2, weight: 0.7 },
  'Nihil\'s view of data & information':   { tier: 2, weight: 0.7 },
  'Quick Financial News':                  { tier: 2, weight: 0.7 },
  // ── Tier 3: 뉴스 피드 / 시황 클리핑 ───────────────────────────────────────
  'Market News Feed':                      { tier: 3, weight: 0.5 },
  '빠른 주식 뉴스':                         { tier: 3, weight: 0.5 },
  '머니서퍼🏄🏻‍♂️ 가장빠른 주식뉴스📈':     { tier: 3, weight: 0.5 },
  'Donald J. Trump':                       { tier: 3, weight: 0.5 },
  'KK Kontemporaries':                     { tier: 3, weight: 0.5 },
  // ── Tier 4: 익명/커뮤니티 ─────────────────────────────────────────────────
  '해외정보 분석(국제정치경제지정학 아이비리그 교수 기똥차게 부려먹기)': { tier: 4, weight: 0.2 },
  '텐렙':                                  { tier: 4, weight: 0.2 },
  '선진짱 주식공부방':                      { tier: 4, weight: 0.2 },
  '시장 이야기 by 제이슨':                  { tier: 4, weight: 0.2 },
  '잠실개미&10X\'s N.E.R.D.S':            { tier: 4, weight: 0.2 },
  '곰젤리 매매일지':                        { tier: 4, weight: 0.2 },
  '도PB의 생존투자':                        { tier: 4, weight: 0.2 },
  // ── 하드코딩 샘플용 (기존 유지) ───────────────────────────────────────────
  '키움증권_한지영':    { tier: 1, weight: 1.0 },
  '미래에셋증권_퀀트':  { tier: 1, weight: 1.0 },
  '유진투자증권_리포트': { tier: 1, weight: 1.0 },
  '한화투자증권_리포트': { tier: 1, weight: 1.0 },
  '삼성증권_리포트':    { tier: 1, weight: 1.0 },
  '채권_아침시황':      { tier: 3, weight: 0.5 },
  '주식_아침시황':      { tier: 3, weight: 0.5 },
  '연준_발언_클리핑':   { tier: 3, weight: 0.5 },
  '한국경제_텔레그램':  { tier: 3, weight: 0.5 },
  '익명_추천주_채널':   { tier: 4, weight: 0.2 },
  // ── 외부 뉴스 소스 ────────────────────────────────────────────────────────
  'DART_전자공시':      { tier: 1, weight: 1.0 },
  'CNN_Money':          { tier: 3, weight: 0.5 },
  'CNN_Economy':        { tier: 3, weight: 0.5 },
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
