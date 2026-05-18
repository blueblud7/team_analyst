// WB Macro Critique endpoint
// POST { week_start?, sectors?, provider?, tier?, save? }
// GET  → returns critique history

import { NextRequest, NextResponse } from 'next/server'
import { fetchMarketIndicators, buildMacroSnapshot } from '@/lib/market'
import { fetchUsSectorPerformance } from '@/lib/news/fmp'
import { runMacroCritique } from '@/lib/critic'
import { saveMacroCritique, getMacroCritiques } from '@/lib/db'
import type { ProviderName, Tier, SectorMetrics, MacroCritiqueInput } from '@/lib/models'

export const maxDuration = 120

function getWeekStart(date = new Date()): string {
  const d = new Date(date)
  d.setDate(d.getDate() - d.getDay() + (d.getDay() === 0 ? -6 : 1))
  return d.toISOString().slice(0, 10)
}

export async function GET() {
  const critiques = await getMacroCritiques(30)
  return NextResponse.json({ critiques })
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  const provider: ProviderName = body.provider ?? 'openai'
  const tier: Tier = body.tier ?? 'high'
  const week_start: string = body.week_start ?? getWeekStart()
  const sectors: Record<string, SectorMetrics> = body.sectors ?? {}
  const shouldSave: boolean = body.save !== false  // default: save

  const [indicators, usSectors] = await Promise.allSettled([
    fetchMarketIndicators(),
    fetchUsSectorPerformance(),
  ])

  const macroSnapshot = buildMacroSnapshot(
    indicators.status === 'fulfilled' ? indicators.value : []
  )

  if (usSectors.status === 'fulfilled') {
    for (const s of usSectors.value) {
      const key = `us_sector_${s.sector.toLowerCase().replace(/\s+/g, '_')}_pct`
      macroSnapshot[key] = s.changePct
    }
  }

  const input: MacroCritiqueInput = { week_start, macro: macroSnapshot, sectors }

  try {
    const result = await runMacroCritique(input, provider, tier)
    let savedId: number | null = null
    if (shouldSave && process.env.DATABASE_URL) {
      savedId = await saveMacroCritique(result)
    }
    return NextResponse.json({ ...result, saved_id: savedId })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
