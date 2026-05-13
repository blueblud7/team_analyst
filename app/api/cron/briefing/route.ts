import { NextRequest, NextResponse } from 'next/server'
import { fetchMessages, saveBriefing } from '@/lib/db'
import { fetchDartDisclosures } from '@/lib/news/dart'
import { fetchCnnRss, fetchCnnEconomyRss } from '@/lib/news/rss'
import { generateBriefingText } from '@/lib/synthesizer'
import type { BriefingInput } from '@/lib/synthesizer'

export const maxDuration = 120

// URL slot key → Korean label + time window (KST)
const SLOT_MAP: Record<string, { label: string; fromHourKST: number; toHourKST: number; prevDay?: boolean }> = {
  pre:  { label: '장전', fromHourKST: 16, toHourKST: 8,  prevDay: true }, // prev 16:00 → today 08:00
  mid:  { label: '장중', fromHourKST: 8,  toHourKST: 12 },                // 08:00 → 12:00
  post: { label: '장후', fromHourKST: 12, toHourKST: 16 },                // 12:00 → 16:00
}

function getSlotWindow(slotKey: string): { label: string; from: Date; to: Date } {
  const def = SLOT_MAP[slotKey]
  if (!def) throw new Error(`Unknown slot: ${slotKey}`)

  // Current date in KST
  const kstNow = new Date(Date.now() + 9 * 3600_000)
  const kstDateStr = kstNow.toISOString().slice(0, 10) // YYYY-MM-DD KST

  // Build Date from KST time (append +09:00)
  const kst = (date: string, hour: number) =>
    new Date(`${date}T${String(hour).padStart(2, '0')}:00:00+09:00`)

  const [y, m, d] = kstDateStr.split('-').map(Number)
  const yesterday = new Date(Date.UTC(y, m - 1, d - 1)).toISOString().slice(0, 10)

  const from = def.prevDay
    ? kst(yesterday, def.fromHourKST)
    : kst(kstDateStr, def.fromHourKST)

  const to = kst(kstDateStr, def.toHourKST)

  return { label: def.label, from, to }
}

function isAuthorized(req: NextRequest): boolean {
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret) {
    const auth = req.headers.get('Authorization')
    if (auth === `Bearer ${cronSecret}`) return true
  }
  const session = req.cookies.get('admin_session')
  const expected = Buffer.from(process.env.ADMIN_PASSWORD ?? '').toString('base64')
  return !!(expected && session?.value === expected)
}

export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) return new Response('Unauthorized', { status: 401 })

  const slotKey = req.nextUrl.searchParams.get('slot') ?? 'pre'
  const { label, from, to } = getSlotWindow(slotKey)

  const now = new Date()
  const effectiveTo = to > now ? now : to // don't exceed current time

  const items: BriefingInput[] = []

  // Neon messages within the window
  if (process.env.DATABASE_URL) {
    try {
      const daysBack = Math.ceil((now.getTime() - from.getTime()) / 86400_000) + 1
      const messages = await fetchMessages({ days: daysBack, limit: 300, minLength: 50 })
      const fromMs = from.getTime()
      const toMs = effectiveTo.getTime()
      items.push(
        ...messages
          .filter(m => {
            const t = new Date(m.posted_at).getTime()
            return t >= fromMs && t <= toMs
          })
          .map(m => ({
            source_channel: m.channel_title,
            raw_summary: m.text,
            source_url: m.channel_username ? `https://t.me/${m.channel_username}` : '',
            posted_at: m.posted_at,
          }))
      )
    } catch (e) {
      console.error('neon fetch error', e)
    }
  }

  // DART
  if (process.env.DART_API_KEY) {
    try {
      const dart = await fetchDartDisclosures(process.env.DART_API_KEY, 2)
      items.push(
        ...dart.filter(d => {
          const t = new Date(d.posted_at).getTime()
          return t >= from.getTime() && t <= effectiveTo.getTime()
        })
      )
    } catch {}
  }

  // CNN RSS (no time filter — always fresh)
  try {
    const [markets, economy] = await Promise.all([fetchCnnRss(), fetchCnnEconomyRss()])
    items.push(...[...markets, ...economy])
  } catch {}

  // Deduplicate
  const seen = new Set<string>()
  const unique = items.filter(item => {
    const key = item.raw_summary.slice(0, 80)
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })

  if (!unique.length) {
    return NextResponse.json({ error: 'No news items in window', slot: label, from: from.toISOString(), to: effectiveTo.toISOString() }, { status: 400 })
  }

  unique.sort((a, b) => new Date(a.posted_at).getTime() - new Date(b.posted_at).getTime())

  const text = await generateBriefingText(unique, label)
  await saveBriefing(label, text, 'openai', unique.length)

  return NextResponse.json({
    ok: true,
    slot: label,
    itemCount: unique.length,
    window: { from: from.toISOString(), to: effectiveTo.toISOString() },
  })
}
