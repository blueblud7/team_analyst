import fs from 'fs'
import path from 'path'
import { generateText } from 'ai'
import { getModel } from './providers'
import { computeCost } from './config'
import type {
  ProviderName,
  Tier,
  MacroCritiqueInput,
  MacroCritiqueResult,
} from './models'

const CRITIC_SYSTEM = `당신은 워런 버핏의 시각으로 시장을 분석하는 매크로 전략가입니다.
장기적 관점, 역발상 시각, 펀더멘털 중심으로 시장 흐름을 읽어냅니다.
JSON만 출력하세요. 다른 텍스트는 절대 출력하지 않습니다.`

function loadPrompt(): string {
  const p = path.join(process.cwd(), 'prompts', 'critic', 'base.txt')
  return fs.readFileSync(p, 'utf-8')
}

export async function runMacroCritique(
  input: MacroCritiqueInput,
  provider: ProviderName = 'anthropic',
  tier: Tier = 'high',
): Promise<MacroCritiqueResult> {
  const promptTemplate = loadPrompt()
  const prompt = `${promptTemplate}\n${JSON.stringify(input, null, 2)}`

  const start = Date.now()
  const { text, usage } = await generateText({
    model: getModel(provider, tier),
    system: CRITIC_SYSTEM,
    prompt,
  })
  const latency_ms = Date.now() - start

  const raw = text.trim().replace(/^```json\s*/i, '').replace(/```$/, '')
  const parsed = JSON.parse(raw)

  const cost_usd = usage
    ? computeCost(provider, tier, usage.promptTokens, usage.completionTokens)
    : null

  return {
    week_start: input.week_start,
    market_regime: parsed.market_regime,
    regime_rationale: parsed.regime_rationale,
    leading_sectors: parsed.leading_sectors ?? [],
    lagging_sectors: parsed.lagging_sectors ?? [],
    rotation_signal: parsed.rotation_signal ?? null,
    macro_alignment: parsed.macro_alignment ?? {},
    watch_list: parsed.watch_list ?? [],
    contrarian_view: parsed.contrarian_view ?? null,
    key_insight: parsed.key_insight,
    next_week_agenda: parsed.next_week_agenda ?? [],
    confidence: parsed.confidence ?? 0.5,
    provider,
    latency_ms,
    cost_usd,
  }
}

