import { parseChromiumHistoryBuffer } from '~/utils/parseChromiumHistoryDatabase'
import { normalizeError } from '~/utils/error-reporting'
import type { ChromiumHistoryVisit } from '~/types/history'

// A single Worker instance is reused across parses (see getWorker() in
// useChromiumHistoryParser.ts) and can therefore receive several requests
// before the first one's response comes back, so responses carry the
// requestId of the request they answer.
export interface ChromiumHistoryDatabaseWorkerRequest {
  requestId: number
  buffer: ArrayBuffer
  fileName: string
}

export type ChromiumHistoryDatabaseWorkerResponse =
  | { requestId: number; ok: true; visits: ChromiumHistoryVisit[] }
  | { requestId: number; ok: false; message: string }

self.onmessage = async (event: MessageEvent<ChromiumHistoryDatabaseWorkerRequest>) => {
  // Read defensively before the try block: if event.data itself turned out to
  // be malformed, we still want requestId (when present) so the main thread's
  // matching pending call can be rejected instead of hanging forever — a throw
  // from an async event handler becomes an unhandled rejection in the worker's
  // scope, not the `error` event the main thread listens for.
  const requestId = event.data?.requestId

  try {
    const { buffer, fileName } = event.data
    const result = await parseChromiumHistoryBuffer(buffer, fileName)
    const response: ChromiumHistoryDatabaseWorkerResponse = {
      requestId,
      ok: true,
      visits: result.visits
    }
    self.postMessage(response)
  } catch (err) {
    if (requestId === undefined) return
    const response: ChromiumHistoryDatabaseWorkerResponse = {
      requestId,
      ok: false,
      message: normalizeError(err).message
    }
    self.postMessage(response)
  }
}
