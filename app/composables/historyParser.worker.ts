import { parseHistoryBuffer } from '~/utils/parseHistoryDatabase'
import { parseFirefoxHistoryBuffer } from '~/utils/parseFirefoxHistoryDatabase'
import { parseChromiumHistoryBuffer } from '~/utils/parseChromiumHistoryDatabase'
import { parseNetscapeHistoryBuffer } from '~/utils/parseNetscapeHistoryDatabase'
import { normalizeError } from '~/utils/error-reporting'
import type {
  ChromiumHistoryVisit,
  FirefoxHistoryVisit,
  HistoryVisit,
  NetscapeHistoryVisit
} from '~/types/history'
import type { ParserBrand } from '~/utils/workerLocaleMessages'
import type { AppLocale } from '~/composables/useAppLocale'

// Same set as the localized message maps in workerLocaleMessages.ts —
// useHistoryFileParser.ts indexes WORKER_CRASH_MESSAGES by this kind, so the
// two must stay in lockstep.
export type HistoryParserKind = ParserBrand

// A single Worker instance is reused across parses per kind (see getWorker()
// in useHistoryFileParser.ts) and can therefore receive several requests
// before the first one's response comes back, so responses carry the
// requestId of the request they answer. `kind` selects which browser's
// SQL schema/parsing logic this message should run — see
// useSafariHistoryParser.ts / useFirefoxHistoryParser.ts /
// useChromiumHistoryParser.ts, now thin wrappers around this shared worker
// (see issue #154).
export interface HistoryParserWorkerRequest {
  requestId: number
  kind: HistoryParserKind
  buffer: ArrayBuffer
  fileName: string
  locale: AppLocale
}

export type HistoryParserWorkerResponse =
  | {
      requestId: number
      ok: true
      visits:
        HistoryVisit[] | FirefoxHistoryVisit[] | ChromiumHistoryVisit[] | NetscapeHistoryVisit[]
    }
  | { requestId: number; ok: false; message: string }

function parseBuffer(
  kind: HistoryParserKind,
  buffer: ArrayBuffer,
  fileName: string,
  locale: AppLocale
) {
  switch (kind) {
    case 'safari':
      return parseHistoryBuffer(buffer, fileName, locale)
    case 'firefox':
      return parseFirefoxHistoryBuffer(buffer, fileName, locale)
    case 'chromium':
      return parseChromiumHistoryBuffer(buffer, fileName, locale)
    case 'netscape':
      return parseNetscapeHistoryBuffer(buffer, fileName, locale)
  }
}

self.onmessage = async (event: MessageEvent<HistoryParserWorkerRequest>) => {
  // Read defensively before the try block: if event.data itself turned out to
  // be malformed, we still want requestId (when present) so the main thread's
  // matching pending call can be rejected instead of hanging forever — a throw
  // from an async event handler becomes an unhandled rejection in the worker's
  // scope, not the `error` event the main thread listens for. Guarded here
  // (before the try, not just in the catch) so a malformed request without a
  // usable requestId can't reach the success path either and post a response
  // the main thread has no pending call to match it against.
  const requestId = event.data?.requestId
  if (typeof requestId !== 'number') return

  try {
    const { kind, buffer, fileName, locale } = event.data
    const result = await parseBuffer(kind, buffer, fileName, locale)
    const response: HistoryParserWorkerResponse = {
      requestId,
      ok: true,
      visits: result.visits
    }
    self.postMessage(response)
  } catch (err) {
    const response: HistoryParserWorkerResponse = {
      requestId,
      ok: false,
      message: normalizeError(err).message
    }
    self.postMessage(response)
  }
}
