import { computed, ref } from 'vue'
import { formatDate } from '~/utils/format'
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
import {
  filterField,
  nullableDateCodec,
  nullableStringCodec,
  stringArrayCodec,
  stringCodec,
  useFilterPersistence
} from './useFilterPersistence'
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

  // Each source's own visits already arrive sorted (visit_time DESC, see the
  // per-brand SQL), but concatenating four independently-sorted arrays does
  // not itself produce a sorted result — re-sort the merged list so /all
  // actually reads as one interleaved timeline instead of "all of Safari,
  // then all of Firefox, ...".
  const visits = computed<UnifiedHistoryVisit[]>(() =>
    [
      ...safari.unifiedVisits.value,
      ...firefox.unifiedVisits.value,
      ...chrome.unifiedVisits.value,
      ...edge.unifiedVisits.value
    ].sort((a, b) => b.visitTime.getTime() - a.visitTime.getTime())
  )

  const hasData = computed(
    () =>
      safari.hasData.value || firefox.hasData.value || chrome.hasData.value || edge.hasData.value
  )

  const search = ref('')
  const domainFilter = ref<string | null>(null)
  const dateFrom = ref<Date | null>(null)
  const dateTo = ref<Date | null>(null)
  const enabledSources = ref<UnifiedHistorySource[]>([...UNIFIED_HISTORY_SOURCES])

  useFilterPersistence('unified-history-filters', {
    search: filterField(search, stringCodec),
    domainFilter: filterField(domainFilter, nullableStringCodec),
    dateFrom: filterField(dateFrom, nullableDateCodec),
    dateTo: filterField(dateTo, nullableDateCodec),
    enabledSources: filterField(enabledSources, stringArrayCodec(UNIFIED_HISTORY_SOURCES))
  })

  const { debounced: debouncedSearch, reset: resetDebouncedSearch } = useDebouncedRef(search, 200)

  const { domainOptions, filteredVisits, topDomains, weekdayTrend, hourlyTrend } =
    useUnifiedHistoryFilters(visits, {
      search: debouncedSearch,
      domainFilter,
      dateFrom,
      dateTo,
      enabledSources
    })

  // useVisitFilterEngine's own dateRangeLabel deliberately ignores every
  // filter (search/domain/date) and always spans *all* loaded visits — see
  // useVisitFilterEngine.ts. /all adds a filter no single-browser page has,
  // though: whole sources can be switched off via enabledSources. Left as
  // useVisitFilterEngine's dateRangeLabel, that switch would be silently
  // ignored and the "期間" summary would keep including a source the user
  // just hid — so this recomputes it from a source-only-filtered view
  // instead, keeping the "ignore search/domain/date" behavior intentional
  // elsewhere while still respecting which sources are enabled.
  const dateRangeLabel = computed(() => {
    const sourceVisits = visits.value.filter((v) => enabledSources.value.includes(v.source))
    if (sourceVisits.length === 0) return '-'
    const times = sourceVisits.map((v) => v.visitTime.getTime())
    const min = new Date(Math.min(...times))
    const max = new Date(Math.max(...times))
    return `${formatDate(min)} 〜 ${formatDate(max)}`
  })

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
    weekdayTrend,
    hourlyTrend,
    uniqueUrlCount,
    uniqueDomainCount,
    selectedVisit,
    detailDialog,
    openDetail,
    resetFilters
  }
}
