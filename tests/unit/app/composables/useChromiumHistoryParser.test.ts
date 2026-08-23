// See useSafariHistoryParser.test.ts for why this must run under the real
// Node environment (import.meta.url / fileURLToPath resolution for the wasm
// loader in app/utils/sqlJs.ts).
// @vitest-environment node
import { describe, expect, it } from 'vitest'
import {
  SAMPLE_CHROMIUM_DATA,
  SAMPLE_WEBKIT_BASE_TIME,
  createChromiumHistoryDatabase
} from '../../../fixtures/build-chromium-history-db'

// This test environment has no `Worker` global, so parseChromiumHistoryFile
// runs parseChromiumHistoryBuffer() directly on the calling thread instead of
// offloading to chromiumHistoryDatabase.worker.ts — the worker-dispatch
// branch itself is covered separately in useChromiumHistoryParser.worker.test.ts.

async function fileFromDb(
  build: () => Promise<Awaited<ReturnType<typeof createChromiumHistoryDatabase>>>
) {
  const db = await build()
  try {
    const bytes = db.export()
    return new File([bytes], 'History')
  } finally {
    db.close()
  }
}

describe('parseChromiumHistoryFile', () => {
  it('converts a well-formed History into ChromiumHistoryVisit[]', async () => {
    const { parseChromiumHistoryFile } = await import('~/composables/useChromiumHistoryParser')
    const file = await fileFromDb(() => createChromiumHistoryDatabase(SAMPLE_CHROMIUM_DATA))

    const result = await parseChromiumHistoryFile(file)

    expect(result.fileName).toBe('History')
    expect(result.visits).toHaveLength(SAMPLE_CHROMIUM_DATA.visits.length)

    // Visits are ordered by visit_time DESC.
    const times = result.visits.map((v) => v.visitTimeRaw)
    expect(times).toEqual([...times].sort((a, b) => b - a))

    const normal = result.visits.find((v) => v.visitId === 101)!
    expect(normal.url).toBe('https://www.example.com/')
    expect(normal.domain).toBe('www.example.com')
    expect(normal.title).toBe('Example Domain')
    expect(normal.visitCount).toBe(5)
    expect(normal.transition).toBe(0)
    expect(normal.fromVisit).toBeNull()
    expect(normal.hidden).toBe(false)
    expect(normal.typed).toBe(false)

    // WebKit epoch conversion: microseconds since 1601-01-01T00:00:00Z, minus
    // the 1601->1970 offset, converted to ms.
    expect(normal.visitTimeRaw).toBe(SAMPLE_WEBKIT_BASE_TIME)
    const expectedMs = (SAMPLE_WEBKIT_BASE_TIME - 11644473600 * 1_000_000) / 1000
    expect(normal.visitTime.getTime()).toBe(expectedMs)
  })

  it('maps urls.hidden (0/1) to a boolean', async () => {
    const { parseChromiumHistoryFile } = await import('~/composables/useChromiumHistoryParser')
    const file = await fileFromDb(() => createChromiumHistoryDatabase(SAMPLE_CHROMIUM_DATA))

    const result = await parseChromiumHistoryFile(file)

    const hidden = result.visits.find((v) => v.visitId === 103)!
    expect(hidden.hidden).toBe(true)
    expect(hidden.title).toBe('(タイトルなし)')
  })

  it('derives typed per-visit from the transition core type, not from urls.typed_count', async () => {
    // urls.typed_count is a URL-level aggregate ("how many times has this URL
    // ever been typed"), not a per-visit flag — a visit must be reported as
    // typed only when its own transition core type says so, regardless of
    // the underlying URL's aggregate typed_count.
    const { parseChromiumHistoryFile } = await import('~/composables/useChromiumHistoryParser')
    const db = await createChromiumHistoryDatabase({
      urls: [
        { id: 1, url: 'https://example.com/typed-url', typedCount: 3 },
        { id: 2, url: 'https://example.com/untyped-url', typedCount: 0 }
      ],
      visits: [
        // A link-click visit (transition 0) to a URL whose typed_count > 0
        // (typed on some *other* visit) must not itself read as typed.
        { id: 201, urlId: 1, visitTime: 1, transition: 0 },
        // A typed-navigation visit (transition core type 1) to a URL whose
        // typed_count is 0 must still read as typed.
        { id: 202, urlId: 2, visitTime: 2, transition: 1 }
      ]
    })
    const bytes = db.export()
    db.close()
    const file = new File([bytes], 'typed-vs-url.History')

    const result = await parseChromiumHistoryFile(file)

    const linkClickOnTypedUrl = result.visits.find((v) => v.visitId === 201)!
    expect(linkClickOnTypedUrl.typed).toBe(false)

    const typedNavOnUntypedUrl = result.visits.find((v) => v.visitId === 202)!
    expect(typedNavOnUntypedUrl.typed).toBe(true)
  })

  it('treats from_visit = 0 as null, and surfaces a numeric value when set', async () => {
    const { parseChromiumHistoryFile } = await import('~/composables/useChromiumHistoryParser')
    const file = await fileFromDb(() => createChromiumHistoryDatabase(SAMPLE_CHROMIUM_DATA))

    const result = await parseChromiumHistoryFile(file)

    const withoutFromVisit = result.visits.find((v) => v.visitId === 101)!
    expect(withoutFromVisit.fromVisit).toBeNull()

    const withFromVisit = result.visits.find((v) => v.visitId === 104)!
    expect(withFromVisit.fromVisit).toBe(104)
  })

  it('throws a Japanese-language error when urls/visits tables are missing', async () => {
    const { parseChromiumHistoryFile } = await import('~/composables/useChromiumHistoryParser')
    const db = await createChromiumHistoryDatabase({ urls: [], visits: [] })
    db.run('DROP TABLE urls; DROP TABLE visits; CREATE TABLE unrelated (id INTEGER);')
    const bytes = db.export()
    db.close()
    const file = new File([bytes], 'not-history')

    await expect(parseChromiumHistoryFile(file)).rejects.toThrow(
      /urls \/ visits テーブルが見つかりませんでした/
    )
  })

  it('throws a Japanese-language error when a required column is missing', async () => {
    const { parseChromiumHistoryFile } = await import('~/composables/useChromiumHistoryParser')
    const db = await createChromiumHistoryDatabase({ urls: [], visits: [] })
    db.run(`
      DROP TABLE urls;
      CREATE TABLE urls (
        id INTEGER PRIMARY KEY,
        url TEXT NOT NULL,
        visit_count INTEGER NOT NULL DEFAULT 0
      );
    `)
    const bytes = db.export()
    db.close()
    const file = new File([bytes], 'missing-column')

    await expect(parseChromiumHistoryFile(file)).rejects.toThrow(/typed_count/)
  })

  it('throws a Japanese-language error when the file is not a valid SQLite database', async () => {
    const { parseChromiumHistoryFile } = await import('~/composables/useChromiumHistoryParser')
    const file = new File([new Uint8Array([0, 1, 2, 3, 4, 5, 6, 7, 8, 9])], 'garbage')

    await expect(parseChromiumHistoryFile(file)).rejects.toThrow(
      /ファイルを開けませんでした。有効なSQLiteデータベースファイルを選択してください。/
    )
  })
})

describe('extractDomain (via parseChromiumHistoryFile output)', () => {
  it('falls back to the original string for an unparsable URL instead of throwing', async () => {
    const { parseChromiumHistoryFile } = await import('~/composables/useChromiumHistoryParser')
    const db = await createChromiumHistoryDatabase({
      urls: [{ id: 1, url: 'not a valid url' }],
      visits: [{ id: 1, urlId: 1, visitTime: 0 }]
    })
    const bytes = db.export()
    db.close()
    const file = new File([bytes], 'bad-url')

    const result = await parseChromiumHistoryFile(file)

    expect(result.visits[0].url).toBe('not a valid url')
    expect(result.visits[0].domain).toBe('not a valid url')
  })
})
