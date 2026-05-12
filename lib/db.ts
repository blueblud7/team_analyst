import { neon } from '@neondatabase/serverless'

function getSql() {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL not set')
  return neon(process.env.DATABASE_URL)
}

export interface DbMessage {
  channel_id: string
  message_id: string
  posted_at: string
  text: string | null
  has_media: boolean
  channel_title: string
  channel_username: string | null
}

export interface DbSummary {
  id: string
  channel_id: string | null
  kind: string
  period_start: string
  period_end: string
  content: string
  model: string | null
  channel_title: string
}

export async function fetchRecentMessages(limit = 50): Promise<DbMessage[]> {
  const rows = await getSql()`
    SELECT m.channel_id, m.message_id, m.posted_at, m.text, m.has_media,
           c.title AS channel_title, c.username AS channel_username
    FROM messages m
    JOIN channels c ON c.id = m.channel_id
    WHERE m.text IS NOT NULL AND length(m.text) > 30
    ORDER BY m.posted_at DESC
    LIMIT ${limit}
  `
  return rows as DbMessage[]
}

export async function fetchRecentSummaries(limit = 30): Promise<DbSummary[]> {
  const rows = await getSql()`
    SELECT s.id, s.channel_id, s.kind, s.period_start, s.period_end,
           s.content, s.model, COALESCE(c.title, '알 수 없음') AS channel_title
    FROM summaries s
    LEFT JOIN channels c ON c.id = s.channel_id
    ORDER BY s.created_at DESC
    LIMIT ${limit}
  `
  return rows as DbSummary[]
}

export async function getChannelCount(): Promise<number> {
  const rows = await getSql()`SELECT COUNT(*) AS cnt FROM channels WHERE selected = true`
  return Number((rows[0] as { cnt: string }).cnt)
}

export async function getMessageCount(): Promise<number> {
  const rows = await getSql()`SELECT COUNT(*) AS cnt FROM messages`
  return Number((rows[0] as { cnt: string }).cnt)
}
