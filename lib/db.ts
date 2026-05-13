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

export async function getLatestBriefings(): Promise<BriefingRecord[]> {
  try {
    const sql = getSql()
    const rows = await sql`
      SELECT DISTINCT ON (slot) id, slot, content, provider, item_count, created_at::text
      FROM briefings
      ORDER BY slot, created_at DESC
    `
    return rows as BriefingRecord[]
  } catch {
    return []
  }
}
