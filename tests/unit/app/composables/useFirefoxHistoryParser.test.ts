// See useSafariHistoryParser.test.ts for why this must run under the real
// Node environment (import.meta.url / fileURLToPath resolution for the wasm
// loader in app/utils/sqlJs.ts).
// @vitest-environment node
import { describe, expect, it, vi } from 'vitest'
import {
  SAMPLE_PLACES_DATA,
  createFirefoxHistoryDatabase
} from '../../../fixtures/build-firefox-history-db'
import { corruptDataPages } from '../../../fixtures/corrupt-sqlite-db'

// This test environment has no `Worker` global, so parseFirefoxHistoryFile
// runs parseFirefoxHistoryBuffer() directly on the calling thread instead of
// offloading to historyParser.worker.ts — the worker-dispatch branch
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

  it('maps moz_places.hidden (0/1) to a boolean', async () => {
    const { parseFirefoxHistoryFile } = await import('~/composables/useFirefoxHistoryParser')
    const file = await fileFromDb(() => createFirefoxHistoryDatabase(SAMPLE_PLACES_DATA))

    const result = await parseFirefoxHistoryFile(file)

    const hidden = result.visits.find((v) => v.visitId === 103)!
    expect(hidden.hidden).toBe(true)
    expect(hidden.title).toBe('(タイトルなし)')
  })

  it('derives typed per-visit from visit_type === 2, not from moz_places.typed', async () => {
    // moz_places.typed is a URL-level flag ("has this URL ever been typed"),
    // not a per-visit one — a visit must be reported as typed only when its
    // own visit_type says so, regardless of what the underlying URL's
    // aggregate typed flag says.
    const { parseFirefoxHistoryFile } = await import('~/composables/useFirefoxHistoryParser')
    const db = await createFirefoxHistoryDatabase({
      places: [
        { id: 1, url: 'https://example.com/typed-place', typed: true },
        { id: 2, url: 'https://example.com/untyped-place', typed: false }
      ],
      visits: [
        // A link-click visit (visit_type 1) to a URL whose place.typed=1
        // (typed on some *other* visit) must not itself read as typed.
        { id: 201, placeId: 1, visitDate: 1, visitType: 1 },
        // A typed-navigation visit (visit_type 2) to a URL whose
        // place.typed=0 must still read as typed.
        { id: 202, placeId: 2, visitDate: 2, visitType: 2 }
      ]
    })
    const bytes = db.export()
    db.close()
    const file = new File([bytes], 'typed-vs-place.sqlite')

    const result = await parseFirefoxHistoryFile(file)

    const linkClickOnTypedUrl = result.visits.find((v) => v.visitId === 201)!
    expect(linkClickOnTypedUrl.typed).toBe(false)

    const typedNavOnUntypedUrl = result.visits.find((v) => v.visitId === 202)!
    expect(typedNavOnUntypedUrl.typed).toBe(true)
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

  it('normalizes an unexpected sql.js error during query execution into a generic Japanese message (issue #111)', async () => {
    const { parseFirefoxHistoryFile } = await import('~/composables/useFirefoxHistoryParser')
    const db = await createFirefoxHistoryDatabase({
      places: [{ id: 1, url: 'https://example.com/' }],
      visits: [{ id: 1, placeId: 1, visitDate: 0 }]
    })
    const bytes = db.export()
    db.close()

    // Simulate an openable-but-internally-corrupt file (bad pages, corrupt
    // index, etc.) rather than a missing/renamed table — see
    // corrupt-sqlite-db.ts for why this is safe regardless of the DB's actual
    // page size/page count: assertPlacesSchema()'s own checks only read
    // page 1's metadata, so they still pass; only the JOIN query that
    // actually walks the corrupted table's b-tree fails.
    const corrupted = corruptDataPages(bytes)
    const file = new File([corrupted], 'corrupt-content.sqlite')

    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    try {
      await expect(parseFirefoxHistoryFile(file)).rejects.toThrow(
        /places\.sqliteの解析中にエラーが発生しました。/
      )
      expect(consoleErrorSpy).toHaveBeenCalled()
    } finally {
      consoleErrorSpy.mockRestore()
    }
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
