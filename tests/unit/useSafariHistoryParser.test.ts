import { fileURLToPath } from 'node:url'
import { describe, expect, it, vi } from 'vitest'
import {
  CORE_DATA_EPOCH_OFFSET_SECONDS,
  SAMPLE_HISTORY_DATA,
  createHistoryDatabase
} from '../fixtures/build-history-db'

// The app points sql.js at a public "/sql-wasm.wasm" asset for the browser build.
// That resolution strategy is orthogonal to the parsing logic under test here, so
// point it at the real wasm binary shipped in node_modules instead of touching
// the app source.
vi.mock('sql.js', async () => {
  const actual = await vi.importActual<typeof import('sql.js')>('sql.js')
  const wasmDir = fileURLToPath(new URL('../../node_modules/sql.js/dist/', import.meta.url))
  return {
    default: (config: Parameters<typeof actual.default>[0]) =>
      actual.default({ ...config, locateFile: (file: string) => `${wasmDir}${file}` })
  }
})

async function fileFromDb(build: () => Promise<Awaited<ReturnType<typeof createHistoryDatabase>>>) {
  const db = await build()
  try {
    const bytes = db.export()
    return new File([bytes], 'History.db')
  } finally {
    db.close()
  }
}

describe('parseSafariHistoryFile', () => {
  it('converts a well-formed History.db into HistoryVisit[]', async () => {
    const { parseSafariHistoryFile } = await import('~/composables/useSafariHistoryParser')
    const file = await fileFromDb(() => createHistoryDatabase(SAMPLE_HISTORY_DATA))

    const result = await parseSafariHistoryFile(file)

    expect(result.fileName).toBe('History.db')
    expect(result.visits).toHaveLength(SAMPLE_HISTORY_DATA.visits.length)

    // Visits are ordered by visit_time DESC.
    const times = result.visits.map((v) => v.visitTimeRaw)
    expect(times).toEqual([...times].sort((a, b) => b - a))

    const normal = result.visits.find((v) => v.visitId === 101)!
    expect(normal.url).toBe('https://www.example.com/')
    expect(normal.domain).toBe('www.example.com')
    expect(normal.title).toBe('Example Domain')
    expect(normal.visitCount).toBe(5)
    expect(normal.loadSuccessful).toBe(true)
    expect(normal.httpNonGet).toBe(false)
    expect(normal.synthesized).toBe(false)
    expect(normal.redirectSource).toBeNull()
    expect(normal.redirectDestination).toBeNull()

    // Core Data epoch conversion: seconds since 2001-01-01T00:00:00Z -> Unix epoch ms.
    expect(normal.visitTimeRaw).toBe(700000000)
    expect(normal.visitTime.getTime()).toBe((700000000 + CORE_DATA_EPOCH_OFFSET_SECONDS) * 1000)
    expect(normal.visitTime.toISOString()).toBe(
      new Date((700000000 + CORE_DATA_EPOCH_OFFSET_SECONDS) * 1000).toISOString()
    )
  })

  it('maps 0/1 integer flags to booleans (load_successful/http_non_get/synthesized)', async () => {
    const { parseSafariHistoryFile } = await import('~/composables/useSafariHistoryParser')
    const file = await fileFromDb(() => createHistoryDatabase(SAMPLE_HISTORY_DATA))

    const result = await parseSafariHistoryFile(file)

    const failed = result.visits.find((v) => v.visitId === 103)!
    expect(failed.loadSuccessful).toBe(false)
    expect(failed.title).toBe('(タイトルなし)')

    const synthesized = result.visits.find((v) => v.visitId === 102)!
    expect(synthesized.synthesized).toBe(true)
  })

  it('preserves null redirect_source/redirect_destination, and surfaces numeric values when set', async () => {
    const { parseSafariHistoryFile } = await import('~/composables/useSafariHistoryParser')
    const file = await fileFromDb(() => createHistoryDatabase(SAMPLE_HISTORY_DATA))

    const result = await parseSafariHistoryFile(file)

    const withoutRedirect = result.visits.find((v) => v.visitId === 101)!
    expect(withoutRedirect.redirectSource).toBeNull()
    expect(withoutRedirect.redirectDestination).toBeNull()

    const withRedirect = result.visits.find((v) => v.visitId === 104)!
    expect(withRedirect.redirectSource).toBe(104)
    expect(withRedirect.redirectDestination).toBe(105)
  })

  it('throws a Japanese-language error when history_items/history_visits tables are missing', async () => {
    const { parseSafariHistoryFile } = await import('~/composables/useSafariHistoryParser')
    const db = await createHistoryDatabase({ items: [], visits: [] })
    db.run(
      'DROP TABLE history_items; DROP TABLE history_visits; CREATE TABLE unrelated (id INTEGER);'
    )
    const bytes = db.export()
    db.close()
    const file = new File([bytes], 'not-history.db')

    await expect(parseSafariHistoryFile(file)).rejects.toThrow(
      /history_items \/ history_visits テーブルが見つかりませんでした/
    )
  })

  it('throws a Japanese-language error when a required column is missing', async () => {
    const { parseSafariHistoryFile } = await import('~/composables/useSafariHistoryParser')
    const db = await createHistoryDatabase({ items: [], visits: [] })
    // Recreate history_items without the required status_code column.
    db.run(`
      DROP TABLE history_items;
      CREATE TABLE history_items (
        id INTEGER PRIMARY KEY,
        url TEXT NOT NULL,
        domain_expansion TEXT,
        visit_count INTEGER NOT NULL DEFAULT 0
      );
    `)
    const bytes = db.export()
    db.close()
    const file = new File([bytes], 'missing-column.db')

    await expect(parseSafariHistoryFile(file)).rejects.toThrow(/status_code/)
  })

  it('throws when the file is not a valid SQLite database', async () => {
    const { parseSafariHistoryFile } = await import('~/composables/useSafariHistoryParser')
    const file = new File([new Uint8Array([0, 1, 2, 3, 4, 5, 6, 7, 8, 9])], 'garbage.db')

    // sql.js accepts arbitrary bytes at construction time and only fails once a
    // query actually touches the (corrupt) page structure, so this exercises the
    // schema/query error path rather than the constructor's own try/catch — either
    // way, the important behavior is that it rejects instead of silently returning.
    await expect(parseSafariHistoryFile(file)).rejects.toThrow()
  })
})

describe('extractDomain (via parseSafariHistoryFile output)', () => {
  it('falls back to the original string for an unparsable URL instead of throwing', async () => {
    const { parseSafariHistoryFile } = await import('~/composables/useSafariHistoryParser')
    const db = await createHistoryDatabase({
      items: [{ id: 1, url: 'not a valid url', visitCount: 1 }],
      visits: [{ id: 1, historyItem: 1, visitTime: 0, title: 'Bad URL' }]
    })
    const bytes = db.export()
    db.close()
    const file = new File([bytes], 'bad-url.db')

    const result = await parseSafariHistoryFile(file)

    expect(result.visits[0].url).toBe('not a valid url')
    expect(result.visits[0].domain).toBe('not a valid url')
  })
})
