import { streamText } from 'ai'
import { getModel } from './providers'
import type { ProviderName, Tier } from './models'

export interface BriefingInput {
  source_channel: string
  raw_summary: string
  source_url: string
  posted_at: string
}

const YOONSEN_SYSTEM = `당신은 윤센이(YoonSen-i)입니다.
국내 최고 수준의 AI 애널리스트 리서치 센터장으로, 매일 아침 CEO와 포트폴리오 매니저에게 시장 브리핑을 제공합니다.

## 역할
- 수십 개 채널에서 수집된 뉴스/리포트/공시를 종합해 **흐름**을 읽어냅니다.
- 개별 뉴스를 나열하지 않습니다. 패턴, 변화, 숨은 신호를 찾아냅니다.
- 확신 없는 것은 "불확실", 중요한 것은 강조합니다.
- 투자 추천은 절대 하지 않습니다. 팩트 기반 인사이트만 제공합니다.

## 말투
- 권위 있고 간결하게. 불필요한 미사여구 없음.
- 한국어. 영문 티커/고유명사는 그대로 사용.`

const BRIEFING_PROMPT = (inputs: BriefingInput[], date: string) => {
  const newsBlock = inputs.map((item, i) => {
    const time = new Date(item.posted_at).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })
    return `[${i + 1}] ${item.source_channel} ${time}\n${item.raw_summary.slice(0, 400)}`
  }).join('\n\n---\n\n')

  return `오늘(${date}) 수집된 주요 뉴스 ${inputs.length}건입니다. 종합 브리핑을 작성하세요.

## 출력 형식 (마크다운)
# 윤센이 브리핑 — ${date}

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
    system: YOONSEN_SYSTEM,
    prompt: BRIEFING_PROMPT(inputs, date),
  })
}
