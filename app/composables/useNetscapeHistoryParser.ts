import type { NetscapeHistoryVisit } from '~/types/history'
import { parseNetscapeHistoryBuffer } from '~/utils/parseNetscapeHistoryDatabase'
import { createHistoryFileParser } from './useHistoryFileParser'

export const parseNetscapeHistoryFile = createHistoryFileParser<NetscapeHistoryVisit>(
  'netscape',
  parseNetscapeHistoryBuffer
)
