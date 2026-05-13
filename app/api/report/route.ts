import { NextRequest } from 'next/server'
import { streamBriefing } from '@/lib/synthesizer'
import type { ProviderName } from '@/lib/models'

export const maxDuration = 120

export async function POST(req: NextRequest) {
  const body = await req.json()
  const items = body.items ?? []
  const provider: ProviderName = body.provider ?? 'openai'
  const tier = body.tier ?? 'high'

  if (!items.length) {
    return new Response('No items provided', { status: 400 })
  }

  const result = streamBriefing(items, provider, tier)
  return result.toDataStreamResponse()
}
