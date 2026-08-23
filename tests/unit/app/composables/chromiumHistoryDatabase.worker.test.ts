// This test drives chromiumHistoryDatabase.worker.ts's real `self.onmessage`
// handler directly (with real sql.js parsing) — mirrors firefoxHistoryDatabase.worker.test.ts.
// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  SAMPLE_CHROMIUM_DATA,
  createChromiumHistoryDatabase
} from '../../../fixtures/build-chromium-history-db'
import type {
  ChromiumHistoryDatabaseWorkerRequest,
  ChromiumHistoryDatabaseWorkerResponse
} from '~/composables/chromiumHistoryDatabase.worker'

class FakeWorkerScope {
  onmessage: ((event: { data: ChromiumHistoryDatabaseWorkerRequest }) => unknown) | null = null
  posted: ChromiumHistoryDatabaseWorkerResponse[] = []

  postMessage(data: ChromiumHistoryDatabaseWorkerResponse) {
    this.posted.push(data)
  }
}

async function bufferFromDb(
  build: () => Promise<Awaited<ReturnType<typeof createChromiumHistoryDatabase>>>
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
  await import('~/composables/chromiumHistoryDatabase.worker')
  return scope
}

describe('chromiumHistoryDatabase.worker onmessage', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.resetModules()
  })

  it('parses a well-formed History and posts back the visits under the request id', async () => {
    const scope = await loadWorkerScope()
    const buffer = await bufferFromDb(() => createChromiumHistoryDatabase(SAMPLE_CHROMIUM_DATA))

    const request: ChromiumHistoryDatabaseWorkerRequest = {
      requestId: 42,
      buffer,
      fileName: 'History'
    }
    await scope.onmessage?.({ data: request })

    expect(scope.posted).toHaveLength(1)
    const response = scope.posted[0]!
    expect(response.requestId).toBe(42)
    if (!response.ok) throw new Error(`expected ok response, got: ${response.message}`)
    expect(response.visits).toHaveLength(SAMPLE_CHROMIUM_DATA.visits.length)
    expect(response.visits[0]?.url).toBeTruthy()
  })

  it('posts back a Japanese-language error response, still tagged with the request id, on failure', async () => {
    const scope = await loadWorkerScope()
    const db = await createChromiumHistoryDatabase({ urls: [], visits: [] })
    db.run('DROP TABLE urls; DROP TABLE visits; CREATE TABLE unrelated (id INTEGER);')
    const buffer = new Uint8Array(db.export()).buffer
    db.close()

    const request: ChromiumHistoryDatabaseWorkerRequest = {
      requestId: 7,
      buffer,
      fileName: 'bad-history'
    }
    await scope.onmessage?.({ data: request })

    expect(scope.posted).toHaveLength(1)
    const response = scope.posted[0]!
    expect(response.requestId).toBe(7)
    if (response.ok) throw new Error('expected an error response')
    expect(response.message).toMatch(/urls \/ visits テーブルが見つかりませんでした/)
  })
})
