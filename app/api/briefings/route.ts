import { NextRequest, NextResponse } from 'next/server'
import { saveBriefing, getLatestBriefings } from '@/lib/db'

export const maxDuration = 30

export async function GET(req: NextRequest) {
  const date = req.nextUrl.searchParams.get('date') ?? undefined
  const briefings = await getLatestBriefings(date)
  return NextResponse.json({ briefings })
}

export async function POST(req: NextRequest) {
  const { slot, content, provider, itemCount } = await req.json()
  if (!slot || !content) return new Response('slot and content required', { status: 400 })
  await saveBriefing(slot, content, provider ?? '', itemCount ?? 0)
  return NextResponse.json({ ok: true })
}
