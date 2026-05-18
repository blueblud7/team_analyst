import { neon } from '@neondatabase/serverless'

function getSql() {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL not set')
  return neon(process.env.DATABASE_URL)
}

export interface DbMessage {
  channel_id: string
  message_id: string
  posted_at: string
  text: string
  channel_title: string
  channel_username: string | null
}

export interface DbChannel {
  id: string
  title: string
  username: string | null
  type: string
  message_count: number
}

export interface MessageFilter {
  days?: number        // last N days (default 7)
  limit?: number       // max rows (default 100)
  channelIds?: string[]
  minLength?: number   // min text length (default 30)
  from?: string        // ISO datetime lower bound (inclusive)
  to?: string          // ISO datetime upper bound (inclusive)
}

export async function fetchMessages(filter: MessageFilter = {}): Promise<DbMessage[]> {
  const sql = getSql()
  const { days = 7, limit = 100, channelIds, minLength = 30, from, to } = filter

  // Prefer explicit from/to over days-based window
  const since = from ?? new Date(Date.now() - days * 86400_000).toISOString()
  const until = to ?? new Date().toISOString()

  if (channelIds && channelIds.length > 0) {
    const rows = await sql`
      SELECT m.channel_id::text, m.message_id::text, m.posted_at::text,
             m.text, c.title AS channel_title, c.username AS channel_username
      FROM messages m
      JOIN channels c ON c.id = m.channel_id
      WHERE m.text IS NOT NULL
        AND length(m.text) >= ${minLength}
        AND m.posted_at >= ${since}::timestamptz
        AND m.posted_at <= ${until}::timestamptz
        AND m.channel_id = ANY(${channelIds.map(Number)}::bigint[])
      ORDER BY m.posted_at DESC
      LIMIT ${limit}
    `
    return rows as DbMessage[]
  }

  const rows = await sql`
    SELECT m.channel_id::text, m.message_id::text, m.posted_at::text,
           m.text, c.title AS channel_title, c.username AS channel_username
    FROM messages m
    JOIN channels c ON c.id = m.channel_id
    WHERE m.text IS NOT NULL
      AND length(m.text) >= ${minLength}
      AND m.posted_at >= ${since}::timestamptz
      AND m.posted_at <= ${until}::timestamptz
    ORDER BY m.posted_at DESC
    LIMIT ${limit}
  `
  return rows as DbMessage[]
}

export async function fetchChannels(): Promise<DbChannel[]> {
  const sql = getSql()
  const rows = await sql`
    SELECT c.id::text, c.title, c.username, c.type,
           COUNT(m.message_id)::int AS message_count
    FROM channels c
    LEFT JOIN messages m ON m.channel_id = c.id
    WHERE c.selected = true
    GROUP BY c.id, c.title, c.username, c.type
    ORDER BY message_count DESC
  `
  return rows as DbChannel[]
}

export async function getStats(): Promise<{ channels: number; messages: number; connected: boolean }> {
  try {
    const sql = getSql()
    const rows = await sql`
      SELECT
        (SELECT COUNT(*) FROM channels WHERE selected = true)::int AS channels,
        (SELECT COUNT(*) FROM messages)::int AS messages
    `
    const r = rows[0] as { channels: number; messages: number }
    return { ...r, connected: true }
  } catch {
    return { channels: 0, messages: 0, connected: false }
  }
}

// ── Briefings (published to public page) ──────────────────────────────────────

export interface BriefingRecord {
  id: number
  slot: string
  content: string
  provider: string
  item_count: number
  created_at: string
}

export async function saveBriefing(slot: string, content: string, provider: string, itemCount: number): Promise<void> {
  const sql = getSql()
  await sql`
    CREATE TABLE IF NOT EXISTS briefings (
      id SERIAL PRIMARY KEY,
      slot VARCHAR(10) NOT NULL,
      content TEXT NOT NULL,
      provider VARCHAR(50) DEFAULT '',
      item_count INTEGER DEFAULT 0,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `
  await sql`
    INSERT INTO briefings (slot, content, provider, item_count)
    VALUES (${slot}, ${content}, ${provider}, ${itemCount})
  `
}

