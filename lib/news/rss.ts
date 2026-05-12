export interface RssItem {
  source_channel: string
  raw_summary: string
  source_url: string
  posted_at: string
}

// Simple XML text extractor (no external parser needed)
function extractTag(xml: string, tag: string): string {
  const m = xml.match(new RegExp(`<${tag}[^>]*>(?:<!\\[CDATA\\[)?([\\s\\S]*?)(?:\\]\\]>)?<\\/${tag}>`, 'i'))
  return m ? m[1].trim() : ''
}

function extractItems(xml: string): string[] {
  const items: string[] = []
  const re = /<item>([\s\S]*?)<\/item>/gi
  let m: RegExpExecArray | null
  while ((m = re.exec(xml)) !== null) items.push(m[1])
  return items
}

async function fetchRss(url: string, channelName: string, limit = 10): Promise<RssItem[]> {
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; YoonsenBot/1.0)' },
      next: { revalidate: 900 },
    })
    const xml = await res.text()
    const items = extractItems(xml).slice(0, limit)

    return items.map(item => {
      const title = extractTag(item, 'title')
      const desc = extractTag(item, 'description').replace(/<[^>]+>/g, '').trim()
      const link = extractTag(item, 'link') || extractTag(item, 'guid')
      const pubDate = extractTag(item, 'pubDate')

      const summary = [
        `[${channelName}] ${title}`,
        '',
        desc ? desc.slice(0, 500) : '(본문 없음)',
      ].join('\n')

      return {
        source_channel: channelName,
        raw_summary: summary,
        source_url: link,
        posted_at: pubDate ? new Date(pubDate).toISOString() : new Date().toISOString(),
      }
    }).filter(item => item.raw_summary.length > 40)
  } catch {
    return []
  }
}

export async function fetchCnnRss(): Promise<RssItem[]> {
  return fetchRss('https://rss.cnn.com/rss/money_markets.rss', 'CNN_Money', 10)
}

export async function fetchCnnEconomyRss(): Promise<RssItem[]> {
  return fetchRss('https://rss.cnn.com/rss/money_news_economy.rss', 'CNN_Economy', 8)
}

// Naver Finance news RSS (semiconductor/tech focus)
export async function fetchNaverFinanceRss(): Promise<RssItem[]> {
  const urls = [
    { url: 'https://finance.naver.com/news/news_list.naver?mode=LSS3D&section_id=101&section_id2=258&section_id3=401', label: '네이버_증권뉴스' },
  ]
  // Naver doesn't expose direct RSS for finance — use stock-specific RSS
  const stockRssResults = await Promise.all([
    fetchRss('https://finance.naver.com/item/news.naver?code=005930', 'Naver_삼성전자뉴스', 5),
    fetchRss('https://finance.naver.com/item/news.naver?code=000660', 'Naver_SK하이닉스뉴스', 5),
  ])
  void urls
  return stockRssResults.flat()
}
