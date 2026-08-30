import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { formatDate } from '~/utils/format'
import { useAppLocale, useVisitFilterI18n } from '~/composables/useAppLocale'
import type {
  ChromiumHistoryVisit,
  ChromiumProfile,
  FirefoxHistoryVisit,
  FirefoxProfile,
  HistoryVisit,
  NetscapeHistoryVisit,
  SafariProfile,
  UnifiedHistorySource,
  UnifiedHistoryVisit
} from '~/types/history'
import { toUnifiedVisit, UNIFIED_HISTORY_SOURCES } from '~/utils/unifiedHistory'
import { browserCatalogEntry } from '~/utils/browserCatalog'
import { DEFAULT_PROFILE_ID } from '../../shared/utils/profile'
import { useDebouncedRef } from './useDebouncedRef'
import {
  filterField,
  freeformStringArrayCodec,
  legacyNullableToStringArrayCodec,
  nullableDateCodec,
  stringArrayCodec,
  stringCodec,
  useFilterPersistence
} from './useFilterPersistence'
import { parseChromiumHistoryFile } from './useChromiumHistoryParser'
import { parseFirefoxHistoryFile } from './useFirefoxHistoryParser'
import { parseNetscapeHistoryFile } from './useNetscapeHistoryParser'
import { parseSafariHistoryFile } from './useSafariHistoryParser'
import { useUnifiedHistoryFilters } from './useUnifiedHistoryFilters'
import { useUnifiedHistorySource } from './useUnifiedHistorySource'

function pickDefaultProfileId(profiles: { id: string; isDefault: boolean }[]): string {
  const defaultProfile = profiles.find((p) => p.isDefault) ?? profiles[0]
  return defaultProfile?.id ?? ''
}

/**
 * Orchestrates the cross-browser search page (app/pages/all.vue): loads every
 * BROWSER_CATALOG source independently via its own useUnifiedHistorySource()
 * instance, combines their visits into one UnifiedHistoryVisit[], and
 * applies search/domain/date/source filtering across the combined list.
 */
