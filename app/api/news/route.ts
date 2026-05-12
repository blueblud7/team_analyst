import { NextRequest, NextResponse } from 'next/server'
import { fetchDartDisclosures, fetchDartRecent } from '@/lib/news/dart'
import { fetchCnnRss, fetchCnnEconomyRss } from '@/lib/news/rss'
import { fetchRecentMessages, fetchRecentSummaries, getChannelCount, getMessageCount } from '@/lib/db'

export const maxDuration = 30

export interface NewsItem {
  source_channel: string
  raw_summary: string
  source_url: string
  posted_at: string
  source_type: 'neon_message' | 'neon_summary' | 'dart' | 'cnn' | 'sample'
}

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl
  const sources = searchParams.get('sources')?.split(',') ?? ['dart', 'cnn']

  const items: NewsItem[] = []
  const errors: string[] = []

  // ── Neon DB ────────────────────────────────────────────────────────────────
  if (sources.includes('neon') && process.env.DATABASE_URL) {
    try {
      const [msgCount, messages, summaries] = await Promise.all([
        getMessageCount(),
        fetchRecentMessages(30),
        fetchRecentSummaries(20),
      ])

      if (msgCount > 0) {
        items.push(...messages.filter(m => m.text).map(m => ({
          source_channel: m.channel_title,
          raw_summary: m.text!,
          source_url: m.channel_username ? `https://t.me/${m.channel_username}` : '',
          posted_at: m.posted_at,
          source_type: 'neon_message' as const,
        })))
        items.push(...summaries.map(s => ({
          source_channel: s.channel_title,
          raw_summary: s.content,
          source_url: '',
          posted_at: s.period_end,
          source_type: 'neon_summary' as const,
        })))
      }
    } catch (e) {
      errors.push(`neon: ${e}`)
    }
  }

  // ── DART ───────────────────────────────────────────────────────────────────
  if (sources.includes('dart') && process.env.DART_API_KEY) {
    try {
      const [specific, recent] = await Promise.all([
        fetchDartDisclosures(process.env.DART_API_KEY, 7),
        fetchDartRecent(process.env.DART_API_KEY, 3),
      ])
      items.push(...specific.map(d => ({ ...d, source_type: 'dart' as const })))
      items.push(...recent.map(d => ({ ...d, source_type: 'dart' as const })))
    } catch (e) {
      errors.push(`dart: ${e}`)
    }
  }

  // ── CNN RSS ─────────────────────────────────────────────────────────────────
  if (sources.includes('cnn')) {
    try {
      const [markets, economy] = await Promise.all([fetchCnnRss(), fetchCnnEconomyRss()])
      items.push(...markets.map(r => ({ ...r, source_type: 'cnn' as const })))
      items.push(...economy.map(r => ({ ...r, source_type: 'cnn' as const })))
    } catch (e) {
      errors.push(`cnn: ${e}`)
    }
  }

  // deduplicate by raw_summary prefix
  const seen = new Set<string>()
  const unique = items.filter(item => {
    const key = item.raw_summary.slice(0, 60)
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })

  // sort by date desc
  unique.sort((a, b) => new Date(b.posted_at).getTime() - new Date(a.posted_at).getTime())

  // DB status for dashboard display
  let dbStatus = { channels: 0, messages: 0, connected: false }
  if (process.env.DATABASE_URL) {
    try {
      const [channels, messages] = await Promise.all([getChannelCount(), getMessageCount()])
      dbStatus = { channels, messages, connected: true }
    } catch { /* ignore */ }
  }

  return NextResponse.json({ items: unique, errors, db: dbStatus, total: unique.length })
}
