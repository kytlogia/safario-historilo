import { computed, onMounted, ref, shallowRef } from 'vue'
import { FetchError } from 'ofetch'
import { useI18n } from 'vue-i18n'
import type { UnifiedHistoryVisit } from '~/types/history'
import { useAppLocale, type AppLocale } from '~/composables/useAppLocale'

// $fetch's Nitro route-type inference only kicks in for a literal URL string
// at the call site — `apiBase` here is a runtime value (it varies per
// source), so these response shapes have to be declared explicitly instead
// of relying on that inference. Shared shape across all four
// /api/local-history[/<brand>]/{status,profiles} route groups.
export interface LocalHistoryStatusResponse {
  available: boolean
  present: boolean
  readable: boolean
  path: string
}

interface LocalHistoryProfilesResponse<P> {
  profiles: P[]
}

export interface UnifiedHistorySourceOptions<V, P extends { id: string; name: string }> {
  /** `/api/local-history` (Safari) or `/api/local-history/<brand>`. */
  apiBase: string
  /** File name to wrap the auto-loaded server blob in before parsing. */
  serverFileName: string
  parseFile: (file: File, locale: AppLocale) => Promise<{ visits: V[]; fileName: string }>
  toUnified: (visit: V) => UnifiedHistoryVisit
  initialProfileId?: string
  resolveDefaultProfileId?: (profiles: P[]) => string
  /** i18n key (under `error.autoLoadFailed`) resolved via t() at call time. */
  loadErrorFallbackKey: string
  /**
   * Whether to fetch profiles/status automatically on mount. Defaults to
   * true (matches every single-browser page, which always shows its one
   * source). app/pages/all.vue passes false and calls the returned
   * checkAvailability() itself, only for sources the user actually added —
   * see useUnifiedHistoryPage.ts.
   */
  autoCheckOnMount?: boolean
}

/**
 * One source's worth of state and load orchestration for the cross-browser
 * search page (app/pages/all.vue) — mirrors the per-page composables
 * (useChromiumHistoryPage.ts / useSafariHistoryPage.ts / useFirefoxHistoryPage.ts)
 * but parameterized over the visit/profile type and API base, since /all.vue
 * needs four of these (Safari/Firefox/Chrome/Edge) side by side instead of
 * one per page. Filtering is intentionally left out — app/pages/all.vue
 * filters the combined `unifiedVisits` from all four sources together via
 * useUnifiedHistoryFilters.ts.
 */
