import { computed, onMounted, ref } from 'vue'
import { FetchError } from 'ofetch'
import type { ChromiumHistoryVisit, ChromiumProfile } from '~/types/history'
import { useChromiumHistoryFilters } from './useChromiumHistoryFilters'
import { parseChromiumHistoryFile } from './useChromiumHistoryParser'
import { useDebouncedRef } from './useDebouncedRef'

// $fetch's Nitro route-type inference only kicks in for a literal URL string
// at the call site — `apiBase` below is a runtime template literal (since it
// picks between /chrome and /edge), so these response shapes have to be
// declared explicitly instead of relying on that inference.
interface ChromiumHistoryStatusResponse {
  available: boolean
  supported: boolean
  present: boolean
  readable: boolean
  path: string
}

interface ChromiumHistoryProfilesResponse {
  profiles: ChromiumProfile[]
}

/**
 * All page-level state and orchestration shared by app/pages/chrome.vue and
 * app/pages/edge.vue — the two pages differ only in a handful of display
 * strings and their icon (already handled one layer down via the `brand`
 * prop on ChromiumUploadPanel/ChromiumFilterBar), never in this loading /
 * filtering / auto-load logic itself. `brand` selects the matching
 * `/api/local-history/<brand>` routes.
 */
export function useChromiumHistoryPage(brand: 'chrome' | 'edge') {
  const apiBase = `/api/local-history/${brand}`

  const visits = ref<ChromiumHistoryVisit[]>([])
  const fileName = ref('')
  const isLoading = ref(false)
  const loadError = ref('')

  const serverAutoLoadAvailable = ref(false)
  const serverDbPath = ref('')
  const serverPermissionHint = ref(false)
  const serverStatusWarning = ref('')

  const serverProfiles = ref<ChromiumProfile[]>([])
  const selectedProfileId = ref('')

  const search = ref('')
  const { debounced: debouncedSearch, reset: resetDebouncedSearch } = useDebouncedRef(search, 200)
  const domainFilter = ref<string | null>(null)
  const dateFrom = ref<Date | null>(null)
  const dateTo = ref<Date | null>(null)
  const onlyTyped = ref(false)
  const onlyRedirects = ref(false)
  const onlyHidden = ref(false)

  const selectedVisit = ref<ChromiumHistoryVisit | null>(null)
  const detailDialog = ref(false)

  const hasData = computed(() => visits.value.length > 0)

  const { domainOptions, filteredVisits, topDomains, dateRangeLabel } = useChromiumHistoryFilters(
    visits,
    {
      search: debouncedSearch,
      domainFilter,
      dateFrom,
      dateTo,
      onlyTyped,
      onlyRedirects,
      onlyHidden
    }
  )

  const uniqueUrlCount = computed(() => new Set(visits.value.map((v) => v.url)).size)
  const uniqueDomainCount = computed(() => new Set(visits.value.map((v) => v.domain)).size)

  async function loadFile(file: File | null | undefined) {
    if (!file || isLoading.value) return
    isLoading.value = true
    loadError.value = ''
    try {
      const result = await parseChromiumHistoryFile(file)
      visits.value = result.visits
      fileName.value = result.fileName
    } catch (err) {
      loadError.value = err instanceof Error ? err.message : '不明なエラーが発生しました。'
    } finally {
      isLoading.value = false
    }
  }

  // Guards against out-of-order responses: switching profiles quickly fires
  // overlapping requests, and without this a slower, stale response could
  // overwrite the state after a newer one already resolved. Only the response
  // whose requestId still matches the latest dispatched request is applied.
  let statusRequestId = 0

  async function checkServerAutoLoadAvailability() {
    const requestId = ++statusRequestId
    const profileId = selectedProfileId.value || undefined
    serverStatusWarning.value = ''
    try {
      const body = await $fetch<ChromiumHistoryStatusResponse>(`${apiBase}/status`, {
        query: { profileId }
      })
      if (requestId !== statusRequestId) return
      serverAutoLoadAvailable.value = Boolean(body?.available)
      serverDbPath.value = typeof body?.path === 'string' ? body.path : ''
      serverPermissionHint.value = Boolean(body?.present) && !body?.readable
    } catch (err) {
      if (requestId !== statusRequestId) return
      serverPermissionHint.value = false
      // A same-origin same-machine request being rejected (403) means the
      // server-side localhost check itself failed, not that this deployment
      // simply lacks a Nitro server — surface that instead of silently
      // falling back to drag & drop, which otherwise looks identical to
      // "feature not available" and hides the real cause.
      if (err instanceof FetchError && err.statusCode === 403) {
        serverStatusWarning.value =
          err.data?.message ?? 'サーバー側の制限により自動読み込みが利用できません。'
      }
      // No Nitro server backing this deployment (e.g. static hosting) — stay with drag & drop only.
      serverAutoLoadAvailable.value = false
    }
  }

  async function loadProfiles() {
    try {
      const body = await $fetch<ChromiumHistoryProfilesResponse>(`${apiBase}/profiles`)
      const profiles: ChromiumProfile[] = Array.isArray(body?.profiles) ? body.profiles : []
      serverProfiles.value = profiles
      if (!selectedProfileId.value) {
        const defaultProfile = profiles.find((p) => p.isDefault) ?? profiles[0]
        selectedProfileId.value = defaultProfile?.id ?? ''
      }
    } catch {
      // Same fallback as checkServerAutoLoadAvailability(): no Nitro server, or
      // the localhost/same-origin check rejected the request. Either way, stay
      // with drag & drop only and no profile picker.
      serverProfiles.value = []
    }
  }

  async function onProfileChange(profileId: string) {
    selectedProfileId.value = profileId
    await checkServerAutoLoadAvailability()
  }

  async function loadFromServer() {
    if (isLoading.value) return
    isLoading.value = true
    loadError.value = ''
    try {
      const blob = await $fetch<Blob>(apiBase, {
        query: { profileId: selectedProfileId.value || undefined }
      })
      const result = await parseChromiumHistoryFile(new File([blob], 'History'))
      visits.value = result.visits
      fileName.value = result.fileName
    } catch (err) {
      if (err instanceof FetchError) {
        loadError.value = err.data?.message ?? 'History の自動読み込みに失敗しました。'
      } else {
        loadError.value = err instanceof Error ? err.message : '不明なエラーが発生しました。'
      }
    } finally {
      isLoading.value = false
    }
  }

  function openDetail(visit: ChromiumHistoryVisit) {
    selectedVisit.value = visit
    detailDialog.value = true
  }

  function resetAll() {
    visits.value = []
    fileName.value = ''
    search.value = ''
    resetDebouncedSearch()
    domainFilter.value = null
    dateFrom.value = null
    dateTo.value = null
    onlyTyped.value = false
    onlyRedirects.value = false
    onlyHidden.value = false
  }

  onMounted(async () => {
    await Promise.all([checkServerAutoLoadAvailability(), loadProfiles()])
  })

  return {
    visits,
    fileName,
    isLoading,
    loadError,
    serverAutoLoadAvailable,
    serverDbPath,
    serverPermissionHint,
    serverStatusWarning,
    serverProfiles,
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
    hasData,
    domainOptions,
    filteredVisits,
    topDomains,
    dateRangeLabel,
    uniqueUrlCount,
    uniqueDomainCount,
    loadFile,
    onProfileChange,
    loadFromServer,
    openDetail,
    resetAll
  }
}
