// This test drives firefoxHistoryDatabase.worker.ts's real `self.onmessage`
// handler directly (with real sql.js parsing) — mirrors historyDatabase.worker.test.ts.
// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  SAMPLE_PLACES_DATA,
  createFirefoxHistoryDatabase
} from '../../../fixtures/build-firefox-history-db'
import type {
  FirefoxHistoryDatabaseWorkerRequest,
  FirefoxHistoryDatabaseWorkerResponse
} from '~/composables/firefoxHistoryDatabase.worker'

class FakeWorkerScope {
  onmessage: ((event: { data: FirefoxHistoryDatabaseWorkerRequest }) => unknown) | null = null
  posted: FirefoxHistoryDatabaseWorkerResponse[] = []

  postMessage(data: FirefoxHistoryDatabaseWorkerResponse) {
    this.posted.push(data)
  }
}

async function bufferFromDb(
  build: () => Promise<Awaited<ReturnType<typeof createFirefoxHistoryDatabase>>>
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
  await import('~/composables/firefoxHistoryDatabase.worker')
  return scope
}

describe('firefoxHistoryDatabase.worker onmessage', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.resetModules()
  })

  it('parses a well-formed places.sqlite and posts back the visits under the request id', async () => {
    const scope = await loadWorkerScope()
    const buffer = await bufferFromDb(() => createFirefoxHistoryDatabase(SAMPLE_PLACES_DATA))

    const request: FirefoxHistoryDatabaseWorkerRequest = {
      requestId: 42,
      buffer,
      fileName: 'places.sqlite'
    }
    await scope.onmessage?.({ data: request })

    expect(scope.posted).toHaveLength(1)
    const response = scope.posted[0]!
    expect(response.requestId).toBe(42)
    if (!response.ok) throw new Error(`expected ok response, got: ${response.message}`)
    expect(response.visits).toHaveLength(SAMPLE_PLACES_DATA.visits.length)
    expect(response.visits[0]?.url).toBeTruthy()
  })

  it('posts back a Japanese-language error response, still tagged with the request id, on failure', async () => {
    const scope = await loadWorkerScope()
    const db = await createFirefoxHistoryDatabase({ places: [], visits: [] })
    db.run(
      'DROP TABLE moz_places; DROP TABLE moz_historyvisits; CREATE TABLE unrelated (id INTEGER);'
    )
    const buffer = new Uint8Array(db.export()).buffer
    db.close()

    const request: FirefoxHistoryDatabaseWorkerRequest = {
      requestId: 7,
      buffer,
      fileName: 'bad.sqlite'
    }
    await scope.onmessage?.({ data: request })

    expect(scope.posted).toHaveLength(1)
    const response = scope.posted[0]!
    expect(response.requestId).toBe(7)
    if (response.ok) throw new Error('expected an error response')
    expect(response.message).toMatch(
      /moz_places \/ moz_historyvisits テーブルが見つかりませんでした/
    )
  })
})
