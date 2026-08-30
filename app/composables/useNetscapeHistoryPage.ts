import { computed, ref } from 'vue'
import type { NetscapeHistoryVisit } from '~/types/history'
import { toUnifiedVisit } from '~/utils/unifiedHistory'
import { useVisitFilterI18n } from '~/composables/useAppLocale'
import { useNetscapeHistoryFilters } from './useNetscapeHistoryFilters'
import { useDebouncedRef } from './useDebouncedRef'
import {
  booleanCodec,
  filterField,
  nullableDateCodec,
  freeformStringArrayCodec,
  stringCodec,
  useFilterPersistence
} from './useFilterPersistence'
import { parseNetscapeHistoryFile } from './useNetscapeHistoryParser'
import { useUnifiedHistorySource } from './useUnifiedHistorySource'

/**
 * Page state for app/pages/netscape.vue. Mirrors useFirefoxHistoryPage.ts,
 * minus everything to do with auto-loading from this machine: Netscape 9 is
 * discontinued and can't be running here, so the source is upload-only (no
 * apiBase, no profiles — see issue #160).
 */
export function useNetscapeHistoryPage() {
  const source = useUnifiedHistorySource<NetscapeHistoryVisit, { id: string; name: string }>({
    parseFile: parseNetscapeHistoryFile,
    toUnified: (v) => toUnifiedVisit(v, 'netscape'),
    // Never actually used: it only surfaces on the loadFromServer()
    // path, which an upload-only source can't reach.
    loadErrorFallbackKey: 'error.unknown'
  })

  const search = ref('')
  const domainFilter = ref<string[]>([])
  const dateFrom = ref<Date | null>(null)
  const dateTo = ref<Date | null>(null)
  const onlyTyped = ref(false)
  const onlyHidden = ref(false)

  useFilterPersistence('netscape-history-filters', {
    search: filterField(search, stringCodec),
    domainFilter: filterField(domainFilter, freeformStringArrayCodec),
    dateFrom: filterField(dateFrom, nullableDateCodec),
    dateTo: filterField(dateTo, nullableDateCodec),
    onlyTyped: filterField(onlyTyped, booleanCodec),
    onlyHidden: filterField(onlyHidden, booleanCodec)
  })

  const { debounced: debouncedSearch, reset: resetDebouncedSearch } = useDebouncedRef(search, 200)

  const selectedVisit = ref<NetscapeHistoryVisit | null>(null)
  const detailDialog = ref(false)

  const { domainOptions, filteredVisits, topDomains, dateRangeLabel, weekdayTrend, hourlyTrend } =
    useNetscapeHistoryFilters(
      source.rawVisits,
      { search: debouncedSearch, domainFilter, dateFrom, dateTo, onlyTyped, onlyHidden },
      useVisitFilterI18n()
    )

  const uniqueUrlCount = computed(() => new Set(source.rawVisits.value.map((v) => v.url)).size)
  const uniqueDomainCount = computed(
    () => new Set(source.rawVisits.value.map((v) => v.domain)).size
  )

  function openDetail(visit: NetscapeHistoryVisit) {
    selectedVisit.value = visit
    detailDialog.value = true
  }

  function resetAll() {
    source.reset()
    search.value = ''
    resetDebouncedSearch()
    domainFilter.value = []
    dateFrom.value = null
    dateTo.value = null
    onlyTyped.value = false
    onlyHidden.value = false
  }

  return {
    visits: source.rawVisits,
    fileName: source.fileName,
    isLoading: source.isLoading,
    loadError: source.loadError,
    search,
    domainFilter,
    dateFrom,
    dateTo,
    onlyTyped,
    onlyHidden,
    selectedVisit,
    detailDialog,
    hasData: source.hasData,
    domainOptions,
    filteredVisits,
    topDomains,
    dateRangeLabel,
    weekdayTrend,
    hourlyTrend,
    uniqueUrlCount,
    uniqueDomainCount,
    loadFile: source.loadFile,
    openDetail,
    resetAll
  }
}
