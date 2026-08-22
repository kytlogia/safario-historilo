import { afterEach, describe, expect, it, vi } from 'vitest'
import type { HistoryVisit } from '~/types/history'
import type {
  HistoryDatabaseWorkerRequest,
  HistoryDatabaseWorkerResponse
} from '~/composables/historyDatabase.worker'

// jsdom (this file's default environment) has no real Worker implementation, so
// these tests stub `Worker` themselves to exercise the dispatch/response-handling
// branch of useSafariHistoryParser.ts in isolation from the actual sql.js parsing,
// which is already covered (on the non-Worker fallback path) by
// useSafariHistoryParser.test.ts, and (via the worker's own onmessage handler,
// with real parsing) by historyDatabase.worker.test.ts.

class FakeWorker {
  static instances: FakeWorker[] = []

  onmessage: ((event: MessageEvent<HistoryDatabaseWorkerResponse>) => void) | null = null
  onerror: ((event: ErrorEvent) => void) | null = null
  terminated = false
  posted: { data: unknown; transfer?: Transferable[] }[] = []

  constructor(
    public url: string | URL,
    public options?: WorkerOptions
  ) {
    FakeWorker.instances.push(this)
  }

  postMessage(data: unknown, transfer?: Transferable[]) {
    this.posted.push({ data, transfer })
  }

  terminate() {
    this.terminated = true
  }
}

const SAMPLE_VISIT: HistoryVisit = {
  visitId: 1,
  itemId: 1,
  url: 'https://example.com/',
  domain: 'example.com',
  title: 'Example',
  visitTime: new Date('2024-01-01T00:00:00Z'),
  visitTimeRaw: 700000000,
  visitCount: 1,
  domainExpansion: null,
  statusCode: 200,
  loadSuccessful: true,
  httpNonGet: false,
  synthesized: false,
  redirectSource: null,
  redirectDestination: null,
  origin: 0,
  generation: 0,
  attributes: 0,
  score: 0
}

async function latestWorker(): Promise<FakeWorker> {
  await vi.waitFor(() => {
    if (FakeWorker.instances.length === 0) throw new Error('worker not constructed yet')
  })
  return FakeWorker.instances.at(-1)!
}

function postedRequest(worker: FakeWorker, index = worker.posted.length - 1) {
  return worker.posted[index]!.data as HistoryDatabaseWorkerRequest
}

describe('parseSafariHistoryFile (Worker dispatch)', () => {
  afterEach(() => {
    FakeWorker.instances = []
    vi.unstubAllGlobals()
    vi.resetModules()
  })

  it('offloads parsing to a module Worker and resolves with its response', async () => {
    vi.stubGlobal('Worker', FakeWorker)
    const { parseSafariHistoryFile } = await import('~/composables/useSafariHistoryParser')
    const file = new File([new Uint8Array([1, 2, 3])], 'History.db')

    const promise = parseSafariHistoryFile(file)
    const worker = await latestWorker()

    expect(worker.options?.type).toBe('module')
    expect(worker.posted).toHaveLength(1)
    const request = postedRequest(worker)
    expect(request.fileName).toBe('History.db')
    expect(worker.posted[0]!.transfer).toEqual([request.buffer])

    const response: HistoryDatabaseWorkerResponse = {
      requestId: request.requestId,
      ok: true,
      visits: [SAMPLE_VISIT]
    }
    worker.onmessage?.({ data: response } as MessageEvent<HistoryDatabaseWorkerResponse>)

    const result = await promise
    // fileName comes from the request the main thread already sent, not from
    // the worker's response (which no longer echoes it back).
    expect(result.fileName).toBe('History.db')
    expect(result.visits).toEqual([SAMPLE_VISIT])
    // Success doesn't tear the worker down — it's kept alive and reused so the
    // sql.js/wasm init it cached isn't paid again on the next parse.
    expect(worker.terminated).toBe(false)
  })

  it('reuses the same Worker instance across multiple parses instead of recreating it', async () => {
    vi.stubGlobal('Worker', FakeWorker)
    const { parseSafariHistoryFile } = await import('~/composables/useSafariHistoryParser')

    const firstPromise = parseSafariHistoryFile(new File([new Uint8Array([1])], 'History.db'))
    const worker = await latestWorker()
    worker.onmessage?.({
      data: { requestId: postedRequest(worker).requestId, ok: true, visits: [] }
    } as MessageEvent<HistoryDatabaseWorkerResponse>)
    await firstPromise

    const secondPromise = parseSafariHistoryFile(new File([new Uint8Array([2])], 'History2.db'))
    await vi.waitFor(() => {
      expect(worker.posted).toHaveLength(2)
    })
    expect(FakeWorker.instances).toHaveLength(1)

    worker.onmessage?.({
      data: { requestId: postedRequest(worker).requestId, ok: true, visits: [] }
    } as MessageEvent<HistoryDatabaseWorkerResponse>)
    await secondPromise
  })

  it('rejects with the worker-reported message when parsing fails inside the worker', async () => {
    vi.stubGlobal('Worker', FakeWorker)
    const { parseSafariHistoryFile } = await import('~/composables/useSafariHistoryParser')
    const file = new File([new Uint8Array([1, 2, 3])], 'not-history.db')

    const promise = parseSafariHistoryFile(file)
    const worker = await latestWorker()

    const response: HistoryDatabaseWorkerResponse = {
      requestId: postedRequest(worker).requestId,
      ok: false,
      message: 'このファイルはSafariの履歴データベース(History.db)ではないようです。'
    }
    worker.onmessage?.({ data: response } as MessageEvent<HistoryDatabaseWorkerResponse>)

    await expect(promise).rejects.toThrow(
      'このファイルはSafariの履歴データベース(History.db)ではないようです。'
    )
    // A per-request failure reported by the worker doesn't mean the worker
    // itself is broken, so it's kept alive for the next parse.
    expect(worker.terminated).toBe(false)
  })

  it('rejects and drops the shared worker when the worker itself errors', async () => {
    vi.stubGlobal('Worker', FakeWorker)
    const { parseSafariHistoryFile } = await import('~/composables/useSafariHistoryParser')
    const file = new File([new Uint8Array([1, 2, 3])], 'History.db')

    const promise = parseSafariHistoryFile(file)
    const worker = await latestWorker()

    worker.onerror?.({ message: 'script load failed' } as ErrorEvent)

    await expect(promise).rejects.toThrow('script load failed')
    expect(worker.terminated).toBe(true)

    // The next parse must not try to reuse the broken worker.
    const nextPromise = parseSafariHistoryFile(file)
    const nextWorker = await vi.waitFor(() => {
      const instance = FakeWorker.instances.at(-1)!
      if (instance === worker) throw new Error('worker was reused after erroring')
      return instance
    })
    nextWorker.onmessage?.({
      data: { requestId: postedRequest(nextWorker).requestId, ok: true, visits: [] }
    } as MessageEvent<HistoryDatabaseWorkerResponse>)
    await nextPromise
  })
})
