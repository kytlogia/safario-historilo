import { WORKER_CRASH_MESSAGES } from '~/utils/workerLocaleMessages'
import type { AppLocale } from '~/composables/useAppLocale'
import type {
  HistoryParserKind,
  HistoryParserWorkerRequest,
  HistoryParserWorkerResponse
} from './historyParser.worker'

// jsdom (used for unit/integration tests) doesn't implement Worker at all, and
// the real parsing logic runs directly under Node for some tests — in both
// cases `Worker` is undefined, so parseFile() below falls back to running
// parseBuffer() on the calling thread instead of off-loading to
// historyParser.worker.ts.
function supportsDedicatedWorker(): boolean {
  return typeof Worker !== 'undefined'
}

interface PendingRequest {
  resolve: (visits: unknown[]) => void
  reject: (error: Error) => void
  // The locale this specific request was made under — a worker crash
  // (onerror, below) is registered once per worker, not per request, but
  // still needs to reject each pending request in the language it was
  // actually issued under (not just whichever locale happened to be current
  // when the worker last crashed).
  locale: AppLocale
}

// One Worker instance per kind, created lazily and reused for every parse of
// that kind in the session (sql.js/wasm init inside the worker is itself
// cached by a module-scope singleton — see getSqlJs() in
// parseHistoryDatabase.ts — and that cache only survives as long as the
// worker does). Keyed by kind rather than a single shared instance so
// Safari/Firefox/Chromium can still parse concurrently — e.g.
// app/pages/all.vue loads all four sources independently; Chrome and Edge
// already intentionally share one 'chromium' worker via
// useChromiumHistoryParser.ts.
const sharedWorkers = new Map<HistoryParserKind, Worker>()
const pendingRequestsByKind = new Map<HistoryParserKind, Map<number, PendingRequest>>()
let nextRequestId = 0

function getWorker(kind: HistoryParserKind): Worker {
  const existing = sharedWorkers.get(kind)
  if (existing) return existing

  const pendingRequests = new Map<number, PendingRequest>()
  pendingRequestsByKind.set(kind, pendingRequests)

  const worker = new Worker(new URL('./historyParser.worker.ts', import.meta.url), {
    type: 'module'
  })

  worker.onmessage = (event: MessageEvent<HistoryParserWorkerResponse>) => {
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
    sharedWorkers.delete(kind)
    worker.terminate()

    for (const pending of pendingRequests.values()) {
      const error =
        event.error instanceof Error
          ? event.error
          : new Error(event.message || WORKER_CRASH_MESSAGES[kind][pending.locale])
      pending.reject(error)
    }
    pendingRequests.clear()
  }

  sharedWorkers.set(kind, worker)
  return worker
}

function parseViaWorker<V>(
  kind: HistoryParserKind,
  buffer: ArrayBuffer,
  fileName: string,
  locale: AppLocale
): Promise<{ visits: V[]; fileName: string }> {
  return new Promise((resolve, reject) => {
    const worker = getWorker(kind)
    const requestId = nextRequestId++

    pendingRequestsByKind.get(kind)!.set(requestId, {
      resolve: (visits) => resolve({ visits: visits as V[], fileName }),
      reject,
      locale
    })

    const request: HistoryParserWorkerRequest = { requestId, kind, buffer, fileName, locale }
    worker.postMessage(request, [buffer])
  })
}

/**
 * Builds a `parseXHistoryFile(file, locale)` loader for one browser's history
 * format. Shared by useSafariHistoryParser.ts / useFirefoxHistoryParser.ts /
 * useChromiumHistoryParser.ts, which used to each duplicate this
 * worker-dispatch/fallback/crash-recovery logic wholesale — see issue #154.
 * `parseBuffer` is the same-thread fallback used when Worker isn't available
 * (tests, or environments without dedicated worker support).
 */
export function createHistoryFileParser<V>(
  kind: HistoryParserKind,
  parseBuffer: (
    buffer: ArrayBuffer,
    fileName: string,
    locale: AppLocale
  ) => Promise<{ visits: V[]; fileName: string }>
) {
  return async function parseFile(
    file: File,
    locale: AppLocale = 'ja'
  ): Promise<{ visits: V[]; fileName: string }> {
    const buffer = await file.arrayBuffer()

    if (supportsDedicatedWorker()) {
      return parseViaWorker<V>(kind, buffer, file.name, locale)
    }

    return parseBuffer(buffer, file.name, locale)
  }
}
