import { parseHistoryBuffer } from '~/utils/parseHistoryDatabase'
import { normalizeError } from '~/utils/error-reporting'
import type { HistoryVisit } from '~/types/history'
import type { AppLocale } from '~/composables/useAppLocale'

// A single Worker instance is reused across parses (see getWorker() in
// useSafariHistoryParser.ts) and can therefore receive several requests before
// the first one's response comes back, so responses carry the requestId of the
// request they answer.
export interface HistoryDatabaseWorkerRequest {
  requestId: number
  buffer: ArrayBuffer
  fileName: string
  locale: AppLocale
}

export type HistoryDatabaseWorkerResponse =
  | { requestId: number; ok: true; visits: HistoryVisit[] }
  | { requestId: number; ok: false; message: string }

self.onmessage = async (event: MessageEvent<HistoryDatabaseWorkerRequest>) => {
  // Read defensively before the try block: if event.data itself turned out to
  // be malformed, we still want requestId (when present) so the main thread's
  // matching pending call can be rejected instead of hanging forever — a throw
  // from an async event handler becomes an unhandled rejection in the worker's
  // scope, not the `error` event the main thread listens for.
  const requestId = event.data?.requestId

  try {
    const { buffer, fileName, locale } = event.data
    const result = await parseHistoryBuffer(buffer, fileName, locale)
    const response: HistoryDatabaseWorkerResponse = {
      requestId,
      ok: true,
      visits: result.visits
    }
    self.postMessage(response)
  } catch (err) {
    if (requestId === undefined) return
    const response: HistoryDatabaseWorkerResponse = {
      requestId,
      ok: false,
      message: normalizeError(err).message
    }
    self.postMessage(response)
  }
}
