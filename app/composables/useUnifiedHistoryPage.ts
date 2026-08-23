import { computed, ref } from 'vue'
import type {
  ChromiumHistoryVisit,
  ChromiumProfile,
  FirefoxHistoryVisit,
  FirefoxProfile,
  HistoryVisit,
  SafariProfile,
  UnifiedHistorySource,
  UnifiedHistoryVisit
} from '~/types/history'
import {
  toUnifiedChromiumVisit,
  toUnifiedFirefoxVisit,
  toUnifiedSafariVisit,
  UNIFIED_HISTORY_SOURCES
} from '~/utils/unifiedHistory'
import { DEFAULT_PROFILE_ID } from '../../shared/utils/profile'
import { useDebouncedRef } from './useDebouncedRef'
import { parseChromiumHistoryFile } from './useChromiumHistoryParser'
import { parseFirefoxHistoryFile } from './useFirefoxHistoryParser'
import { parseSafariHistoryFile } from './useSafariHistoryParser'
import { useUnifiedHistoryFilters } from './useUnifiedHistoryFilters'
import { useUnifiedHistorySource } from './useUnifiedHistorySource'

function pickDefaultProfileId(profiles: { id: string; isDefault: boolean }[]): string {
  const defaultProfile = profiles.find((p) => p.isDefault) ?? profiles[0]
  return defaultProfile?.id ?? ''
}

/**
 * Orchestrates the cross-browser search page (app/pages/all.vue): loads
 * Safari/Firefox/Chrome/Edge independently via four useUnifiedHistorySource()
 * instances, combines their visits into one UnifiedHistoryVisit[], and
 * applies search/domain/date/source filtering across the combined list.
 */
export function useUnifiedHistoryPage() {
  const safari = useUnifiedHistorySource<HistoryVisit, SafariProfile>({
    apiBase: '/api/local-history',
    serverFileName: 'History.db',
    parseFile: parseSafariHistoryFile,
    toUnified: toUnifiedSafariVisit,
    initialProfileId: DEFAULT_PROFILE_ID,
    loadErrorFallback: 'History.db の自動読み込みに失敗しました。'
  })

  const firefox = useUnifiedHistorySource<FirefoxHistoryVisit, FirefoxProfile>({
    apiBase: '/api/local-history/firefox',
    serverFileName: 'places.sqlite',
    parseFile: parseFirefoxHistoryFile,
    toUnified: toUnifiedFirefoxVisit,
    resolveDefaultProfileId: pickDefaultProfileId,
    loadErrorFallback: 'places.sqlite の自動読み込みに失敗しました。'
  })

  const chrome = useUnifiedHistorySource<ChromiumHistoryVisit, ChromiumProfile>({
    apiBase: '/api/local-history/chrome',
    serverFileName: 'History',
    parseFile: parseChromiumHistoryFile,
    toUnified: (v) => toUnifiedChromiumVisit(v, 'chrome'),
    resolveDefaultProfileId: pickDefaultProfileId,
    loadErrorFallback: 'History の自動読み込みに失敗しました。'
  })

  const edge = useUnifiedHistorySource<ChromiumHistoryVisit, ChromiumProfile>({
    apiBase: '/api/local-history/edge',
    serverFileName: 'History',
    parseFile: parseChromiumHistoryFile,
    toUnified: (v) => toUnifiedChromiumVisit(v, 'edge'),
    resolveDefaultProfileId: pickDefaultProfileId,
    loadErrorFallback: 'History の自動読み込みに失敗しました。'
  })

  const visits = computed<UnifiedHistoryVisit[]>(() => [
    ...safari.unifiedVisits.value,
    ...firefox.unifiedVisits.value,
    ...chrome.unifiedVisits.value,
    ...edge.unifiedVisits.value
  ])

  const hasData = computed(
    () =>
      safari.hasData.value || firefox.hasData.value || chrome.hasData.value || edge.hasData.value
  )

  const search = ref('')
  const { debounced: debouncedSearch, reset: resetDebouncedSearch } = useDebouncedRef(search, 200)
  const domainFilter = ref<string | null>(null)
  const dateFrom = ref<Date | null>(null)
  const dateTo = ref<Date | null>(null)
  const enabledSources = ref<UnifiedHistorySource[]>([...UNIFIED_HISTORY_SOURCES])

  const { domainOptions, filteredVisits, topDomains, dateRangeLabel } = useUnifiedHistoryFilters(
    visits,
    { search: debouncedSearch, domainFilter, dateFrom, dateTo, enabledSources }
  )

  const uniqueUrlCount = computed(() => new Set(visits.value.map((v) => v.url)).size)
  const uniqueDomainCount = computed(() => new Set(visits.value.map((v) => v.domain)).size)

  const selectedVisit = ref<UnifiedHistoryVisit | null>(null)
  const detailDialog = ref(false)

  function openDetail(visit: UnifiedHistoryVisit) {
    selectedVisit.value = visit
    detailDialog.value = true
  }

  function resetFilters() {
    search.value = ''
    resetDebouncedSearch()
    domainFilter.value = null
    dateFrom.value = null
    dateTo.value = null
    enabledSources.value = [...UNIFIED_HISTORY_SOURCES]
  }

  return {
    safari,
    firefox,
    chrome,
    edge,
    visits,
    hasData,
    search,
    domainFilter,
    dateFrom,
    dateTo,
    enabledSources,
    domainOptions,
    filteredVisits,
    topDomains,
    dateRangeLabel,
    uniqueUrlCount,
    uniqueDomainCount,
    selectedVisit,
    detailDialog,
    openDetail,
    resetFilters
  }
}
