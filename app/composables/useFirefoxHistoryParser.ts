import type { FirefoxHistoryVisit } from '~/types/history'
import { parseFirefoxHistoryBuffer } from '~/utils/parseFirefoxHistoryDatabase'
import { createHistoryFileParser } from './useHistoryFileParser'

export const parseFirefoxHistoryFile = createHistoryFileParser<FirefoxHistoryVisit>(
  'firefox',
  parseFirefoxHistoryBuffer
)
