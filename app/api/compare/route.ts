import { NextRequest, NextResponse } from 'next/server'
import { tagEvent } from '@/lib/tagger'
import { analyzeSentiment } from '@/lib/analyzer'
import { getChannelMeta } from '@/lib/config'
import { SAMPLES } from '@/lib/samples'
import type { ProviderName, TaggedEvent } from '@/lib/models'

export const maxDuration = 300

export async function POST(req: NextRequest) {
  const body = await req.json()
  const providers: ProviderName[] = body.providers ?? []
  const task: 'tagger' | 'sentiment' = body.task ?? 'tagger'
  const sampleIndices: number[] = body.samples ?? SAMPLES.map((_, i) => i)

  if (!providers.length) {
    return NextResponse.json({ error: 'No providers specified' }, { status: 400 })
  }

  const samples = sampleIndices
    .filter(i => i >= 0 && i < SAMPLES.length)
    .map(i => SAMPLES[i])

  async function runOne(provider: ProviderName, idx: number): Promise<TaggedEvent | null> {
    const s = samples[idx]
    const ch = getChannelMeta(s.source_channel)
    try {
      let event = await tagEvent(
        s.raw_summary,
        s.source_channel,
        ch.tier,
        ch.weight,
        provider,
        'low',
        s.source_url,
      )
      if (task === 'sentiment') {
        event = await analyzeSentiment(event, provider, 'mid')
      }
      return event
    } catch (err) {
      console.error(`[compare] ${provider} sample${idx}:`, err)
      return null
    }
  }

  const taskPairs = providers.flatMap(p => samples.map((_, i) => ({ p, i })))
  const flat = await Promise.all(taskPairs.map(({ p, i }) => runOne(p, i)))

  const results: Record<string, TaggedEvent[]> = {}
  const costSummary: Record<string, { total_usd: number; ok: number; fail: number }> = {}

  taskPairs.forEach(({ p }, idx) => {
    if (!results[p]) results[p] = []
    if (!costSummary[p]) costSummary[p] = { total_usd: 0, ok: 0, fail: 0 }
    const r = flat[idx]
    if (r) {
      results[p].push(r)
      costSummary[p].total_usd += r.cost_usd ?? 0
      if (r.parse_error) costSummary[p].fail++
      else costSummary[p].ok++
    } else {
      costSummary[p].fail++
    }
  })

  return NextResponse.json({ task, results, cost_summary: costSummary })
}
