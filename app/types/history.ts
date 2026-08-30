export interface HistoryVisit {
  visitId: number
  itemId: number
  url: string
  domain: string
  title: string
  visitTime: Date
  visitTimeRaw: number
  visitCount: number
  domainExpansion: string | null
  statusCode: number
  loadSuccessful: boolean
  httpNonGet: boolean
  synthesized: boolean
  redirectSource: number | null
  redirectDestination: number | null
  origin: number
  generation: number
  attributes: number
  score: number
}

export interface FirefoxHistoryVisit {
  visitId: number
  placeId: number
  url: string
  domain: string
  title: string
  visitTime: Date
  visitTimeRaw: number
  visitCount: number
  visitType: number
  fromVisit: number | null
  session: number
  hidden: boolean
  typed: boolean
  frecency: number
  guid: string
}

export interface DomainSummary {
  domain: string
  visitCount: number
}

export interface ParsedHistory {
  visits: HistoryVisit[]
  fileName: string
}

export interface ParsedFirefoxHistory {
  visits: FirefoxHistoryVisit[]
  fileName: string
}

export interface ChromiumHistoryVisit {
  visitId: number
  urlId: number
  url: string
  domain: string
  title: string
  visitTime: Date
  /**
   * The exact WebKit-epoch microsecond value as a decimal string. Chrome's
   * visit_time values are large enough (~1.3e16+) to exceed
   * Number.MAX_SAFE_INTEGER, so this is kept as a string (round-tripped via
   * SQLite's own TEXT cast, never through a JS Number) rather than losing
   * precision — see parseChromiumHistoryDatabase.ts.
   */
  visitTimeRaw: string
  visitCount: number
  typedCount: number
  transition: number
  fromVisit: number | null
  visitDuration: number
  hidden: boolean
  typed: boolean
}

export interface ParsedChromiumHistory {
  visits: ChromiumHistoryVisit[]
  fileName: string
}

/**
 * One row of Netscape Navigator 9's Mork `history.dat`. Unlike every other
 * browser here, that file stores one record *per URL* (with its own
 * first/last visit dates and visit count) rather than one row per visit, so
 * `visitTime` is the URL's last visit and there is no per-visit id — the
 * Mork row id stands in for it.
 */
export interface NetscapeHistoryVisit {
  rowId: string
  url: string
  domain: string
  title: string
  visitTime: Date
  /** LastVisitDate, in microseconds since the Unix epoch (Mozilla PRTime). */
  visitTimeRaw: number
  firstVisitTime: Date | null
  firstVisitTimeRaw: number
  visitCount: number
  referrer: string
  hostname: string
  hidden: boolean
  typed: boolean
}

export interface ParsedNetscapeHistory {
  visits: NetscapeHistoryVisit[]
  fileName: string
}

export type UnifiedHistorySource =
  'safari' | 'firefox' | 'chrome' | 'edge' | 'opera' | 'arc' | 'brave' | 'vivaldi' | 'netscape'

/**
 * Common minimal shape used by the cross-browser search page (app/pages/all.vue)
 * to search/filter/list visits from Safari/Firefox/Chrome/Edge together. Each
 * source-specific visit type carries far more fields than this — see
 * app/utils/unifiedHistory.ts for the per-source conversion functions.
 */
export interface UnifiedHistoryVisit {
  source: UnifiedHistorySource
  sourceLabel: string
  url: string
  domain: string
  title: string
  visitTime: Date
  visitCount: number
}

export type { SafariProfile, FirefoxProfile, ChromiumProfile } from '../../shared/types/profile'
