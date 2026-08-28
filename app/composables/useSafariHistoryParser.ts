import type { HistoryVisit } from '~/types/history'
import { parseHistoryBuffer } from '~/utils/parseHistoryDatabase'
import { createHistoryFileParser } from './useHistoryFileParser'

export const parseSafariHistoryFile = createHistoryFileParser<HistoryVisit>(
  'safari',
  parseHistoryBuffer
)
