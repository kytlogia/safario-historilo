import { afterEach, describe, expect, it, vi } from 'vitest'
import type { ChromiumHistoryVisit } from '~/types/history'
import type {
  HistoryParserWorkerRequest,
  HistoryParserWorkerResponse
} from '~/composables/historyParser.worker'

// jsdom (this file's default environment) has no real Worker implementation, so
// these tests stub `Worker` themselves to exercise the dispatch/response-handling
// branch of useChromiumHistoryParser.ts in isolation from the actual sql.js parsing
// — mirrors useFirefoxHistoryParser.worker.test.ts.

class FakeWorker {
  static instances: FakeWorker[] = []

  onmessage: ((event: MessageEvent<HistoryParserWorkerResponse>) => void) | null = null
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

const SAMPLE_VISIT: ChromiumHistoryVisit = {
  visitId: 1,
  urlId: 1,
  url: 'https://example.com/',
  domain: 'example.com',
  title: 'Example',
  visitTime: new Date('2024-01-01T00:00:00Z'),
  visitTimeRaw: '13345469600000000',
  visitCount: 1,
  typedCount: 0,
  transition: 0,
  fromVisit: null,
  visitDuration: 0,
  hidden: false,
  typed: false
}

async function latestWorker(): Promise<FakeWorker> {
  await vi.waitFor(() => {
    if (FakeWorker.instances.length === 0) throw new Error('worker not constructed yet')
  })
  return FakeWorker.instances.at(-1)!
}

function postedRequest(worker: FakeWorker, index = worker.posted.length - 1) {
  return worker.posted[index]!.data as HistoryParserWorkerRequest
}

describe('parseChromiumHistoryFile (Worker dispatch)', () => {
  afterEach(() => {
    FakeWorker.instances = []
    vi.unstubAllGlobals()
    vi.resetModules()
  })

  it('offloads parsing to a module Worker and resolves with its response', async () => {
    vi.stubGlobal('Worker', FakeWorker)
    const { parseChromiumHistoryFile } = await import('~/composables/useChromiumHistoryParser')
    const file = new File([new Uint8Array([1, 2, 3])], 'History')

    const promise = parseChromiumHistoryFile(file)
    const worker = await latestWorker()

    expect(worker.options?.type).toBe('module')
    expect(worker.posted).toHaveLength(1)
    const request = postedRequest(worker)
    expect(request.fileName).toBe('History')
    expect(worker.posted[0]!.transfer).toEqual([request.buffer])

    const response: HistoryParserWorkerResponse = {
      requestId: request.requestId,
      ok: true,
      visits: [SAMPLE_VISIT]
    }
    worker.onmessage?.({ data: response } as MessageEvent<HistoryParserWorkerResponse>)

    const result = await promise
    expect(result.fileName).toBe('History')
    expect(result.visits).toEqual([SAMPLE_VISIT])
    expect(worker.terminated).toBe(false)
  })

  it('rejects with the worker-reported message when parsing fails inside the worker', async () => {
    vi.stubGlobal('Worker', FakeWorker)
    const { parseChromiumHistoryFile } = await import('~/composables/useChromiumHistoryParser')
    const file = new File([new Uint8Array([1, 2, 3])], 'not-history')

    const promise = parseChromiumHistoryFile(file)
    const worker = await latestWorker()

    const response: HistoryParserWorkerResponse = {
      requestId: postedRequest(worker).requestId,
      ok: false,
      message: 'このファイルはChrome/Edgeの履歴データベース(History)ではないようです。'
    }
    worker.onmessage?.({ data: response } as MessageEvent<HistoryParserWorkerResponse>)

    await expect(promise).rejects.toThrow(
      'このファイルはChrome/Edgeの履歴データベース(History)ではないようです。'
    )
    expect(worker.terminated).toBe(false)
  })

  it('rejects and drops the shared worker when the worker itself errors', async () => {
    vi.stubGlobal('Worker', FakeWorker)
    const { parseChromiumHistoryFile } = await import('~/composables/useChromiumHistoryParser')
    const file = new File([new Uint8Array([1, 2, 3])], 'History')

    const promise = parseChromiumHistoryFile(file)
    const worker = await latestWorker()

    worker.onerror?.({ message: 'script load failed' } as ErrorEvent)

    await expect(promise).rejects.toThrow('script load failed')
    expect(worker.terminated).toBe(true)

    const nextPromise = parseChromiumHistoryFile(file)
    const nextWorker = await vi.waitFor(() => {
      const instance = FakeWorker.instances.at(-1)!
      if (instance === worker) throw new Error('worker was reused after erroring')
      return instance
    })
    nextWorker.onmessage?.({
      data: { requestId: postedRequest(nextWorker).requestId, ok: true, visits: [] }
    } as MessageEvent<HistoryParserWorkerResponse>)
    await nextPromise
  })
})
