import fs from 'fs'
import path from 'path'
import { generateText } from 'ai'
import { getModel } from './providers'
import { computeCost } from './config'
import type { MacroCritiqueResult, MacroSnapshot, CritiqueReviewResult, ReviewHorizon, ProviderName, Tier } from './models'

const REVIEW_SYSTEM = `당신은 과거 예측을 냉정하게 평가하는 퀀트 전략가입니다.
틀린 것은 틀렸다고 직접 말합니다. JSON만 출력합니다.`

const HORIZON_LABEL: Record<ReviewHorizon, string> = {
  '1d': '1일 후',
  '1w': '1주일 후',
  '1m': '1개월 후',
}

function loadPrompt(): string {
  const p = path.join(process.cwd(), 'prompts', 'review', 'base.txt')
  return fs.readFileSync(p, 'utf-8').replace('[horizon]', '')
}

export async function runCritiqueReview(
  original: MacroCritiqueResult,
  horizon: ReviewHorizon,
  actualSnapshot: MacroSnapshot,
  provider: ProviderName = 'openai',
  tier: Tier = 'high',
): Promise<CritiqueReviewResult & { cost_usd: number | null; latency_ms: number }> {
  const template = loadPrompt()

  const horizonLabel = HORIZON_LABEL[horizon]
  const input = {
    horizon: horizonLabel,
    original_prediction: {
      week_start: original.week_start,
      market_regime: original.market_regime,
      regime_rationale: original.regime_rationale,
      leading_sectors: original.leading_sectors,
      lagging_sectors: original.lagging_sectors,
      rotation_signal: original.rotation_signal,
      watch_list: original.watch_list,
      contrarian_view: original.contrarian_view,
      key_insight: original.key_insight,
    },
    actual_market_data: {
      description: `${horizonLabel} 시점의 실제 시장 지표`,
      snapshot: actualSnapshot,
    },
  }

  const prompt = `${template}\n${JSON.stringify(input, null, 2)}`

  const start = Date.now()
  const { text, usage } = await generateText({
    model: getModel(provider, tier),
    system: REVIEW_SYSTEM,
    prompt,
  })
  const latency_ms = Date.now() - start

  const raw = text.trim().replace(/^```json\s*/i, '').replace(/```$/, '')
  const parsed: CritiqueReviewResult = JSON.parse(raw)

  const cost_usd = usage
    ? computeCost(provider, tier, usage.promptTokens, usage.completionTokens)
    : null

  return { ...parsed, cost_usd, latency_ms }
}

export function getReviewDueDate(createdAt: string, horizon: ReviewHorizon): Date {
  const base = new Date(createdAt)
  if (horizon === '1d') base.setDate(base.getDate() + 1)
  else if (horizon === '1w') base.setDate(base.getDate() + 7)
  else if (horizon === '1m') base.setMonth(base.getMonth() + 1)
  return base
}

export function isReviewDue(createdAt: string, horizon: ReviewHorizon): boolean {
  return new Date() >= getReviewDueDate(createdAt, horizon)
}
