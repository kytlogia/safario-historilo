import type {
  ChromiumHistoryVisit,
  FirefoxHistoryVisit,
  HistoryVisit,
  UnifiedHistorySource,
  UnifiedHistoryVisit
} from '~/types/history'

export const UNIFIED_HISTORY_SOURCES: UnifiedHistorySource[] = [
  'safari',
  'firefox',
  'chrome',
  'edge'
]

interface SourceMeta {
  label: string
  icon: string
  color: string
}

const SOURCE_META: Record<UnifiedHistorySource, SourceMeta> = {
  safari: { label: 'Safari', icon: 'mdi-compass-outline', color: 'primary' },
  firefox: { label: 'Firefox', icon: 'mdi-fire', color: 'orange' },
  chrome: { label: 'Chrome', icon: 'mdi-google-chrome', color: 'blue' },
  edge: { label: 'Edge', icon: 'mdi-microsoft-edge', color: 'teal' }
}

export function unifiedSourceMeta(source: UnifiedHistorySource): SourceMeta {
  return SOURCE_META[source]
}

export function toUnifiedSafariVisit(visit: HistoryVisit): UnifiedHistoryVisit {
  return {
    source: 'safari',
    sourceLabel: SOURCE_META.safari.label,
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
    sourceLabel: SOURCE_META.firefox.label,
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
    sourceLabel: SOURCE_META[brand].label,
    url: visit.url,
    domain: visit.domain,
    title: visit.title,
    visitTime: visit.visitTime,
    visitCount: visit.visitCount
  }
}
