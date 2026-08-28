import type {
  ChromiumHistoryVisit,
  FirefoxHistoryVisit,
  HistoryVisit,
  UnifiedHistorySource,
  UnifiedHistoryVisit
} from '~/types/history'
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

export function toUnifiedSafariVisit(visit: HistoryVisit): UnifiedHistoryVisit {
  return {
    source: 'safari',
    sourceLabel: browserCatalogEntry('safari').label,
    url: visit.url,
    domain: visit.domain,
    title: visit.title,
    visitTime: visit.visitTime,
    visitCount: visit.visitCount
  }
}

export function toUnifiedFirefoxVisit(visit: FirefoxHistoryVisit): UnifiedHistoryVisit {
  return {
    source: 'firefox',
    sourceLabel: browserCatalogEntry('firefox').label,
    url: visit.url,
    domain: visit.domain,
    title: visit.title,
    visitTime: visit.visitTime,
    visitCount: visit.visitCount
  }
}

// Chrome and Edge share the exact same visit shape (both Chromium-based),
// differing only in which brand produced the file — see
// server/utils/chromium-history-store.ts / app/composables/useChromiumHistoryPage.ts
// for the same 'chrome' | 'edge' split.
export function toUnifiedChromiumVisit(
  visit: ChromiumHistoryVisit,
  brand: 'chrome' | 'edge'
): UnifiedHistoryVisit {
  return {
    source: brand,
    sourceLabel: browserCatalogEntry(brand).label,
    url: visit.url,
    domain: visit.domain,
    title: visit.title,
    visitTime: visit.visitTime,
    visitCount: visit.visitCount
  }
}
