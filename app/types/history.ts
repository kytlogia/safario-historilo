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

export interface DomainSummary {
  domain: string
  visitCount: number
}

export interface ParsedHistory {
  visits: HistoryVisit[]
  fileName: string
}
