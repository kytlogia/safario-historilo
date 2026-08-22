import { afterEach, describe, expect, it, vi } from 'vitest'
import type { HistoryVisit } from '~/types/history'
import type { HistoryDatabaseWorkerResponse } from '~/composables/historyDatabase.worker'

// jsdom (this file's default environment) has no real Worker implementation, so
// these tests stub `Worker` themselves to exercise the dispatch/response-handling
// branch of useSafariHistoryParser.ts in isolation from the actual sql.js parsing,
// which is already covered (on the non-Worker fallback path) by
// useSafariHistoryParser.test.ts.

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

describe('parseSafariHistoryFile (Worker dispatch)', () => {
  afterEach(() => {
    FakeWorker.instances = []
    vi.unstubAllGlobals()
  })

  it('offloads parsing to a module Worker and resolves with its response', async () => {
    vi.stubGlobal('Worker', FakeWorker)
    const { parseSafariHistoryFile } = await import('~/composables/useSafariHistoryParser')
    const file = new File([new Uint8Array([1, 2, 3])], 'History.db')

    const promise = parseSafariHistoryFile(file)
    const worker = await latestWorker()

    expect(worker.options?.type).toBe('module')
    expect(worker.posted).toHaveLength(1)
    const posted = worker.posted[0]!.data as { buffer: ArrayBuffer; fileName: string }
    expect(posted.fileName).toBe('History.db')
    expect(worker.posted[0]!.transfer).toEqual([posted.buffer])

    const response: HistoryDatabaseWorkerResponse = {
      ok: true,
      visits: [SAMPLE_VISIT],
      fileName: 'History.db'
    }
    worker.onmessage?.({ data: response } as MessageEvent<HistoryDatabaseWorkerResponse>)

    const result = await promise
    expect(result.fileName).toBe('History.db')
    expect(result.visits).toEqual([SAMPLE_VISIT])
    expect(worker.terminated).toBe(true)
  })

  it('rejects with the worker-reported message when parsing fails inside the worker', async () => {
    vi.stubGlobal('Worker', FakeWorker)
    const { parseSafariHistoryFile } = await import('~/composables/useSafariHistoryParser')
    const file = new File([new Uint8Array([1, 2, 3])], 'not-history.db')

    const promise = parseSafariHistoryFile(file)
    const worker = await latestWorker()

    const response: HistoryDatabaseWorkerResponse = {
      ok: false,
      message: 'このファイルはSafariの履歴データベース(History.db)ではないようです。'
    }
    worker.onmessage?.({ data: response } as MessageEvent<HistoryDatabaseWorkerResponse>)

    await expect(promise).rejects.toThrow(
      'このファイルはSafariの履歴データベース(History.db)ではないようです。'
    )
    expect(worker.terminated).toBe(true)
  })

  it('rejects when the worker itself errors (e.g. failing to load)', async () => {
    vi.stubGlobal('Worker', FakeWorker)
    const { parseSafariHistoryFile } = await import('~/composables/useSafariHistoryParser')
    const file = new File([new Uint8Array([1, 2, 3])], 'History.db')

    const promise = parseSafariHistoryFile(file)
    const worker = await latestWorker()

    worker.onerror?.({ message: 'script load failed' } as ErrorEvent)

    await expect(promise).rejects.toThrow('script load failed')
    expect(worker.terminated).toBe(true)
  })
})
