// This test drives historyParser.worker.ts's real `self.onmessage` handler
// directly (with real sql.js parsing) for all three `kind`s it dispatches —
// replaces the three separate historyDatabase.worker.test.ts /
// chromiumHistoryDatabase.worker.test.ts / firefoxHistoryDatabase.worker.test.ts
// files that used to each drive their own per-browser worker module (see
// issue #154).
//
// Needs the real `node:url`/fileURLToPath wasm-loading path in
// parse*HistoryDatabase.ts, which (per vitest.config.ts) only resolves
// correctly under a real Node environment — same reason
// useSafariHistoryParser.test.ts forces this.
// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest'
import { SAMPLE_HISTORY_DATA, createHistoryDatabase } from '../../../fixtures/build-history-db'
import {
  SAMPLE_CHROMIUM_DATA,
  createChromiumHistoryDatabase
} from '../../../fixtures/build-chromium-history-db'
import {
  SAMPLE_PLACES_DATA,
  createFirefoxHistoryDatabase
} from '../../../fixtures/build-firefox-history-db'
import type {
  HistoryParserWorkerRequest,
  HistoryParserWorkerResponse
} from '~/composables/historyParser.worker'

class FakeWorkerScope {
  onmessage: ((event: { data: HistoryParserWorkerRequest }) => unknown) | null = null
  posted: HistoryParserWorkerResponse[] = []

  postMessage(data: HistoryParserWorkerResponse) {
    this.posted.push(data)
  }
}

async function loadWorkerScope(): Promise<FakeWorkerScope> {
  const scope = new FakeWorkerScope()
  vi.stubGlobal('self', scope)
  await import('~/composables/historyParser.worker')
  return scope
}

async function bufferFromDb(build: () => Promise<{ export(): Uint8Array; close(): void }>) {
  const db = await build()
  try {
    return new Uint8Array(db.export()).buffer
  } finally {
    db.close()
  }
}

describe('historyParser.worker onmessage', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.resetModules()
  })

  describe('kind: safari', () => {
    it('parses a well-formed History.db and posts back the visits under the request id', async () => {
      const scope = await loadWorkerScope()
      const buffer = await bufferFromDb(() => createHistoryDatabase(SAMPLE_HISTORY_DATA))

      const request: HistoryParserWorkerRequest = {
        requestId: 42,
        kind: 'safari',
        buffer,
        fileName: 'History.db',
        locale: 'ja'
      }
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

      const request: HistoryParserWorkerRequest = {
        requestId: 7,
        kind: 'safari',
        buffer,
        fileName: 'bad.db',
        locale: 'ja'
      }
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

  describe('kind: chromium', () => {
    it('parses a well-formed History and posts back the visits under the request id', async () => {
      const scope = await loadWorkerScope()
      const buffer = await bufferFromDb(() => createChromiumHistoryDatabase(SAMPLE_CHROMIUM_DATA))

      const request: HistoryParserWorkerRequest = {
        requestId: 42,
        kind: 'chromium',
        buffer,
        fileName: 'History',
        locale: 'ja'
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

      const request: HistoryParserWorkerRequest = {
        requestId: 7,
        kind: 'chromium',
        buffer,
        fileName: 'bad-history',
        locale: 'ja'
      }
      await scope.onmessage?.({ data: request })

      expect(scope.posted).toHaveLength(1)
      const response = scope.posted[0]!
      expect(response.requestId).toBe(7)
      if (response.ok) throw new Error('expected an error response')
      expect(response.message).toMatch(/urls \/ visits テーブルが見つかりませんでした/)
    })
  })

  describe('kind: firefox', () => {
    it('parses a well-formed places.sqlite and posts back the visits under the request id', async () => {
      const scope = await loadWorkerScope()
      const buffer = await bufferFromDb(() => createFirefoxHistoryDatabase(SAMPLE_PLACES_DATA))

      const request: HistoryParserWorkerRequest = {
        requestId: 42,
        kind: 'firefox',
        buffer,
        fileName: 'places.sqlite',
        locale: 'ja'
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

      const request: HistoryParserWorkerRequest = {
        requestId: 7,
        kind: 'firefox',
        buffer,
        fileName: 'bad.sqlite',
        locale: 'ja'
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
})
