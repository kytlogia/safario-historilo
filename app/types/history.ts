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
  visitTimeRaw: number
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

export type { SafariProfile, FirefoxProfile, ChromiumProfile } from '../../shared/types/profile'
