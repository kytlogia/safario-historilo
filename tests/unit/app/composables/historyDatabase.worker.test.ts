// This test drives historyDatabase.worker.ts's real `self.onmessage` handler
// directly (with real sql.js parsing), unlike useSafariHistoryParser.worker.test.ts
// which stubs `Worker` entirely and never touches this file's actual code.
//
// Needs the real `node:url`/fileURLToPath wasm-loading path in
// parseHistoryDatabase.ts, which (per vitest.config.ts) only resolves correctly
// under a real Node environment — same reason useSafariHistoryParser.test.ts
// forces this.
// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest'
import { SAMPLE_HISTORY_DATA, createHistoryDatabase } from '../../../fixtures/build-history-db'
import type {
  HistoryDatabaseWorkerRequest,
  HistoryDatabaseWorkerResponse
} from '~/composables/historyDatabase.worker'

class FakeWorkerScope {
  onmessage: ((event: { data: HistoryDatabaseWorkerRequest }) => unknown) | null = null
  posted: HistoryDatabaseWorkerResponse[] = []

  postMessage(data: HistoryDatabaseWorkerResponse) {
    this.posted.push(data)
  }
}

async function bufferFromDb(
  build: () => Promise<Awaited<ReturnType<typeof createHistoryDatabase>>>
) {
  const db = await build()
  try {
    return new Uint8Array(db.export()).buffer
  } finally {
    db.close()
  }
}

async function loadWorkerScope(): Promise<FakeWorkerScope> {
  const scope = new FakeWorkerScope()
  vi.stubGlobal('self', scope)
  await import('~/composables/historyDatabase.worker')
  return scope
}

describe('historyDatabase.worker onmessage', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.resetModules()
  })

  it('parses a well-formed History.db and posts back the visits under the request id', async () => {
    const scope = await loadWorkerScope()
    const buffer = await bufferFromDb(() => createHistoryDatabase(SAMPLE_HISTORY_DATA))

    const request: HistoryDatabaseWorkerRequest = { requestId: 42, buffer, fileName: 'History.db' }
    await scope.onmessage?.({ data: request })

    expect(scope.posted).toHaveLength(1)
    const response = scope.posted[0]!
    expect(response.requestId).toBe(42)
    if (!response.ok) throw new Error(`expected ok response, got: ${response.message}`)
    expect(response.visits).toHaveLength(SAMPLE_HISTORY_DATA.visits.length)
    expect(response.visits[0]?.url).toBeTruthy()
  })

  it('posts back a Japanese-language error response, still tagged with the request id, on failure', async () => {
    const scope = await loadWorkerScope()
    const db = await createHistoryDatabase({ items: [], visits: [] })
    db.run(
      'DROP TABLE history_items; DROP TABLE history_visits; CREATE TABLE unrelated (id INTEGER);'
    )
    const buffer = new Uint8Array(db.export()).buffer
    db.close()

    const request: HistoryDatabaseWorkerRequest = { requestId: 7, buffer, fileName: 'bad.db' }
    await scope.onmessage?.({ data: request })

    expect(scope.posted).toHaveLength(1)
    const response = scope.posted[0]!
    expect(response.requestId).toBe(7)
    if (response.ok) throw new Error('expected an error response')
    expect(response.message).toMatch(
      /history_items \/ history_visits テーブルが見つかりませんでした/
    )
  })
})
