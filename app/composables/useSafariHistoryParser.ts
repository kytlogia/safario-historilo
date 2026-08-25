import type { HistoryVisit, ParsedHistory } from '~/types/history'
import { parseHistoryBuffer } from '~/utils/parseHistoryDatabase'
import type { AppLocale } from '~/composables/useAppLocale'
import type {
  HistoryDatabaseWorkerRequest,
  HistoryDatabaseWorkerResponse
} from './historyDatabase.worker'

const WORKER_CRASH_MESSAGES: Record<AppLocale, string> = {
  ja: 'History.dbの解析中にエラーが発生しました。',
  en: 'An error occurred while parsing History.db.',
  zh: '解析 History.db 时发生错误。'
}

// Tracks the locale most recently passed to parseSafariHistoryFile() so the
// shared worker's onerror handler (set up once, not per-request — see
// getWorker() below) can still report in the right language even though it
// has no request of its own to read a locale from.
let lastLocale: AppLocale = 'ja'

// jsdom (used for unit/integration tests) doesn't implement Worker at all, and
// the real parsing logic runs directly under Node for some tests (see
// useSafariHistoryParser.test.ts) — in both cases `Worker` is undefined, so this
// falls back to running parseHistoryBuffer() on the calling thread instead of
// off-loading to historyDatabase.worker.ts.
function supportsDedicatedWorker(): boolean {
  return typeof Worker !== 'undefined'
}

interface PendingRequest {
  resolve: (visits: HistoryVisit[]) => void
  reject: (error: Error) => void
}

// A single Worker is created lazily and reused for every parse in the session,
// rather than one per call: sql.js/wasm initialization inside the worker is
// itself cached by a module-scope singleton (see getSqlJs() in
// parseHistoryDatabase.ts), and that cache only survives as long as the worker
// does. Spinning up (and terminating) a fresh worker per call would silently
// discard that cache and re-pay the full init cost on every file load.
let sharedWorker: Worker | null = null
let nextRequestId = 0
const pendingRequests = new Map<number, PendingRequest>()

function getWorker(): Worker {
  if (sharedWorker) return sharedWorker

  const worker = new Worker(new URL('./historyDatabase.worker.ts', import.meta.url), {
    type: 'module'
  })

  worker.onmessage = (event: MessageEvent<HistoryDatabaseWorkerResponse>) => {
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
        : new Error(event.message || WORKER_CRASH_MESSAGES[lastLocale])
    for (const pending of pendingRequests.values()) {
      pending.reject(error)
    }
    pendingRequests.clear()
  }

  sharedWorker = worker
  return worker
}

function parseViaWorker(
  buffer: ArrayBuffer,
  fileName: string,
  locale: AppLocale
): Promise<ParsedHistory> {
  return new Promise((resolve, reject) => {
    const worker = getWorker()
    const requestId = nextRequestId++

    pendingRequests.set(requestId, {
      resolve: (visits) => resolve({ visits, fileName }),
      reject
    })

    const request: HistoryDatabaseWorkerRequest = { requestId, buffer, fileName, locale }
    worker.postMessage(request, [buffer])
  })
}

export async function parseSafariHistoryFile(
  file: File,
  locale: AppLocale = 'ja'
): Promise<ParsedHistory> {
  lastLocale = locale
  const buffer = await file.arrayBuffer()

  if (supportsDedicatedWorker()) {
    return parseViaWorker(buffer, file.name, locale)
  }

  return parseHistoryBuffer(buffer, file.name, locale)
}
