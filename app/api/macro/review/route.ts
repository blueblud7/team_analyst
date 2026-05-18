// POST { critique_id, horizon }
// → fetches current market data → runs review agent → saves → returns scores

import { NextRequest, NextResponse } from 'next/server'
import { fetchMarketIndicators, buildMacroSnapshot } from '@/lib/market'
import { getCritiqueById, saveReview } from '@/lib/db'
import { runCritiqueReview, isReviewDue } from '@/lib/review'
import type { ReviewHorizon, ProviderName } from '@/lib/models'

export const maxDuration = 120

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  const critiqueId: number = body.critique_id
  const horizon: ReviewHorizon = body.horizon
  const provider: ProviderName = body.provider ?? 'openai'

  if (!critiqueId || !horizon) {
    return NextResponse.json({ error: 'critique_id and horizon required' }, { status: 400 })
  }

  const critique = await getCritiqueById(critiqueId)
  if (!critique) {
    return NextResponse.json({ error: 'Critique not found' }, { status: 404 })
  }

  if (!isReviewDue(critique.result.week_start, horizon)) {
    const due = new Date(critique.result.week_start)
    if (horizon === '1d') due.setDate(due.getDate() + 1)
    else if (horizon === '1w') due.setDate(due.getDate() + 7)
    else due.setMonth(due.getMonth() + 1)
    return NextResponse.json({
      error: `아직 리뷰 시기가 아닙니다. ${due.toLocaleDateString('ko-KR')} 이후 가능합니다.`
    }, { status: 400 })
  }

  // Fetch current market snapshot as "actual" data
  const indicators = await fetchMarketIndicators().catch(() => [])
  const actualSnapshot = buildMacroSnapshot(indicators)

  try {
    const reviewResult = await runCritiqueReview(
      critique.result,
      horizon,
      actualSnapshot,
      provider,
    )

    const reviewDate = new Date().toISOString().slice(0, 10)

    if (process.env.DATABASE_URL) {
      await saveReview(critiqueId, horizon, reviewDate, actualSnapshot, reviewResult)
    }

    return NextResponse.json({
      critique_id: critiqueId,
      horizon,
      review_date: reviewDate,
      actual_snapshot: actualSnapshot,
      scores: reviewResult,
    })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