export function useUnifiedHistoryPage() {
  const { t } = useI18n()
  const { intlLocale } = useAppLocale()

  // autoCheckOnMount: false — unlike the single-browser pages, /all starts
  // with no cards shown (see issue #156), so fetching every source's
  // profile/status on page load would defeat the point of only adding the
  // browsers actually needed. Each source's status is instead checked from
  // checkAvailability() below, once for whichever sources are active.
  const safari = useUnifiedHistorySource<HistoryVisit, SafariProfile>({
    apiBase: browserCatalogEntry('safari').apiBase,
    serverFileName: browserCatalogEntry('safari').serverFileName,
    parseFile: parseSafariHistoryFile,
    toUnified: (v) => toUnifiedVisit(v, 'safari'),
    initialProfileId: DEFAULT_PROFILE_ID,
    loadErrorFallbackKey: 'error.autoLoadFailed.safari',
    autoCheckOnMount: false
  })

  const firefox = useUnifiedHistorySource<FirefoxHistoryVisit, FirefoxProfile>({
    apiBase: browserCatalogEntry('firefox').apiBase,
    serverFileName: browserCatalogEntry('firefox').serverFileName,
    parseFile: parseFirefoxHistoryFile,
    toUnified: (v) => toUnifiedVisit(v, 'firefox'),
    resolveDefaultProfileId: pickDefaultProfileId,
    loadErrorFallbackKey: 'error.autoLoadFailed.firefox',
    autoCheckOnMount: false
  })

  const chrome = useUnifiedHistorySource<ChromiumHistoryVisit, ChromiumProfile>({
    apiBase: browserCatalogEntry('chrome').apiBase,
    serverFileName: browserCatalogEntry('chrome').serverFileName,
    parseFile: parseChromiumHistoryFile,
    toUnified: (v) => toUnifiedVisit(v, 'chrome'),
    resolveDefaultProfileId: pickDefaultProfileId,
    loadErrorFallbackKey: 'error.autoLoadFailed.chromium',
    autoCheckOnMount: false
  })

  const edge = useUnifiedHistorySource<ChromiumHistoryVisit, ChromiumProfile>({
    apiBase: browserCatalogEntry('edge').apiBase,
    serverFileName: browserCatalogEntry('edge').serverFileName,
    parseFile: parseChromiumHistoryFile,
    toUnified: (v) => toUnifiedVisit(v, 'edge'),
    resolveDefaultProfileId: pickDefaultProfileId,
    loadErrorFallbackKey: 'error.autoLoadFailed.chromium',
    autoCheckOnMount: false
  })

  const opera = useUnifiedHistorySource<ChromiumHistoryVisit, ChromiumProfile>({
    apiBase: browserCatalogEntry('opera').apiBase,
    serverFileName: browserCatalogEntry('opera').serverFileName,
    parseFile: parseChromiumHistoryFile,
    toUnified: (v) => toUnifiedVisit(v, 'opera'),
    resolveDefaultProfileId: pickDefaultProfileId,
    loadErrorFallbackKey: 'error.autoLoadFailed.chromium',
    autoCheckOnMount: false
  })

  const arc = useUnifiedHistorySource<ChromiumHistoryVisit, ChromiumProfile>({
    apiBase: browserCatalogEntry('arc').apiBase,
    serverFileName: browserCatalogEntry('arc').serverFileName,
    parseFile: parseChromiumHistoryFile,
    toUnified: (v) => toUnifiedVisit(v, 'arc'),
    resolveDefaultProfileId: pickDefaultProfileId,
    loadErrorFallbackKey: 'error.autoLoadFailed.chromium',
    autoCheckOnMount: false
  })

  const brave = useUnifiedHistorySource<ChromiumHistoryVisit, ChromiumProfile>({
    apiBase: browserCatalogEntry('brave').apiBase,
    serverFileName: browserCatalogEntry('brave').serverFileName,
    parseFile: parseChromiumHistoryFile,
    toUnified: (v) => toUnifiedVisit(v, 'brave'),
    resolveDefaultProfileId: pickDefaultProfileId,
    loadErrorFallbackKey: 'error.autoLoadFailed.chromium',
    autoCheckOnMount: false
  })

  const vivaldi = useUnifiedHistorySource<ChromiumHistoryVisit, ChromiumProfile>({
    apiBase: browserCatalogEntry('vivaldi').apiBase,
    serverFileName: browserCatalogEntry('vivaldi').serverFileName,
    parseFile: parseChromiumHistoryFile,
    toUnified: (v) => toUnifiedVisit(v, 'vivaldi'),
    resolveDefaultProfileId: pickDefaultProfileId,
    loadErrorFallbackKey: 'error.autoLoadFailed.chromium',
    autoCheckOnMount: false
  })

  // Upload-only (no apiBase/profiles): Netscape is discontinued, so there is
  // never a live database on this machine to auto-load — the card shows only
  // its file input. See browserCatalog.ts and issue #160.
  const netscape = useUnifiedHistorySource<NetscapeHistoryVisit, { id: string; name: string }>({
    parseFile: parseNetscapeHistoryFile,
    toUnified: (v) => toUnifiedVisit(v, 'netscape'),
    loadErrorFallbackKey: 'error.unknown',
    autoCheckOnMount: false
  })

  // Each source's own visits already arrive sorted (visit_time DESC, see the
  // per-brand SQL), but concatenating independently-sorted arrays does not
  // itself produce a sorted result — re-sort the merged list so /all
  // actually reads as one interleaved timeline instead of "all of Safari,
  // then all of Firefox, ...".
  const visits = computed<UnifiedHistoryVisit[]>(() =>
    [
      ...safari.unifiedVisits.value,
      ...firefox.unifiedVisits.value,
      ...chrome.unifiedVisits.value,
      ...edge.unifiedVisits.value,
      ...opera.unifiedVisits.value,
      ...arc.unifiedVisits.value,
      ...brave.unifiedVisits.value,
      ...vivaldi.unifiedVisits.value,
      ...netscape.unifiedVisits.value
    ].sort((a, b) => b.visitTime.getTime() - a.visitTime.getTime())
  )

  const hasData = computed(() =>
    [safari, firefox, chrome, edge, opera, arc, brave, vivaldi, netscape].some(
      (s) => s.hasData.value
    )
  )

  const sources = { safari, firefox, chrome, edge, opera, arc, brave, vivaldi, netscape }

  // Which browser cards are shown on the page — starts empty (see issue
  // #156) instead of always rendering every source, and is restored from
  // localStorage like every other filter below.
  const activeSources = ref<UnifiedHistorySource[]>([])

  const search = ref('')
  const domainFilter = ref<string[]>([])
  const dateFrom = ref<Date | null>(null)
  const dateTo = ref<Date | null>(null)
  const enabledSources = ref<UnifiedHistorySource[]>([...UNIFIED_HISTORY_SOURCES])

  useFilterPersistence('unified-history-filters', {
    search: filterField(search, stringCodec),
    domainFilter: filterField(domainFilter, legacyNullableToStringArrayCodec),
    dateFrom: filterField(dateFrom, nullableDateCodec),
    dateTo: filterField(dateTo, nullableDateCodec),
    enabledSources: filterField(enabledSources, stringArrayCodec(UNIFIED_HISTORY_SOURCES)),
    activeSources: filterField(activeSources, stringArrayCodec(UNIFIED_HISTORY_SOURCES)),
    // Profile ids aren't drawn from a fixed, known-in-advance set the way
    // enabledSources/activeSources are (they come from whatever profiles
    // exist on the machine), so these use the unconstrained codec instead
    // of stringArrayCodec's allow-list.
    safariProfileIds: filterField(safari.selectedProfileIds, freeformStringArrayCodec),
    firefoxProfileIds: filterField(firefox.selectedProfileIds, freeformStringArrayCodec),
    chromeProfileIds: filterField(chrome.selectedProfileIds, freeformStringArrayCodec),
    edgeProfileIds: filterField(edge.selectedProfileIds, freeformStringArrayCodec),
    operaProfileIds: filterField(opera.selectedProfileIds, freeformStringArrayCodec),
    arcProfileIds: filterField(arc.selectedProfileIds, freeformStringArrayCodec),
    braveProfileIds: filterField(brave.selectedProfileIds, freeformStringArrayCodec),
    vivaldiProfileIds: filterField(vivaldi.selectedProfileIds, freeformStringArrayCodec)
    // Netscape has no profiles to remember — it is upload-only.
  })

  // Sources restored into activeSources above (a prior visit's selection)
  // never got their onMounted check — it was skipped via autoCheckOnMount:
  // false — so run it now for exactly those, instead of all of them.
  for (const id of activeSources.value) {
    void sources[id].checkAvailability()
  }

  function addSource(id: UnifiedHistorySource) {
    if (activeSources.value.includes(id)) return
    activeSources.value = [...activeSources.value, id]
    if (!enabledSources.value.includes(id)) enabledSources.value = [...enabledSources.value, id]
    void sources[id].checkAvailability()
  }

  function removeSource(id: UnifiedHistorySource) {
    activeSources.value = activeSources.value.filter((s) => s !== id)
    enabledSources.value = enabledSources.value.filter((s) => s !== id)
    sources[id].reset()
  }

  const { debounced: debouncedSearch, reset: resetDebouncedSearch } = useDebouncedRef(search, 200)

  const { domainOptions, filteredVisits, topDomains, weekdayTrend, hourlyTrend } =
    useUnifiedHistoryFilters(
      visits,
      {
        search: debouncedSearch,
        domainFilter,
        dateFrom,
        dateTo,
        enabledSources
      },
      useVisitFilterI18n()
    )

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
    return t('common.dateRange', {
      from: formatDate(min, intlLocale.value),
      to: formatDate(max, intlLocale.value)
    })
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
    domainFilter.value = []
    dateFrom.value = null
    dateTo.value = null
    enabledSources.value = [...UNIFIED_HISTORY_SOURCES]
  }

  return {
    sources,
    activeSources,
    addSource,
    removeSource,
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