export function useUnifiedHistorySource<V, P extends { id: string; name: string }>(
  options: UnifiedHistorySourceOptions<V, P>
) {
  const {
    apiBase,
    serverFileName,
    parseFile,
    toUnified,
    initialProfileId = '',
    resolveDefaultProfileId,
    loadErrorFallbackKey,
    autoCheckOnMount = true
  } = options

  const { t } = useI18n()
  const { currentLocale } = useAppLocale()

  // shallowRef, not ref: V is a generic type param, so a plain ref<V[]>
  // would force TS to reason about UnwrapRef<V> for an unresolved V (and,
  // in practice, the visit arrays here are always replaced wholesale on
  // load — never mutated in place — so deep reactivity buys nothing).
  const rawVisits = shallowRef<V[]>([])
  const fileName = ref('')
  const isLoading = ref(false)
  const loadError = ref('')

  const serverAutoLoadAvailable = ref(false)
  const serverDbPath = ref('')
  const serverPermissionHint = ref(false)
  const serverStatusWarning = ref('')

  const serverProfiles = ref<P[]>([])
  const selectedProfileIds = ref<string[]>(initialProfileId ? [initialProfileId] : [])

  const hasData = computed(() => rawVisits.value.length > 0)
  const unifiedVisits = computed(() => rawVisits.value.map(toUnified))

  // Bumped by reset() so a load that's still in flight when the user closes
  // this source's card (app/pages/all.vue) can't resurrect the data it just
  // cleared by writing its result after the fact — loadFile/loadFromServer
  // only apply their result if their own generation is still current.
  let loadGeneration = 0

  async function loadFile(file: File | null | undefined) {
    if (!file || isLoading.value) return
    const generation = ++loadGeneration
    isLoading.value = true
    loadError.value = ''
    try {
      const result = await parseFile(file, currentLocale.value)
      if (generation !== loadGeneration) return
      rawVisits.value = result.visits
      fileName.value = result.fileName
    } catch (err) {
      if (generation !== loadGeneration) return
      loadError.value = err instanceof Error ? err.message : t('error.unknown')
    } finally {
      if (generation === loadGeneration) isLoading.value = false
    }
  }

  // Guards against out-of-order responses — see the equivalent comment in
  // useChromiumHistoryPage.ts.
  let statusRequestId = 0

  // Profiles the status/download endpoints are queried for — an empty
  // selection (no profiles on this browser, or the user cleared it) falls
  // back to a single `undefined` query, which every /status and download
  // route treats as "resolve the default profile" server-side.
  function queriedProfileIds(): (string | undefined)[] {
    return selectedProfileIds.value.length > 0 ? selectedProfileIds.value : [undefined]
  }

  // Promise.allSettled, not Promise.all: with several profiles selected,
  // one of them failing (a deleted profile whose id is still in a restored
  // selection, a locked db, ...) must not blank out the others that
  // succeeded — only fail closed when *every* selected profile failed.
  function firstRejectedReason(settled: PromiseSettledResult<unknown>[]): unknown {
    return settled.find((r): r is PromiseRejectedResult => r.status === 'rejected')?.reason
  }

  async function checkServerAutoLoadAvailability() {
    const requestId = ++statusRequestId
    serverStatusWarning.value = ''
    const settled = await Promise.allSettled(
      queriedProfileIds().map((profileId) =>
        $fetch<LocalHistoryStatusResponse>(`${apiBase}/status`, { query: { profileId } })
      )
    )
    if (requestId !== statusRequestId) return
    const results = settled.flatMap((r) => (r.status === 'fulfilled' ? [r.value] : []))
    if (results.length === 0) {
      serverPermissionHint.value = false
      const err = firstRejectedReason(settled)
      if (err instanceof FetchError && err.statusCode === 403) {
        serverStatusWarning.value = err.data?.message ?? t('error.serverRestricted')
      }
      serverAutoLoadAvailable.value = false
      return
    }
    serverAutoLoadAvailable.value = results.some((body) => Boolean(body?.available))
    serverDbPath.value = results
      .map((body) => (typeof body?.path === 'string' ? body.path : ''))
      .filter(Boolean)
      .join(', ')
    // Only surface the permission hint when nothing is loadable — if at
    // least one selected profile is available, "自動で読み込む" already
    // covers that profile and an unreadable sibling isn't blocking.
    serverPermissionHint.value =
      !serverAutoLoadAvailable.value &&
      results.some((body) => Boolean(body?.present) && !body?.readable)
  }

  async function loadProfiles() {
    try {
      const body = await $fetch<LocalHistoryProfilesResponse<P>>(`${apiBase}/profiles`)
      const profiles: P[] = Array.isArray(body?.profiles) ? body.profiles : []
      serverProfiles.value = profiles
      if (selectedProfileIds.value.length === 0 && resolveDefaultProfileId) {
        const defaultId = resolveDefaultProfileId(profiles)
        selectedProfileIds.value = defaultId ? [defaultId] : []
      }
    } catch {
      serverProfiles.value = []
    }
  }

  async function onProfileChange(profileIds: string[]) {
    selectedProfileIds.value = profileIds
    await checkServerAutoLoadAvailability()
  }

  async function loadFromServer() {
    if (isLoading.value) return
    const generation = ++loadGeneration
    isLoading.value = true
    loadError.value = ''
    try {
      const profileIds = queriedProfileIds()
      const settled = await Promise.allSettled(
        profileIds.map(async (profileId) => {
          const blob = await $fetch<Blob>(apiBase, { query: { profileId } })
          return parseFile(new File([blob], serverFileName), currentLocale.value)
        })
      )
      if (generation !== loadGeneration) return
      const fulfilled = settled.flatMap((r, index) =>
        r.status === 'fulfilled' ? [{ profileId: profileIds[index], result: r.value }] : []
      )
      if (fulfilled.length === 0) {
        const err = firstRejectedReason(settled)
        if (err instanceof FetchError) {
          loadError.value = err.data?.message ?? t(loadErrorFallbackKey)
        } else {
          loadError.value = err instanceof Error ? err.message : t('error.unknown')
        }
        return
      }
      rawVisits.value = fulfilled.flatMap(({ result }) => result.visits)
      // parseFile() just echoes back the File name we handed it above
      // (serverFileName, identical for every profile of this browser), so
      // joining `result.fileName` would read as "History, History, History"
      // for a multi-profile load — use the profiles' own display names
      // instead so the card shows which profiles were combined. A profile
      // that failed to load (filtered out above) is simply left out here
      // too, rather than blanking the whole card for the others.
      fileName.value = fulfilled
        .map(
          ({ profileId }) =>
            serverProfiles.value.find((p) => p.id === profileId)?.name ?? serverFileName
        )
        .join(', ')
    } finally {
      if (generation === loadGeneration) isLoading.value = false
    }
  }

  function reset() {
    loadGeneration++
    rawVisits.value = []
    fileName.value = ''
    loadError.value = ''
    isLoading.value = false
  }

  // Sequential, not Promise.all: checkServerAutoLoadAvailability() reads
  // selectedProfileIds synchronously, but loadProfiles() is what resolves
  // the default profile id (via resolveDefaultProfileId) when the caller
  // didn't pass an initialProfileId. Running them in parallel risks the
  // status check firing before a profile is selected — resolve the
  // profile first.
  async function checkAvailability() {
    await loadProfiles()
    await checkServerAutoLoadAvailability()
  }

  onMounted(() => {
    if (autoCheckOnMount) void checkAvailability()
  })

  return {
    // Exposed so callers that need full-fidelity, source-specific fields
    // (e.g. useChromiumHistoryPage.ts, which filters on onlyTyped/
    // onlyRedirects/onlyHidden) can build their own filtering on top of this
    // loader instead of the reduced UnifiedHistoryVisit projection.
    rawVisits,
    fileName,
    isLoading,
    loadError,
    serverAutoLoadAvailable,
    serverDbPath,
    serverPermissionHint,
    serverStatusWarning,
    serverProfiles,
    selectedProfileIds,
    hasData,
    unifiedVisits,
    loadFile,
    onProfileChange,
    loadFromServer,
    checkAvailability,
    reset
  }
}
