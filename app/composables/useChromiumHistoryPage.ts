import { computed, ref } from 'vue'
import type { ChromiumHistoryVisit, ChromiumProfile } from '~/types/history'
import { toUnifiedChromiumVisit } from '~/utils/unifiedHistory'
import { browserCatalogEntry } from '~/utils/browserCatalog'
import { useVisitFilterI18n } from '~/composables/useAppLocale'
import { useChromiumHistoryFilters } from './useChromiumHistoryFilters'
import { useDebouncedRef } from './useDebouncedRef'
import {
  booleanCodec,
  filterField,
  nullableDateCodec,
  nullableStringCodec,
  stringCodec,
  useFilterPersistence
} from './useFilterPersistence'
import { parseChromiumHistoryFile } from './useChromiumHistoryParser'
import { useUnifiedHistorySource } from './useUnifiedHistorySource'

function resolveDefaultProfileId(profiles: ChromiumProfile[]): string {
  const defaultProfile = profiles.find((p) => p.isDefault) ?? profiles[0]
  return defaultProfile?.id ?? ''
}

/**
 * All page-level state and orchestration shared by app/pages/chrome.vue and
 * app/pages/edge.vue — the two pages differ only in a handful of display
 * strings and their icon (already handled one layer down via the `brand`
 * prop on ChromiumUploadPanel/ChromiumFilterBar), never in this loading /
 * filtering / auto-load logic itself. `brand` selects the matching
 * `/api/local-history/<brand>` routes.
 *
 * The load/status/profile orchestration itself is delegated to
 * useUnifiedHistorySource.ts (shared with app/pages/all.vue) rather than
 * duplicated here — only the Chromium-specific filtering
 * (onlyTyped/onlyRedirects/onlyHidden, which needs the full
 * ChromiumHistoryVisit shape, not the reduced UnifiedHistoryVisit
 * projection) stays local to this composable.
 */
export function useChromiumHistoryPage(brand: 'chrome' | 'edge') {
  const source = useUnifiedHistorySource<ChromiumHistoryVisit, ChromiumProfile>({
    apiBase: browserCatalogEntry(brand).apiBase,
    serverFileName: browserCatalogEntry(brand).serverFileName,
    parseFile: parseChromiumHistoryFile,
    toUnified: (v) => toUnifiedChromiumVisit(v, brand),
    resolveDefaultProfileId,
    loadErrorFallbackKey: 'error.autoLoadFailed.chromium'
  })

  const search = ref('')
  const domainFilter = ref<string | null>(null)
  const dateFrom = ref<Date | null>(null)
  const dateTo = ref<Date | null>(null)
  const onlyTyped = ref(false)
  const onlyRedirects = ref(false)
  const onlyHidden = ref(false)

  useFilterPersistence(`${brand}-history-filters`, {
    search: filterField(search, stringCodec),
    domainFilter: filterField(domainFilter, nullableStringCodec),
    dateFrom: filterField(dateFrom, nullableDateCodec),
    dateTo: filterField(dateTo, nullableDateCodec),
    onlyTyped: filterField(onlyTyped, booleanCodec),
    onlyRedirects: filterField(onlyRedirects, booleanCodec),
    onlyHidden: filterField(onlyHidden, booleanCodec)
  })

  const { debounced: debouncedSearch, reset: resetDebouncedSearch } = useDebouncedRef(search, 200)

  const selectedVisit = ref<ChromiumHistoryVisit | null>(null)
  const detailDialog = ref(false)

  const { domainOptions, filteredVisits, topDomains, dateRangeLabel, weekdayTrend, hourlyTrend } =
    useChromiumHistoryFilters(
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

  function openDetail(visit: ChromiumHistoryVisit) {
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
    selectedProfileId: source.selectedProfileId,
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
    onProfileChange: source.onProfileChange,
    loadFromServer: source.loadFromServer,
    openDetail,
    resetAll
  }
}
