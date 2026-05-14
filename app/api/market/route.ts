import { NextResponse } from 'next/server'
import { fetchMarketIndicators } from '@/lib/market'

export const maxDuration = 15

export async function GET() {
  try {
    const indicators = await fetchMarketIndicators()
    return NextResponse.json({ indicators, updatedAt: new Date().toISOString() })
  } catch (e) {
    return NextResponse.json({ indicators: [], error: String(e) }, { status: 500 })
  }
}
