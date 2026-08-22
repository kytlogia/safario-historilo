import type { ParsedHistory } from '~/types/history'
import { parseHistoryBuffer } from '~/utils/parseHistoryDatabase'
import type {
  HistoryDatabaseWorkerRequest,
  HistoryDatabaseWorkerResponse
} from './historyDatabase.worker'

// jsdom (used for unit/integration tests) doesn't implement Worker at all, and
// the real parsing logic runs directly under Node for some tests (see
// useSafariHistoryParser.test.ts) — in both cases `Worker` is undefined, so this
// falls back to running parseHistoryBuffer() on the calling thread instead of
// off-loading to historyDatabase.worker.ts.
function supportsDedicatedWorker(): boolean {
  return typeof Worker !== 'undefined'
}

function parseViaWorker(buffer: ArrayBuffer, fileName: string): Promise<ParsedHistory> {
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL('./historyDatabase.worker.ts', import.meta.url), {
      type: 'module'
    })

    worker.onmessage = (event: MessageEvent<HistoryDatabaseWorkerResponse>) => {
      worker.terminate()
      const data = event.data
      if (data.ok) {
        resolve({ visits: data.visits, fileName: data.fileName })
      } else {
        reject(new Error(data.message))
      }
    }

    worker.onerror = (event) => {
      worker.terminate()
      reject(
        event.error instanceof Error
          ? event.error
          : new Error(event.message || 'History.dbの解析中にエラーが発生しました。')
      )
    }

    const request: HistoryDatabaseWorkerRequest = { buffer, fileName }
    worker.postMessage(request, [buffer])
  })
}

export async function parseSafariHistoryFile(file: File): Promise<ParsedHistory> {
  const buffer = await file.arrayBuffer()

  if (supportsDedicatedWorker()) {
    return parseViaWorker(buffer, file.name)
  }

  return parseHistoryBuffer(buffer, file.name)
}