export async function getLatestBriefings(kstDate?: string): Promise<BriefingRecord[]> {
  try {
    const sql = getSql()
    const rows = kstDate
      ? await sql`
          SELECT DISTINCT ON (slot) id, slot, content, provider, item_count, created_at::text
          FROM briefings
          WHERE (created_at AT TIME ZONE 'Asia/Seoul')::date = ${kstDate}::date
          ORDER BY slot, created_at DESC
        `
      : await sql`
          SELECT DISTINCT ON (slot) id, slot, content, provider, item_count, created_at::text
          FROM briefings
          ORDER BY slot, created_at DESC
        `
    return rows as BriefingRecord[]
  } catch {
    return []
  }
}

export async function getBriefingDates(): Promise<string[]> {
  try {
    const sql = getSql()
    const rows = await sql`
      SELECT DISTINCT (created_at AT TIME ZONE 'Asia/Seoul')::date::text AS kst_date
      FROM briefings
      ORDER BY kst_date DESC
      LIMIT 30
    `
    return (rows as { kst_date: string }[]).map(r => r.kst_date)
  } catch {
    return []
  }
}

// ── Macro Critiques ───────────────────────────────────────────────────────────

import type { MacroCritiqueResult, CritiqueReviewResult, ReviewHorizon } from './models'

async function ensureMacroTables() {
  const sql = getSql()
  await sql`
    CREATE TABLE IF NOT EXISTS macro_critiques (
      id SERIAL PRIMARY KEY,
      week_start TEXT NOT NULL,
      result JSONB NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `
  await sql`
    CREATE TABLE IF NOT EXISTS critique_reviews (
      id SERIAL PRIMARY KEY,
      critique_id INTEGER REFERENCES macro_critiques(id) ON DELETE CASCADE,
      horizon TEXT NOT NULL,
      review_date TEXT NOT NULL,
      actual_snapshot JSONB DEFAULT '{}',
      scores JSONB NOT NULL,
      reviewed_at TIMESTAMPTZ DEFAULT NOW()
    )
  `
}

export async function saveMacroCritique(result: MacroCritiqueResult): Promise<number> {
  const sql = getSql()
  await ensureMacroTables()
  const rows = await sql`
    INSERT INTO macro_critiques (week_start, result)
    VALUES (${result.week_start}, ${JSON.stringify(result)})
    RETURNING id
  `
  return (rows[0] as { id: number }).id
}

export async function getMacroCritiques(limit = 20): Promise<Array<{
  id: number; week_start: string; result: MacroCritiqueResult; created_at: string
  reviews: Array<{ id: number; horizon: string; review_date: string; scores: CritiqueReviewResult; reviewed_at: string }>
}>> {
  try {
    const sql = getSql()
    await ensureMacroTables()
    const rows = await sql`
      SELECT
        c.id, c.week_start, c.result, c.created_at::text,
        COALESCE(
          JSON_AGG(
            JSON_BUILD_OBJECT(
              'id', r.id,
              'horizon', r.horizon,
              'review_date', r.review_date,
              'scores', r.scores,
              'reviewed_at', r.reviewed_at::text
            ) ORDER BY r.reviewed_at
          ) FILTER (WHERE r.id IS NOT NULL),
          '[]'
        ) AS reviews
      FROM macro_critiques c
      LEFT JOIN critique_reviews r ON r.critique_id = c.id
      GROUP BY c.id
      ORDER BY c.created_at DESC
      LIMIT ${limit}
    `
    return rows as ReturnType<typeof getMacroCritiques> extends Promise<infer T> ? T : never
  } catch {
    return []
  }
}

export async function getCritiqueById(id: number): Promise<{ week_start: string; result: MacroCritiqueResult } | null> {
  try {
    const sql = getSql()
    const rows = await sql`SELECT week_start, result FROM macro_critiques WHERE id = ${id}`
    if (!rows.length) return null
    return rows[0] as { week_start: string; result: MacroCritiqueResult }
  } catch {
    return null
  }
}

export async function saveReview(
  critiqueId: number,
  horizon: ReviewHorizon,
  reviewDate: string,
  actualSnapshot: Record<string, unknown>,
  scores: CritiqueReviewResult,
): Promise<void> {
  const sql = getSql()
  await ensureMacroTables()
  await sql`
    INSERT INTO critique_reviews (critique_id, horizon, review_date, actual_snapshot, scores)
    VALUES (${critiqueId}, ${horizon}, ${reviewDate}, ${JSON.stringify(actualSnapshot)}, ${JSON.stringify(scores)})
    ON CONFLICT DO NOTHING
  `
}
