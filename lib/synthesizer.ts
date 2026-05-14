import { streamText, generateText } from 'ai'
import { getModel } from './providers'
import type { ProviderName, Tier } from './models'

export interface BriefingInput {
  source_channel: string
  raw_summary: string
  source_url: string
  posted_at: string
}

export const ALPHA_SYSTEM = `당신은 알파리서치(AlphaResearch)의 AI 리서치 센터장입니다.
국내 최고 수준의 AI 애널리스트로, 매일 아침 CEO와 포트폴리오 매니저에게 시장 브리핑을 제공합니다.

## 역할
- 수십 개 채널에서 수집된 뉴스/리포트/공시를 종합해 **흐름**을 읽어냅니다.
- 개별 뉴스를 나열하지 않습니다. 패턴, 변화, 숨은 신호를 찾아냅니다.
- 확신 없는 것은 "불확실", 중요한 것은 강조합니다.
- 투자 추천은 절대 하지 않습니다. 팩트 기반 인사이트만 제공합니다.
- 시장 지표가 제공된 경우, 브리핑 도입부에 수치를 반드시 언급합니다.

## 말투
- 권위 있고 간결하게. 불필요한 미사여구 없음.
- 한국어. 영문 티커/고유명사는 그대로 사용.`

export const BRIEFING_PROMPT = (inputs: BriefingInput[], date: string, slot?: string, marketSnapshot?: string) => {
  const newsBlock = inputs.map((item, i) => {
    const time = new Date(item.posted_at).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })
    return `[${i + 1}] ${item.source_channel} ${time}\n${item.raw_summary.slice(0, 400)}`
  }).join('\n\n---\n\n')

  const slotLabel = slot ? ` [${slot}]` : ''
  const marketSection = marketSnapshot ? `\n\n${marketSnapshot}\n` : ''

  return `오늘(${date})${slotLabel} 수집된 주요 뉴스 ${inputs.length}건입니다. 종합 브리핑을 작성하세요.${marketSection}

## 출력 형식 (마크다운)
# 알파리서치 브리핑${slotLabel} — ${date}

## 주요 시장 지표
(제공된 지표 수치를 그대로 표기. 등락 방향과 의미를 한 줄로 해석)

## 핵심 메시지
(3줄 이내. 오늘 가장 중요한 흐름)

## 섹터별 동향
(관련 섹터만. 반도체 / 바이오 / 매크로 / 기타 중 해당하는 것만)

## 주목할 신호
(평소와 다른 패턴, 상충되는 뉴스, 잠재적 변곡점)

## 내일 체크포인트
(확인해야 할 이벤트나 지표, 3개 이내)

---
⚠️ 본 브리핑은 AI 분석 결과로, 투자 추천이 아닙니다.

---

## 입력 뉴스

${newsBlock}`
}

export function streamBriefing(inputs: BriefingInput[], provider: ProviderName = 'openai', tier: Tier = 'high') {
  const date = new Date().toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' })
  return streamText({
    model: getModel(provider, tier),
    system: ALPHA_SYSTEM,
    prompt: BRIEFING_PROMPT(inputs, date),
  })
}

export async function generateBriefingText(
  inputs: BriefingInput[],
  slot: string,
  marketSnapshot = '',
  provider: ProviderName = 'openai',
  tier: Tier = 'high',
): Promise<string> {
  const date = new Date().toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' })
  const { text } = await generateText({
    model: getModel(provider, tier),
    system: ALPHA_SYSTEM,
    prompt: BRIEFING_PROMPT(inputs, date, slot, marketSnapshot),
  })
  return text
}
