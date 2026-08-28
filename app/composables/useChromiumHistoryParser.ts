import type { ChromiumHistoryVisit } from '~/types/history'
import { parseChromiumHistoryBuffer } from '~/utils/parseChromiumHistoryDatabase'
import { createHistoryFileParser } from './useHistoryFileParser'

// Shared by both Chrome and Edge pages since Chrome and Edge use an
// identical `urls`/`visits` schema — see parseChromiumHistoryDatabase.ts.
export const parseChromiumHistoryFile = createHistoryFileParser<ChromiumHistoryVisit>(
  'chromium',
  parseChromiumHistoryBuffer
)
