// Macro data endpoint — combines Yahoo Finance + FMP + CNN RSS
// Returns MacroCritiqueInput-ready payload for the WB critic agent

import { NextRequest, NextResponse } from 'next/server'
import { fetchMarketIndicators, buildMacroSnapshot, formatMarketForPrompt } from '@/lib/market'
import {
  fetchUsSectorPerformance,
  fetchEconomicCalendar,
  formatSectorPerformanceForPrompt,
  formatCalendarForPrompt,
} from '@/lib/news/fmp'
import { fetchCnnRss, fetchCnnEconomyRss, fetchMacroRssItems } from '@/lib/news/rss'
import type { MacroSnapshot } from '@/lib/models'

export const maxDuration = 30

export interface MacroDataResponse {
  snapshot: MacroSnapshot
  // Formatted strings ready to inject into prompts
  market_prompt: string
  sector_prompt: string
  calendar_prompt: string
  // Raw CNN/Reuters headlines for context
  macro_headlines: Array<{ channel: string; summary: string; url: string; posted_at: string }>
  errors: string[]
  fetched_at: string
}

export async function GET(req: NextRequest) {
  const calendarDays = Number(req.nextUrl.searchParams.get('calendar_days') ?? '7')

  const errors: string[] = []

  // Fetch all three sources in parallel
  const [indicatorsResult, sectorResult, calendarResult, cnnResult, cnnEconResult, macroRssResult] =
    await Promise.allSettled([
      fetchMarketIndicators(),
      fetchUsSectorPerformance(),
      fetchEconomicCalendar(calendarDays),
      fetchCnnRss(),
      fetchCnnEconomyRss(),
      fetchMacroRssItems(),
    ])

  // ── Yahoo Finance ────────────────────────────────────────────────────────
  const indicators = indicatorsResult.status === 'fulfilled' ? indicatorsResult.value : []
  if (indicatorsResult.status === 'rejected') {
    errors.push(`yahoo: ${indicatorsResult.reason}`)
  }
  const snapshot = buildMacroSnapshot(indicators)
  const market_prompt = formatMarketForPrompt(indicators)

  // ── FMP Sector Performance ───────────────────────────────────────────────
  const sectors = sectorResult.status === 'fulfilled' ? sectorResult.value : []
  if (sectorResult.status === 'rejected') errors.push(`fmp_sectors: ${sectorResult.reason}`)
  const sector_prompt = formatSectorPerformanceForPrompt(sectors)

  // ── FMP Economic Calendar ────────────────────────────────────────────────
  const calendar = calendarResult.status === 'fulfilled' ? calendarResult.value : []
  if (calendarResult.status === 'rejected') errors.push(`fmp_calendar: ${calendarResult.reason}`)
  const calendar_prompt = formatCalendarForPrompt(calendar)

  // ── RSS Headlines ────────────────────────────────────────────────────────
  const allRss = [
    ...(cnnResult.status === 'fulfilled' ? cnnResult.value : []),
    ...(cnnEconResult.status === 'fulfilled' ? cnnEconResult.value : []),
    ...(macroRssResult.status === 'fulfilled' ? macroRssResult.value : []),
  ]
  if (cnnResult.status === 'rejected') errors.push(`cnn_markets: ${cnnResult.reason}`)
  if (cnnEconResult.status === 'rejected') errors.push(`cnn_economy: ${cnnEconResult.reason}`)
  if (macroRssResult.status === 'rejected') errors.push(`macro_rss: ${macroRssResult.reason}`)

  // Deduplicate by title prefix and sort by recency
  const seen = new Set<string>()
  const macro_headlines = allRss
    .filter(item => {
      const key = item.raw_summary.slice(0, 60)
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
    .sort((a, b) => new Date(b.posted_at).getTime() - new Date(a.posted_at).getTime())
    .slice(0, 25)
    .map(item => ({
      channel: item.source_channel,
      summary: item.raw_summary.slice(0, 300),
      url: item.source_url,
      posted_at: item.posted_at,
    }))

  const response: MacroDataResponse = {
    snapshot,
    market_prompt,
    sector_prompt,
    calendar_prompt,
    macro_headlines,
    errors,
    fetched_at: new Date().toISOString(),
  }

  return NextResponse.json(response)
}
