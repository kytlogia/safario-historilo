import { afterEach, describe, expect, it, vi } from 'vitest'

// jsdom (this file's default environment) has no real Worker implementation,
// so this stubs `Worker` to verify createHistoryFileParser()'s per-kind
// worker pooling in isolation from the actual sql.js parsing (covered
// elsewhere by useSafariHistoryParser.worker.test.ts and friends). This
// property matters because app/pages/all.vue loads Safari/Firefox/Chrome/Edge
// independently — a single Worker shared across every kind would serialize
// their parsing instead of letting different browsers' history files parse
// concurrently (see issue #154).

class FakeWorker {
  static instances: FakeWorker[] = []

  onmessage: ((event: MessageEvent<unknown>) => void) | null = null
  onerror: ((event: ErrorEvent) => void) | null = null
  posted: unknown[] = []

  constructor(
    public url: string | URL,
    public options?: WorkerOptions
  ) {
    FakeWorker.instances.push(this)
  }

  postMessage(data: unknown) {
    this.posted.push(data)
  }

  terminate() {}
}

afterEach(() => {
  FakeWorker.instances = []
  vi.unstubAllGlobals()
  vi.resetModules()
})

describe('createHistoryFileParser (per-kind worker pooling)', () => {
  it('uses a separate Worker instance per kind instead of one shared across all kinds', async () => {
    vi.stubGlobal('Worker', FakeWorker)
    const { createHistoryFileParser } = await import('~/composables/useHistoryFileParser')

    const fallback = async (_buffer: ArrayBuffer, fileName: string) => ({ visits: [], fileName })
    const parseSafari = createHistoryFileParser('safari', fallback)
    const parseFirefox = createHistoryFileParser('firefox', fallback)

    void parseSafari(new File([new Uint8Array([1])], 'History.db'))
    void parseFirefox(new File([new Uint8Array([2])], 'places.sqlite'))

    await vi.waitFor(() => {
      expect(FakeWorker.instances).toHaveLength(2)
    })
  })

  it('reuses the same Worker instance across multiple parses of the same kind', async () => {
    vi.stubGlobal('Worker', FakeWorker)
    const { createHistoryFileParser } = await import('~/composables/useHistoryFileParser')

    const fallback = async (_buffer: ArrayBuffer, fileName: string) => ({ visits: [], fileName })
    const parseSafari = createHistoryFileParser('safari', fallback)

    void parseSafari(new File([new Uint8Array([1])], 'a.db'))
    await vi.waitFor(() => {
      expect(FakeWorker.instances).toHaveLength(1)
    })

    void parseSafari(new File([new Uint8Array([2])], 'b.db'))
    await vi.waitFor(() => {
      expect(FakeWorker.instances[0]!.posted).toHaveLength(2)
    })
    expect(FakeWorker.instances).toHaveLength(1)
  })
})
