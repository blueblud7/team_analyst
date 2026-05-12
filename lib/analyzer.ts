import { generateObject } from 'ai'
import { z } from 'zod'
import { getModel } from './providers'
import { computeCost } from './config'
import type { TaggedEvent, ProviderName, Tier } from './models'

const SENTIMENT_PROMPT = `당신은 한국 증권 도메인 sentiment 분석 전문가입니다.
아래 이벤트 데이터를 분석하여 sentiment 점수와 conviction을 평가하세요.

## 평가 기준
- sentiment_score: -1.0(매우 부정) ~ 0.0(중립) ~ 1.0(매우 긍정)
  - 한국 증권 리포트 특유의 완곡 표현에 주의:
    - "양호한 흐름 예상" → 약 +0.3 (positive, low conviction)
    - "변동성에 유의" → conviction 낮춤
    - "목표가 상향" → +0.6~0.8
    - "투자의견 하향" → -0.6~-0.8
    - "중립 유지" → 0.0~-0.1
- conviction: 0.0(불확실/애매) ~ 1.0(강한 확신)
  - 구체적 수치 제시, 상향/하향 등 명확한 액션 = conviction 높음
  - "가능성", "예상되나", "변동성 유의" 등 = conviction 낮음

## 입력:`

const SentimentSchema = z.object({
  sentiment_score: z.number().min(-1).max(1),
  sentiment_label: z.enum(['very_negative', 'negative', 'neutral', 'positive', 'very_positive']),
  conviction: z.number().min(0).max(1),
  key_claims: z.array(z.string()).max(3).describe('sentiment 판단 근거 핵심 문장 최대 3개'),
})

export async function analyzeSentiment(
  event: TaggedEvent,
  provider: ProviderName,
  tier: Tier = 'mid',
): Promise<TaggedEvent> {
  const payload = JSON.stringify({
    source_channel: event.source_channel,
    channel_tier: event.channel_tier,
    tickers: event.tickers,
    key_claims: event.key_claims,
    raw_summary: event.raw_summary,
  }, null, 2)

  const t0 = Date.now()
  try {
    const { object, usage } = await generateObject({
      model: getModel(provider, tier),
      schema: SentimentSchema,
      prompt: SENTIMENT_PROMPT + '\n\n' + payload,
    })

    const latency = Date.now() - t0
    event.latency_ms = (event.latency_ms ?? 0) + latency
    event.input_tokens = (event.input_tokens ?? 0) + usage.promptTokens
    event.output_tokens = (event.output_tokens ?? 0) + usage.completionTokens
    event.cost_usd = (event.cost_usd ?? 0) + computeCost(provider, tier, usage.promptTokens, usage.completionTokens)
    event.sentiment_score = object.sentiment_score
    event.sentiment_label = object.sentiment_label
    event.conviction = object.conviction
    if (object.key_claims.length > 0) event.key_claims = object.key_claims
  } catch (err) {
    event.latency_ms = (event.latency_ms ?? 0) + (Date.now() - t0)
    event.parse_error = (event.parse_error ? event.parse_error + ' | ' : '') + `sentiment: ${err}`
  }

  return event
}
