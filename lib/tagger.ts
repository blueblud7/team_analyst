import { generateObject } from 'ai'
import { z } from 'zod'
import { getModel } from './providers'
import { computeCost } from './config'
import { makeEvent } from './models'
import { normalizeSectors, SECTOR_PROMPT_TABLE } from './sectors'
import type { TaggedEvent, ProviderName, Tier } from './models'

const TAGGER_PROMPT = `당신은 한국 증권 도메인 전문 데이터 추출 AI입니다.
아래 텔레그램 채널 요약문을 분석하여 JSON 스키마를 준수하는 구조화된 데이터를 추출하세요.

## 규칙
- tickers: 삼성전자→005930, SK하이닉스→000660, 마이크론→MU. 언급 없으면 빈 배열.
- sectors: 아래 정규화 테이블의 정규 섹터명만 사용. 복수 가능. 최대 3개.
- event_type: 증권사 공식 리포트=report, 뉴스 클리핑=news, 애널 코멘트=comment, 실적 발표=earnings, 거시경제=macro
- key_claims: 출처 없는 투자 추천 금지. 사실 + 분석 프레임만. 최대 5개.
- 모든 필드 필수. 해당 정보가 없으면 빈 배열 또는 null.

${SECTOR_PROMPT_TABLE}

## 입력 요약문:`

const TaggerSchema = z.object({
  tickers: z.array(z.string()).describe('종목코드 목록'),
  sectors: z.array(z.string()).describe('관련 섹터 목록'),
  event_type: z.enum(['report', 'news', 'comment', 'earnings', 'macro']),
  key_claims: z.array(z.string()).max(5).describe('핵심 사실/주장 한국어로 최대 5개'),
  source_url: z.string().nullable(),
})

export async function tagEvent(
  rawSummary: string,
  sourceChannel: string,
  channelTier: number,
  channelWeight: number,
  provider: ProviderName,
  tier: Tier = 'low',
  sourceUrl = '',
): Promise<TaggedEvent> {
  const event = makeEvent({
    raw_summary: rawSummary,
    source_channel: sourceChannel,
    channel_tier: channelTier,
    channel_weight: channelWeight,
    provider,
    source_url: sourceUrl,
  })

  const t0 = Date.now()
  try {
    const { object, usage } = await generateObject({
      model: getModel(provider, tier),
      schema: TaggerSchema,
      prompt: TAGGER_PROMPT + '\n\n' + rawSummary,
    })

    event.latency_ms = Date.now() - t0
    event.input_tokens = usage.promptTokens
    event.output_tokens = usage.completionTokens
    event.cost_usd = computeCost(provider, tier, usage.promptTokens, usage.completionTokens)
    event.tickers = object.tickers
    event.sectors = normalizeSectors(object.sectors)
    event.event_type = object.event_type
    event.key_claims = object.key_claims
    event.source_url = object.source_url ?? sourceUrl
  } catch (err) {
    event.latency_ms = Date.now() - t0
    event.parse_error = String(err)
  }

  return event
}
