import { NextRequest, NextResponse } from 'next/server'
import { fetchMessages, saveBriefing } from '@/lib/db'
import { fetchDartDisclosures } from '@/lib/news/dart'
import { fetchCnnRss, fetchCnnEconomyRss } from '@/lib/news/rss'
import { generateBriefingText } from '@/lib/synthesizer'
import type { BriefingInput } from '@/lib/synthesizer'
import { fetchMarketIndicators, formatMarketForPrompt } from '@/lib/market'

export const maxDuration = 120

const SLOT_MAP: Record<string, { label: string; fromHourKST: number; toHourKST: number; prevDay?: boolean; fallbackHours: number }> = {
  pre:  { label: '장전', fromHourKST: 16, toHourKST: 8,  prevDay: true, fallbackHours: 16 },
  mid:  { label: '장중', fromHourKST: 8,  toHourKST: 12, fallbackHours: 6  },
  post: { label: '장후', fromHourKST: 12, toHourKST: 16, fallbackHours: 6  },
}

function kstDate(offsetDays = 0): string {
  const d = new Date(Date.now() + 9 * 3600_000 + offsetDays * 86400_000)
  return d.toISOString().slice(0, 10)
}

function kstHourToUTC(dateStr: string, kstHour: number): Date {
  return new Date(`${dateStr}T${String(kstHour).padStart(2, '0')}:00:00+09:00`)
}

function getSlotWindow(slotKey: string): { label: string; from: Date; to: Date; fallbackHours: number } {
  const def = SLOT_MAP[slotKey]
  if (!def) throw new Error(`Unknown slot: ${slotKey}`)

  const today = kstDate(0)
  const yesterday = kstDate(-1)

  const from = def.prevDay
    ? kstHourToUTC(yesterday, def.fromHourKST)
    : kstHourToUTC(today, def.fromHourKST)

  const to = kstHourToUTC(today, def.toHourKST)

  return { label: def.label, from, to, fallbackHours: def.fallbackHours }
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

async function fetchNewsItems(from: Date, to: Date): Promise<BriefingInput[]> {
  const effectiveTo = to > new Date() ? new Date() : to
  const items: BriefingInput[] = []

  // Neon DB
  if (process.env.DATABASE_URL) {
    try {
      const messages = await fetchMessages({
        from: from.toISOString(),
        to: effectiveTo.toISOString(),
        limit: 300,
        minLength: 20,
      })
      items.push(...messages.map(m => ({
        source_channel: m.channel_title,
        raw_summary: m.text,
        source_url: m.channel_username ? `https://t.me/${m.channel_username}` : '',
        posted_at: m.posted_at,
      })))
    } catch (e) {
      console.error('neon fetch error', e)
    }
  }

  // DART
  if (process.env.DART_API_KEY) {
    try {
      const dart = await fetchDartDisclosures(process.env.DART_API_KEY, 2)
      items.push(...dart.filter(d => {
        const t = new Date(d.posted_at).getTime()
        return t >= from.getTime() && t <= effectiveTo.getTime()
      }))
    } catch {}
  }

  // CNN RSS (always fresh, include all)
  try {
    const [markets, economy] = await Promise.all([fetchCnnRss(), fetchCnnEconomyRss()])
    items.push(...[...markets, ...economy])
  } catch {}

  // Deduplicate
  const seen = new Set<string>()
  return items.filter(item => {
    const key = item.raw_summary.slice(0, 80)
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) return new Response('Unauthorized', { status: 401 })

  const slotKey = req.nextUrl.searchParams.get('slot') ?? 'pre'
  const { label, from, to, fallbackHours } = getSlotWindow(slotKey)

  let items = await fetchNewsItems(from, to)
  let usedFallback = false

  // Fallback: if window is empty, use last N hours
  if (items.length === 0) {
    const fallbackFrom = new Date(Date.now() - fallbackHours * 3600_000)
    items = await fetchNewsItems(fallbackFrom, new Date())
    usedFallback = true
  }

  if (items.length === 0) {
    return NextResponse.json({
      error: '수집된 뉴스가 없습니다. DB 연결 또는 뉴스 소스를 확인하세요.',
      slot: label,
      window: { from: from.toISOString(), to: to.toISOString() },
    }, { status: 400 })
  }

  items.sort((a, b) => new Date(a.posted_at).getTime() - new Date(b.posted_at).getTime())

  // Fetch market indicators (non-blocking — proceed even if it fails)
  let marketSnapshot = ''
  try {
    const indicators = await fetchMarketIndicators()
    marketSnapshot = formatMarketForPrompt(indicators)
  } catch {}

  const text = await generateBriefingText(items, label, marketSnapshot)
  await saveBriefing(label, text, 'openai', items.length)

  return NextResponse.json({
    ok: true,
    slot: label,
    itemCount: items.length,
    usedFallback,
    window: { from: from.toISOString(), to: to.toISOString() },
  })
}
