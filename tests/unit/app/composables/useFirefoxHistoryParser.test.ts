// See useSafariHistoryParser.test.ts for why this must run under the real
// Node environment (import.meta.url / fileURLToPath resolution for the wasm
// loader in app/utils/sqlJs.ts).
// @vitest-environment node
import { describe, expect, it } from 'vitest'
import {
  SAMPLE_PLACES_DATA,
  createFirefoxHistoryDatabase
} from '../../../fixtures/build-firefox-history-db'

// This test environment has no `Worker` global, so parseFirefoxHistoryFile
// runs parseFirefoxHistoryBuffer() directly on the calling thread instead of
// offloading to firefoxHistoryDatabase.worker.ts — the worker-dispatch branch
// itself is covered separately in useFirefoxHistoryParser.worker.test.ts.

async function fileFromDb(
  build: () => Promise<Awaited<ReturnType<typeof createFirefoxHistoryDatabase>>>
) {
  const db = await build()
  try {
    const bytes = db.export()
    return new File([bytes], 'places.sqlite')
  } finally {
    db.close()
  }
}

describe('parseFirefoxHistoryFile', () => {
  it('converts a well-formed places.sqlite into FirefoxHistoryVisit[]', async () => {
    const { parseFirefoxHistoryFile } = await import('~/composables/useFirefoxHistoryParser')
    const file = await fileFromDb(() => createFirefoxHistoryDatabase(SAMPLE_PLACES_DATA))

    const result = await parseFirefoxHistoryFile(file)

    expect(result.fileName).toBe('places.sqlite')
    expect(result.visits).toHaveLength(SAMPLE_PLACES_DATA.visits.length)

    // Visits are ordered by visit_date DESC.
    const times = result.visits.map((v) => v.visitTimeRaw)
    expect(times).toEqual([...times].sort((a, b) => b - a))

    const normal = result.visits.find((v) => v.visitId === 101)!
    expect(normal.url).toBe('https://www.example.com/')
    expect(normal.domain).toBe('www.example.com')
    expect(normal.title).toBe('Example Domain')
    expect(normal.visitCount).toBe(5)
    expect(normal.visitType).toBe(1)
    expect(normal.fromVisit).toBeNull()
    expect(normal.hidden).toBe(false)
    expect(normal.typed).toBe(false)

    // Unix epoch conversion: microseconds since 1970-01-01T00:00:00Z -> ms.
    expect(normal.visitTimeRaw).toBe(1700000000000000)
    expect(normal.visitTime.getTime()).toBe(1700000000000000 / 1000)
    expect(normal.visitTime.toISOString()).toBe(new Date(1700000000000000 / 1000).toISOString())
  })

  it('maps 0/1 integer flags to booleans (hidden/typed)', async () => {
    const { parseFirefoxHistoryFile } = await import('~/composables/useFirefoxHistoryParser')
    const file = await fileFromDb(() => createFirefoxHistoryDatabase(SAMPLE_PLACES_DATA))

    const result = await parseFirefoxHistoryFile(file)

    const typed = result.visits.find((v) => v.visitId === 102)!
    expect(typed.typed).toBe(true)
    expect(typed.visitType).toBe(2)

    const hidden = result.visits.find((v) => v.visitId === 103)!
    expect(hidden.hidden).toBe(true)
    expect(hidden.title).toBe('(タイトルなし)')
  })

  it('treats from_visit = 0 as null, and surfaces a numeric value when set', async () => {
    const { parseFirefoxHistoryFile } = await import('~/composables/useFirefoxHistoryParser')
    const file = await fileFromDb(() => createFirefoxHistoryDatabase(SAMPLE_PLACES_DATA))

    const result = await parseFirefoxHistoryFile(file)

    const withoutFromVisit = result.visits.find((v) => v.visitId === 101)!
    expect(withoutFromVisit.fromVisit).toBeNull()

    const withFromVisit = result.visits.find((v) => v.visitId === 104)!
    expect(withFromVisit.fromVisit).toBe(104)
    expect(withFromVisit.visitType).toBe(5)
  })

  it('throws a Japanese-language error when moz_places/moz_historyvisits tables are missing', async () => {
    const { parseFirefoxHistoryFile } = await import('~/composables/useFirefoxHistoryParser')
    const db = await createFirefoxHistoryDatabase({ places: [], visits: [] })
    db.run(
      'DROP TABLE moz_places; DROP TABLE moz_historyvisits; CREATE TABLE unrelated (id INTEGER);'
    )
    const bytes = db.export()
    db.close()
    const file = new File([bytes], 'not-places.sqlite')

    await expect(parseFirefoxHistoryFile(file)).rejects.toThrow(
      /moz_places \/ moz_historyvisits テーブルが見つかりませんでした/
    )
  })

  it('throws a Japanese-language error when a required column is missing', async () => {
    const { parseFirefoxHistoryFile } = await import('~/composables/useFirefoxHistoryParser')
    const db = await createFirefoxHistoryDatabase({ places: [], visits: [] })
    db.run(`
      DROP TABLE moz_places;
      CREATE TABLE moz_places (
        id INTEGER PRIMARY KEY,
        url TEXT NOT NULL,
        visit_count INTEGER NOT NULL DEFAULT 0
      );
    `)
    const bytes = db.export()
    db.close()
    const file = new File([bytes], 'missing-column.sqlite')

    await expect(parseFirefoxHistoryFile(file)).rejects.toThrow(/guid/)
  })

  it('throws a Japanese-language error when the file is not a valid SQLite database', async () => {
    const { parseFirefoxHistoryFile } = await import('~/composables/useFirefoxHistoryParser')
    const file = new File([new Uint8Array([0, 1, 2, 3, 4, 5, 6, 7, 8, 9])], 'garbage.sqlite')

    await expect(parseFirefoxHistoryFile(file)).rejects.toThrow(
      /ファイルを開けませんでした。有効なSQLiteデータベースファイルを選択してください。/
    )
  })
})

describe('extractDomain (via parseFirefoxHistoryFile output)', () => {
  it('falls back to the original string for an unparsable URL instead of throwing', async () => {
    const { parseFirefoxHistoryFile } = await import('~/composables/useFirefoxHistoryParser')
    const db = await createFirefoxHistoryDatabase({
      places: [{ id: 1, url: 'not a valid url' }],
      visits: [{ id: 1, placeId: 1, visitDate: 0 }]
    })
    const bytes = db.export()
    db.close()
    const file = new File([bytes], 'bad-url.sqlite')

    const result = await parseFirefoxHistoryFile(file)

    expect(result.visits[0].url).toBe('not a valid url')
    expect(result.visits[0].domain).toBe('not a valid url')
  })
})
