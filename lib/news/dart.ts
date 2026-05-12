export interface DartDisclosure {
  source_channel: string
  raw_summary: string
  source_url: string
  posted_at: string
}

// Major semiconductor/display tickers tracked in this PoC
const TARGET_CORPS = [
  { corp_code: '00126380', name: '삼성전자' },
  { corp_code: '00164779', name: 'SK하이닉스' },
  { corp_code: '00401731', name: '마이크론테크놀로지' },
]

function toDateStr(date: Date): string {
  return date.toISOString().slice(0, 10).replace(/-/g, '')
}

interface DartListItem {
  corp_name: string
  report_nm: string
  rcept_no: string
  flr_nm: string
  rcept_dt: string
  rm: string
}

interface DartListResponse {
  status: string
  message: string
  list?: DartListItem[]
}

export async function fetchDartDisclosures(apiKey: string, daysBack = 7): Promise<DartDisclosure[]> {
  const end = new Date()
  const start = new Date(end.getTime() - daysBack * 86400_000)
  const bgn = toDateStr(start)
  const ednStr = toDateStr(end)

  const results: DartDisclosure[] = []

  for (const corp of TARGET_CORPS) {
    try {
      const url = new URL('https://opendart.fss.or.kr/api/list.json')
      url.searchParams.set('crtfc_key', apiKey)
      url.searchParams.set('corp_code', corp.corp_code)
      url.searchParams.set('bgn_de', bgn)
      url.searchParams.set('end_de', ednStr)
      url.searchParams.set('page_no', '1')
      url.searchParams.set('page_count', '10')

      const res = await fetch(url.toString(), { next: { revalidate: 1800 } })
      const data: DartListResponse = await res.json()

      if (data.status !== '000' || !data.list) continue

      for (const item of data.list.slice(0, 5)) {
        const summary = [
          `[DART 공시] ${item.corp_name} — ${item.report_nm}`,
          ``,
          `■ 공시일: ${item.rcept_dt.replace(/(\d{4})(\d{2})(\d{2})/, '$1.$2.$3')}`,
          `■ 제출인: ${item.flr_nm}`,
          item.rm ? `■ 비고: ${item.rm}` : null,
          ``,
          `(DART 전자공시 시스템 정기공시)`,
        ].filter(Boolean).join('\n')

        results.push({
          source_channel: 'DART_전자공시',
          raw_summary: summary,
          source_url: `https://dart.fss.or.kr/dsaf001/main.do?rcpNo=${item.rcept_no}`,
          posted_at: item.rcept_dt,
        })
      }
    } catch {
      // skip corp on error
    }
  }

  return results
}

// General DART listing (no corp filter) for macro/sector view
export async function fetchDartRecent(apiKey: string, daysBack = 3): Promise<DartDisclosure[]> {
  const end = new Date()
  const start = new Date(end.getTime() - daysBack * 86400_000)

  try {
    const url = new URL('https://opendart.fss.or.kr/api/list.json')
    url.searchParams.set('crtfc_key', apiKey)
    url.searchParams.set('bgn_de', toDateStr(start))
    url.searchParams.set('end_de', toDateStr(end))
    url.searchParams.set('pblntf_ty', 'A')  // 정기공시
    url.searchParams.set('page_no', '1')
    url.searchParams.set('page_count', '20')

    const res = await fetch(url.toString(), { next: { revalidate: 1800 } })
    const data: DartListResponse = await res.json()
    if (data.status !== '000' || !data.list) return []

    return data.list.map(item => ({
      source_channel: 'DART_전자공시',
      raw_summary: [
        `[DART 정기공시] ${item.corp_name} — ${item.report_nm}`,
        ``,
        `■ 공시일: ${item.rcept_dt.replace(/(\d{4})(\d{2})(\d{2})/, '$1.$2.$3')}`,
        `■ 제출인: ${item.flr_nm}`,
        item.rm ? `■ 비고: ${item.rm}` : null,
      ].filter(Boolean).join('\n'),
      source_url: `https://dart.fss.or.kr/dsaf001/main.do?rcpNo=${item.rcept_no}`,
      posted_at: item.rcept_dt,
    }))
  } catch {
    return []
  }
}
