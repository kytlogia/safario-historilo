import type { UnifiedHistorySource, UnifiedHistoryVisit } from '~/types/history'
import { BROWSER_CATALOG, browserCatalogEntry } from './browserCatalog'

export const UNIFIED_HISTORY_SOURCES: UnifiedHistorySource[] = BROWSER_CATALOG.map((b) => b.id)

interface SourceMeta {
  label: string
  icon: string
  color: string
}

export function unifiedSourceMeta(source: UnifiedHistorySource): SourceMeta {
  const { label, icon, color } = browserCatalogEntry(source)
  return { label, icon, color }
}

// Every per-brand visit type (HistoryVisit/FirefoxHistoryVisit/
// ChromiumHistoryVisit) carries these five fields with the same names — the
// projection down to UnifiedHistoryVisit only needs them, so one generic
// function covers Safari/Firefox/Chrome/Edge instead of a near-identical
// toUnifiedXVisit() per brand. `source` alone now also determines
// `sourceLabel` (via browserCatalogEntry), including the Chrome/Edge split
// that used to be a separate `brand` parameter.
export function toUnifiedVisit<
  V extends { url: string; domain: string; title: string; visitTime: Date; visitCount: number }
>(visit: V, source: UnifiedHistorySource): UnifiedHistoryVisit {
  return {
    source,
    sourceLabel: browserCatalogEntry(source).label,
    url: visit.url,
    domain: visit.domain,
    title: visit.title,
    visitTime: visit.visitTime,
    visitCount: visit.visitCount
  }
}
