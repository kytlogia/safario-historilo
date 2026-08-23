import type { FirefoxHistoryVisit, ParsedFirefoxHistory } from '~/types/history'
import { parseFirefoxHistoryBuffer } from '~/utils/parseFirefoxHistoryDatabase'
import type {
  FirefoxHistoryDatabaseWorkerRequest,
  FirefoxHistoryDatabaseWorkerResponse
} from './firefoxHistoryDatabase.worker'

// jsdom (used for unit/integration tests) doesn't implement Worker at all, and
// the real parsing logic runs directly under Node for some tests — in both
// cases `Worker` is undefined, so this falls back to running
// parseFirefoxHistoryBuffer() on the calling thread instead of off-loading to
// firefoxHistoryDatabase.worker.ts. Mirrors useSafariHistoryParser.ts.
function supportsDedicatedWorker(): boolean {
  return typeof Worker !== 'undefined'
}

interface PendingRequest {
  resolve: (visits: FirefoxHistoryVisit[]) => void
  reject: (error: Error) => void
}

// A single Worker is created lazily and reused for every parse in the session
// — see the equivalent comment in useSafariHistoryParser.ts for why.
let sharedWorker: Worker | null = null
let nextRequestId = 0
const pendingRequests = new Map<number, PendingRequest>()

function getWorker(): Worker {
  if (sharedWorker) return sharedWorker

  const worker = new Worker(new URL('./firefoxHistoryDatabase.worker.ts', import.meta.url), {
    type: 'module'
  })

  worker.onmessage = (event: MessageEvent<FirefoxHistoryDatabaseWorkerResponse>) => {
    const data = event.data
    const pending = pendingRequests.get(data.requestId)
    if (!pending) return
    pendingRequests.delete(data.requestId)

    if (data.ok) {
      pending.resolve(data.visits)
    } else {
      pending.reject(new Error(data.message))
    }
  }

  worker.onerror = (event) => {
    // The worker's own module scope may now be unusable (e.g. a script/import
    // error) — drop it and terminate rather than keep dispatching new requests
    // to a possibly-broken instance; the next call spins up a fresh one.
    sharedWorker = null
    worker.terminate()

    const error =
      event.error instanceof Error
        ? event.error
        : new Error(event.message || 'places.sqliteの解析中にエラーが発生しました。')
    for (const pending of pendingRequests.values()) {
      pending.reject(error)
    }
    pendingRequests.clear()
  }

  sharedWorker = worker
  return worker
}

function parseViaWorker(buffer: ArrayBuffer, fileName: string): Promise<ParsedFirefoxHistory> {
  return new Promise((resolve, reject) => {
    const worker = getWorker()
    const requestId = nextRequestId++

    pendingRequests.set(requestId, {
      resolve: (visits) => resolve({ visits, fileName }),
      reject
    })

    const request: FirefoxHistoryDatabaseWorkerRequest = { requestId, buffer, fileName }
    worker.postMessage(request, [buffer])
  })
}

export async function parseFirefoxHistoryFile(file: File): Promise<ParsedFirefoxHistory> {
  const buffer = await file.arrayBuffer()

  if (supportsDedicatedWorker()) {
    return parseViaWorker(buffer, file.name)
  }

  return parseFirefoxHistoryBuffer(buffer, file.name)
}
