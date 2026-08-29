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

export interface UnifiedHistorySourceOptions<V, P> {
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
export function useUnifiedHistorySource<V, P>(options: UnifiedHistorySourceOptions<V, P>) {
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
  const selectedProfileId = ref(initialProfileId)

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

  async function checkServerAutoLoadAvailability() {
    const requestId = ++statusRequestId
    const profileId = selectedProfileId.value || undefined
    serverStatusWarning.value = ''
    try {
      const body = await $fetch<LocalHistoryStatusResponse>(`${apiBase}/status`, {
        query: { profileId }
      })
      if (requestId !== statusRequestId) return
      serverAutoLoadAvailable.value = Boolean(body?.available)
      serverDbPath.value = typeof body?.path === 'string' ? body.path : ''
      serverPermissionHint.value = Boolean(body?.present) && !body?.readable
    } catch (err) {
      if (requestId !== statusRequestId) return
      serverPermissionHint.value = false
      if (err instanceof FetchError && err.statusCode === 403) {
        serverStatusWarning.value = err.data?.message ?? t('error.serverRestricted')
      }
      serverAutoLoadAvailable.value = false
    }
  }

  async function loadProfiles() {
    try {
      const body = await $fetch<LocalHistoryProfilesResponse<P>>(`${apiBase}/profiles`)
      const profiles: P[] = Array.isArray(body?.profiles) ? body.profiles : []
      serverProfiles.value = profiles
      if (!selectedProfileId.value && resolveDefaultProfileId) {
        selectedProfileId.value = resolveDefaultProfileId(profiles)
      }
    } catch {
      serverProfiles.value = []
    }
  }

  async function onProfileChange(profileId: string) {
    selectedProfileId.value = profileId
    await checkServerAutoLoadAvailability()
  }

  async function loadFromServer() {
    if (isLoading.value) return
    const generation = ++loadGeneration
    isLoading.value = true
    loadError.value = ''
    try {
      const blob = await $fetch<Blob>(apiBase, {
        query: { profileId: selectedProfileId.value || undefined }
      })
      const result = await parseFile(new File([blob], serverFileName), currentLocale.value)
      if (generation !== loadGeneration) return
      rawVisits.value = result.visits
      fileName.value = result.fileName
    } catch (err) {
      if (generation !== loadGeneration) return
      if (err instanceof FetchError) {
        loadError.value = err.data?.message ?? t(loadErrorFallbackKey)
      } else {
        loadError.value = err instanceof Error ? err.message : t('error.unknown')
      }
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
  // selectedProfileId synchronously, but loadProfiles() is what resolves
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
    selectedProfileId,
    hasData,
    unifiedVisits,
    loadFile,
    onProfileChange,
    loadFromServer,
    checkAvailability,
    reset
  }
}
