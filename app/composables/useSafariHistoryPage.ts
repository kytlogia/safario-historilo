import { computed, ref } from 'vue'
import type { HistoryVisit, SafariProfile } from '~/types/history'
import { toUnifiedVisit } from '~/utils/unifiedHistory'
import { browserCatalogEntry } from '~/utils/browserCatalog'
import { useVisitFilterI18n } from '~/composables/useAppLocale'
import { useHistoryFilters } from './useHistoryFilters'
import { useDebouncedRef } from './useDebouncedRef'
import {
  booleanCodec,
  filterField,
  nullableDateCodec,
  nullableStringCodec,
  stringCodec,
  useFilterPersistence
} from './useFilterPersistence'
import { parseSafariHistoryFile } from './useSafariHistoryParser'
import { useUnifiedHistorySource } from './useUnifiedHistorySource'
import { DEFAULT_PROFILE_ID } from '../../shared/utils/profile'

/**
 * All page-level state and orchestration for app/pages/index.vue (Safari),
 * mirroring useChromiumHistoryPage.ts — load/status/profile orchestration is
 * delegated to useUnifiedHistorySource.ts, and only the Safari-specific
 * filtering (onlyFailed/onlyRedirects/onlySynthesized) stays local here.
 */
export function useSafariHistoryPage() {
  const { apiBase, serverFileName } = browserCatalogEntry('safari')

  const source = useUnifiedHistorySource<HistoryVisit, SafariProfile>({
    apiBase,
    serverFileName,
    parseFile: parseSafariHistoryFile,
    toUnified: (v) => toUnifiedVisit(v, 'safari'),
    initialProfileId: DEFAULT_PROFILE_ID,
    loadErrorFallbackKey: 'error.autoLoadFailed.safari'
  })

  const search = ref('')
  const domainFilter = ref<string | null>(null)
  const dateFrom = ref<Date | null>(null)
  const dateTo = ref<Date | null>(null)
  const onlyFailed = ref(false)
  const onlyRedirects = ref(false)
  const onlySynthesized = ref(false)

  useFilterPersistence('safari-history-filters', {
    search: filterField(search, stringCodec),
    domainFilter: filterField(domainFilter, nullableStringCodec),
    dateFrom: filterField(dateFrom, nullableDateCodec),
    dateTo: filterField(dateTo, nullableDateCodec),
    onlyFailed: filterField(onlyFailed, booleanCodec),
    onlyRedirects: filterField(onlyRedirects, booleanCodec),
    onlySynthesized: filterField(onlySynthesized, booleanCodec)
  })

  const { debounced: debouncedSearch, reset: resetDebouncedSearch } = useDebouncedRef(search, 200)

  const selectedVisit = ref<HistoryVisit | null>(null)
  const detailDialog = ref(false)

  const { domainOptions, filteredVisits, topDomains, dateRangeLabel, weekdayTrend, hourlyTrend } =
    useHistoryFilters(
      source.rawVisits,
      {
        search: debouncedSearch,
        domainFilter,
        dateFrom,
        dateTo,
        onlyFailed,
        onlyRedirects,
        onlySynthesized
      },
      useVisitFilterI18n()
    )

  const uniqueUrlCount = computed(() => new Set(source.rawVisits.value.map((v) => v.url)).size)
  const uniqueDomainCount = computed(
    () => new Set(source.rawVisits.value.map((v) => v.domain)).size
  )

  function openDetail(visit: HistoryVisit) {
    selectedVisit.value = visit
    detailDialog.value = true
  }

  function resetAll() {
    source.reset()
    search.value = ''
    resetDebouncedSearch()
    domainFilter.value = null
    dateFrom.value = null
    dateTo.value = null
    onlyFailed.value = false
    onlyRedirects.value = false
    onlySynthesized.value = false
  }

  return {
    visits: source.rawVisits,
    fileName: source.fileName,
    isLoading: source.isLoading,
    loadError: source.loadError,
    serverAutoLoadAvailable: source.serverAutoLoadAvailable,
    serverDbPath: source.serverDbPath,
    serverPermissionHint: source.serverPermissionHint,
    serverStatusWarning: source.serverStatusWarning,
    serverProfiles: source.serverProfiles,
    selectedProfileId: source.selectedProfileId,
    search,
    domainFilter,
    dateFrom,
    dateTo,
    onlyFailed,
    onlyRedirects,
    onlySynthesized,
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
    onProfileChange: source.onProfileChange,
    loadFromServer: source.loadFromServer,
    openDetail,
    resetAll
  }
}
