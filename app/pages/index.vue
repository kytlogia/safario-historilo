<script setup lang="ts">
import { FetchError } from 'ofetch'
import { useI18n } from 'vue-i18n'
import type { HistoryVisit, SafariProfile } from '~/types/history'
import {
  booleanCodec,
  filterField,
  nullableDateCodec,
  nullableStringCodec,
  stringCodec
} from '~/composables/useFilterPersistence'
import { useAppLocale, useVisitFilterI18n } from '~/composables/useAppLocale'
import { DEFAULT_PROFILE_ID } from '../../shared/utils/profile'

const { t } = useI18n()
const { currentLocale } = useAppLocale()

const visits = ref<HistoryVisit[]>([])
const fileName = ref('')
const isLoading = ref(false)
const loadError = ref('')

const serverAutoLoadAvailable = ref(false)
const serverDbPath = ref('')
const serverPermissionHint = ref(false)
const serverStatusWarning = ref('')

const serverProfiles = ref<SafariProfile[]>([])
const selectedProfileId = ref(DEFAULT_PROFILE_ID)

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

const hasData = computed(() => visits.value.length > 0)

const { domainOptions, filteredVisits, topDomains, dateRangeLabel, weekdayTrend, hourlyTrend } =
  useHistoryFilters(
    visits,
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

const uniqueUrlCount = computed(() => new Set(visits.value.map((v) => v.url)).size)
const uniqueDomainCount = computed(() => new Set(visits.value.map((v) => v.domain)).size)

async function loadFile(file: File | null | undefined) {
  if (!file || isLoading.value) return
  isLoading.value = true
  loadError.value = ''
  try {
    const result = await parseSafariHistoryFile(file, currentLocale.value)
    visits.value = result.visits
    fileName.value = result.fileName
  } catch (err) {
    loadError.value = err instanceof Error ? err.message : t('error.unknown')
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
  const profileId = selectedProfileId.value
  serverStatusWarning.value = ''
  try {
    const body = await $fetch('/api/local-history/status', { query: { profileId } })
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
      serverStatusWarning.value = err.data?.message ?? t('error.serverRestricted')
    }
    // No Nitro server backing this deployment (e.g. static hosting) — stay with drag & drop only.
    serverAutoLoadAvailable.value = false
  }
}

async function loadSafariProfiles() {
  try {
    const body = await $fetch('/api/local-history/profiles')
    serverProfiles.value = Array.isArray(body?.profiles) ? body.profiles : []
  } catch {
    // Same fallback as checkServerAutoLoadAvailability(): no Nitro server, or
    // the localhost/same-origin check rejected the request. Either way, stay
    // with the single default profile and no profile picker.
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
    const blob = await $fetch<Blob>('/api/local-history', {
      query: { profileId: selectedProfileId.value }
    })
    const result = await parseSafariHistoryFile(new File([blob], 'History.db'), currentLocale.value)
    visits.value = result.visits
    fileName.value = result.fileName
  } catch (err) {
    if (err instanceof FetchError) {
      loadError.value = err.data?.message ?? t('error.autoLoadFailed.safari')
    } else {
      loadError.value = err instanceof Error ? err.message : t('error.unknown')
    }
  } finally {
    isLoading.value = false
  }
}

onMounted(async () => {
  await Promise.all([checkServerAutoLoadAvailability(), loadSafariProfiles()])
})

function openDetail(visit: HistoryVisit) {
  selectedVisit.value = visit
  detailDialog.value = true
}

const { isDark, toggleTheme } = useAppTheme()

function resetAll() {
  visits.value = []
  fileName.value = ''
  search.value = ''
  resetDebouncedSearch()
  domainFilter.value = null
  dateFrom.value = null
  dateTo.value = null
  onlyFailed.value = false
  onlyRedirects.value = false
  onlySynthesized.value = false
}
</script>

<template>
  <div>
    <v-app-bar flat density="comfortable" color="surface">
      <v-app-bar-title>
        <v-icon icon="mdi-compass-outline" class="mr-2" />
        Safari History Detail
      </v-app-bar-title>
      <template #append>
        <template v-if="hasData">
          <span class="text-body-2 text-medium-emphasis mr-4">{{ fileName }}</span>
          <v-btn variant="tonal" prepend-icon="mdi-refresh" class="mr-2" @click="resetAll">{{
            t('common.loadAnotherFile')
          }}</v-btn>
        </template>
        <v-btn variant="text" to="/firefox" prepend-icon="mdi-fire" class="mr-2">{{
          t('nav.viewFirefox')
        }}</v-btn>
        <v-btn variant="text" to="/chrome" prepend-icon="mdi-google-chrome" class="mr-2">{{
          t('nav.viewChrome')
        }}</v-btn>
        <v-btn variant="text" to="/edge" prepend-icon="mdi-microsoft-edge" class="mr-2">{{
          t('nav.viewEdge')
        }}</v-btn>
        <v-btn variant="text" to="/all" prepend-icon="mdi-magnify" class="mr-2">{{
          t('nav.crossSearch')
        }}</v-btn>
        <v-btn
          :icon="isDark ? 'mdi-weather-sunny' : 'mdi-weather-night'"
          :aria-label="isDark ? t('common.switchToLightTheme') : t('common.switchToDarkTheme')"
          variant="text"
          @click="toggleTheme"
        />
        <LocaleSwitcher />
      </template>
    </v-app-bar>

    <v-main>
      <v-container fluid class="py-6">
        <UploadPanel
          v-if="!hasData"
          :is-loading="isLoading"
          :load-error="loadError"
          :server-auto-load-available="serverAutoLoadAvailable"
          :server-db-path="serverDbPath"
          :server-permission-hint="serverPermissionHint"
          :server-status-warning="serverStatusWarning"
          :server-profiles="serverProfiles"
          :selected-profile-id="selectedProfileId"
          @file-selected="loadFile"
          @load-from-server="loadFromServer"
          @update:selected-profile-id="onProfileChange"
        />

        <template v-else>
          <SummaryCards
            :total-visits="visits.length"
            :unique-url-count="uniqueUrlCount"
            :unique-domain-count="uniqueDomainCount"
            :date-range-label="dateRangeLabel"
          />

          <v-row class="mt-2">
            <v-col cols="12" md="9">
              <v-card>
                <FilterBar
                  v-model:search="search"
                  v-model:domain-filter="domainFilter"
                  v-model:date-from="dateFrom"
                  v-model:date-to="dateTo"
                  v-model:only-failed="onlyFailed"
                  v-model:only-redirects="onlyRedirects"
                  v-model:only-synthesized="onlySynthesized"
                  :domain-options="domainOptions"
                  :filtered-visits="filteredVisits"
                  :total-count="visits.length"
                />

                <v-divider />

                <VisitsTable :items="filteredVisits" @row-click="openDetail" />
              </v-card>
            </v-col>

            <v-col cols="12" md="3">
              <TopDomains :top-domains="topDomains" />
              <VisitTrends :weekday-trend="weekdayTrend" :hourly-trend="hourlyTrend" class="mt-4" />
            </v-col>
          </v-row>
        </template>
      </v-container>
    </v-main>

    <VisitDetailDialog v-model="detailDialog" :visit="selectedVisit" />
  </div>
</template>
