import { NextRequest, NextResponse } from 'next/server'
import { fetchDartDisclosures } from '@/lib/news/dart'
import { fetchCnnRss, fetchCnnEconomyRss } from '@/lib/news/rss'
import { fetchMessages, fetchChannels, getStats } from '@/lib/db'

export const maxDuration = 30

export interface NewsItem {
  source_channel: string
  raw_summary: string
  source_url: string
  posted_at: string
  source_type: 'neon_message' | 'dart' | 'cnn'
}

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams
  const sources = sp.get('sources')?.split(',') ?? ['neon']
  const days = Number(sp.get('days') ?? '7')
  const limit = Math.min(Number(sp.get('limit') ?? '100'), 500)
  const channelIds = sp.get('channels') ? sp.get('channels')!.split(',') : undefined
  const minLength = Number(sp.get('minLength') ?? '50')

  const items: NewsItem[] = []
  const errors: string[] = []

  // ── Neon DB messages ───────────────────────────────────────────────────────
  if (sources.includes('neon') && process.env.DATABASE_URL) {
    try {
      const messages = await fetchMessages({ days, limit, channelIds, minLength })
      items.push(...messages.map(m => ({
        source_channel: m.channel_title,
        raw_summary: m.text,
        source_url: m.channel_username ? `https://t.me/${m.channel_username}` : '',
        posted_at: m.posted_at,
        source_type: 'neon_message' as const,
      })))
    } catch (e) {
      errors.push(`neon: ${e}`)
    }
  }

  // ── DART ───────────────────────────────────────────────────────────────────
  if (sources.includes('dart') && process.env.DART_API_KEY) {
    try {
      const disclosures = await fetchDartDisclosures(process.env.DART_API_KEY, days)
      items.push(...disclosures.map(d => ({ ...d, source_type: 'dart' as const })))
    } catch (e) {
      errors.push(`dart: ${e}`)
    }
  }

  // ── CNN RSS ────────────────────────────────────────────────────────────────
  if (sources.includes('cnn')) {
    try {
      const [markets, economy] = await Promise.all([fetchCnnRss(), fetchCnnEconomyRss()])
      items.push(...[...markets, ...economy].map(r => ({ ...r, source_type: 'cnn' as const })))
    } catch (e) {
      errors.push(`cnn: ${e}`)
    }
  }

  // deduplicate
  const seen = new Set<string>()
  const unique = items.filter(item => {
    const key = item.raw_summary.slice(0, 80)
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })

  unique.sort((a, b) => new Date(b.posted_at).getTime() - new Date(a.posted_at).getTime())

  // DB stats + channel list
  const [db, channels] = await Promise.all([
    getStats().catch(() => ({ channels: 0, messages: 0, connected: false })),
    (sources.includes('neon') && process.env.DATABASE_URL)
      ? fetchChannels().catch(() => [])
      : Promise.resolve([]),
  ])

  return NextResponse.json({ items: unique, errors, db, channels, total: unique.length })
}
