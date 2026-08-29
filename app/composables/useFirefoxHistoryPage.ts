import { computed, ref } from 'vue'
import type { FirefoxHistoryVisit, FirefoxProfile } from '~/types/history'
import { toUnifiedVisit } from '~/utils/unifiedHistory'
import { browserCatalogEntry } from '~/utils/browserCatalog'
import { useVisitFilterI18n } from '~/composables/useAppLocale'
import { useFirefoxHistoryFilters } from './useFirefoxHistoryFilters'
import { useDebouncedRef } from './useDebouncedRef'
import {
  booleanCodec,
  filterField,
  freeformStringArrayCodec,
  nullableDateCodec,
  stringCodec,
  useFilterPersistence
} from './useFilterPersistence'
import { parseFirefoxHistoryFile } from './useFirefoxHistoryParser'
import { useUnifiedHistorySource } from './useUnifiedHistorySource'

function resolveDefaultProfileId(profiles: FirefoxProfile[]): string {
  const defaultProfile = profiles.find((p) => p.isDefault) ?? profiles[0]
  return defaultProfile?.id ?? ''
}

/**
 * All page-level state and orchestration for app/pages/firefox.vue, mirroring
 * useChromiumHistoryPage.ts — load/status/profile orchestration is delegated
 * to useUnifiedHistorySource.ts, and only the Firefox-specific filtering
 * (onlyTyped/onlyRedirects/onlyHidden) stays local here.
 */
export function useFirefoxHistoryPage() {
  const { apiBase, serverFileName } = browserCatalogEntry('firefox')

  const source = useUnifiedHistorySource<FirefoxHistoryVisit, FirefoxProfile>({
    apiBase,
    serverFileName,
    parseFile: parseFirefoxHistoryFile,
    toUnified: (v) => toUnifiedVisit(v, 'firefox'),
    resolveDefaultProfileId,
    loadErrorFallbackKey: 'error.autoLoadFailed.firefox'
  })

  const search = ref('')
  const domainFilter = ref<string[]>([])
  const dateFrom = ref<Date | null>(null)
  const dateTo = ref<Date | null>(null)
  const onlyTyped = ref(false)
  const onlyRedirects = ref(false)
  const onlyHidden = ref(false)

  useFilterPersistence('firefox-history-filters', {
    search: filterField(search, stringCodec),
    domainFilter: filterField(domainFilter, freeformStringArrayCodec),
    dateFrom: filterField(dateFrom, nullableDateCodec),
    dateTo: filterField(dateTo, nullableDateCodec),
    onlyTyped: filterField(onlyTyped, booleanCodec),
    onlyRedirects: filterField(onlyRedirects, booleanCodec),
    onlyHidden: filterField(onlyHidden, booleanCodec)
  })

  const { debounced: debouncedSearch, reset: resetDebouncedSearch } = useDebouncedRef(search, 200)

  // This page's UploadPanel keeps a single-select profile picker (unlike
  // app/pages/all.vue's UnifiedSourceCard, which /153 made multi-select) —
  // bridge that against useUnifiedHistorySource's array-based
  // selectedProfileIds/onProfileChange instead of exposing them directly.
  const selectedProfileId = computed(() => source.selectedProfileIds.value[0] ?? '')
  async function onProfileChange(profileId: string) {
    await source.onProfileChange(profileId ? [profileId] : [])
  }

  const selectedVisit = ref<FirefoxHistoryVisit | null>(null)
  const detailDialog = ref(false)

  const { domainOptions, filteredVisits, topDomains, dateRangeLabel, weekdayTrend, hourlyTrend } =
    useFirefoxHistoryFilters(
      source.rawVisits,
      {
        search: debouncedSearch,
        domainFilter,
        dateFrom,
        dateTo,
        onlyTyped,
        onlyRedirects,
        onlyHidden
      },
      useVisitFilterI18n()
    )

  const uniqueUrlCount = computed(() => new Set(source.rawVisits.value.map((v) => v.url)).size)
  const uniqueDomainCount = computed(
    () => new Set(source.rawVisits.value.map((v) => v.domain)).size
  )

  function openDetail(visit: FirefoxHistoryVisit) {
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
    onlyRedirects.value = false
    onlyHidden.value = false
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
    selectedProfileId,
    search,
    domainFilter,
    dateFrom,
    dateTo,
    onlyTyped,
    onlyRedirects,
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
    onProfileChange,
    loadFromServer: source.loadFromServer,
    openDetail,
    resetAll
  }
}
