import { parseHistoryBuffer } from '~/utils/parseHistoryDatabase'
import type { ParsedHistory } from '~/types/history'

export interface HistoryDatabaseWorkerRequest {
  buffer: ArrayBuffer
  fileName: string
}

export type HistoryDatabaseWorkerResponse =
  { ok: true; visits: ParsedHistory['visits']; fileName: string } | { ok: false; message: string }

self.onmessage = async (event: MessageEvent<HistoryDatabaseWorkerRequest>) => {
  const { buffer, fileName } = event.data

  try {
    const result = await parseHistoryBuffer(buffer, fileName)
    const response: HistoryDatabaseWorkerResponse = {
      ok: true,
      visits: result.visits,
      fileName: result.fileName
    }
    self.postMessage(response)
  } catch (err) {
    const response: HistoryDatabaseWorkerResponse = {
      ok: false,
      message: err instanceof Error ? err.message : '不明なエラーが発生しました。'
    }
    self.postMessage(response)
  }
}
