<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { BROWSER_CATALOG } from '~/utils/browserCatalog'

const { t } = useI18n()
const {
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
} = useUnifiedHistoryPage()

const { isDark, toggleTheme } = useAppTheme()

// Only the cards the user added (see issue #156) — order follows
// BROWSER_CATALOG so it stays stable regardless of add order.
const sourceCards = computed(() =>
  BROWSER_CATALOG.filter((entry) => activeSources.value.includes(entry.id)).map((entry) => {
    const source = sources[entry.id]
    if (!source) {
      throw new Error(`No unified history source wired up for browser catalog entry: ${entry.id}`)
    }
    return { entry, source }
  })
)
const addableSources = computed(() =>
  BROWSER_CATALOG.filter((entry) => !activeSources.value.includes(entry.id))
)

function resetAllSources() {
  for (const source of Object.values(sources)) source.reset()
  resetFilters()
}
</script>

<template>
  <div>
    <v-app-bar flat density="comfortable" color="surface">
      <v-app-bar-title>
        <v-icon icon="mdi-magnify" class="mr-2" />
        {{ t('nav.crossSearch') }}
      </v-app-bar-title>
      <template #append>
        <v-btn
          v-if="hasData"
          variant="tonal"
          prepend-icon="mdi-refresh"
          class="mr-2"
          data-testid="unified-reset-all-button"
          @click="resetAllSources"
          >{{ t('nav.clearAll') }}</v-btn
        >
        <BrowserNavLinks />
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
        <v-row class="align-center">
          <v-col v-for="{ entry, source } in sourceCards" :key="entry.id" cols="12" sm="6" lg="3">
            <UnifiedSourceCard
              :label="entry.label"
              :icon="entry.icon"
              :color="entry.color"
              :is-loading="source.isLoading.value"
              :load-error="source.loadError.value"
              :has-data="source.hasData.value"
              :visit-count="source.unifiedVisits.value.length"
              :file-name="source.fileName.value"
              :server-auto-load-available="source.serverAutoLoadAvailable.value"
              :server-db-path="source.serverDbPath.value"
              :server-permission-hint="source.serverPermissionHint.value"
              :server-status-warning="source.serverStatusWarning.value"
              :server-profiles="source.serverProfiles.value"
              :selected-profile-id="source.selectedProfileId.value"
              @file-selected="source.loadFile"
              @load-from-server="source.loadFromServer"
              @update:selected-profile-id="source.onProfileChange"
              @reset="source.reset"
              @close="removeSource(entry.id)"
            />
          </v-col>

          <v-col v-if="addableSources.length" cols="12" sm="6" lg="3">
            <v-menu>
              <template #activator="{ props: menuProps }">
                <v-btn
                  variant="outlined"
                  prepend-icon="mdi-plus"
                  height="100%"
                  min-height="56"
                  block
                  data-testid="unified-add-source-button"
                  v-bind="menuProps"
                >
                  {{ t('pages.all.addSource') }}
                </v-btn>
              </template>
              <v-list>
                <v-list-item
                  v-for="entry in addableSources"
                  :key="entry.id"
                  :prepend-icon="entry.icon"
                  :title="entry.label"
                  :data-testid="`unified-add-source-${entry.id}`"
                  @click="addSource(entry.id)"
                />
              </v-list>
            </v-menu>
          </v-col>
        </v-row>

        <template v-if="hasData">
          <SummaryCards
            :total-visits="visits.length"
            :unique-url-count="uniqueUrlCount"
            :unique-domain-count="uniqueDomainCount"
            :date-range-label="dateRangeLabel"
            class="mt-6"
          />

          <v-row class="mt-2">
            <v-col cols="12" md="9">
              <v-card>
                <UnifiedFilterBar
                  v-model:search="search"
                  v-model:domain-filter="domainFilter"
                  v-model:date-from="dateFrom"
                  v-model:date-to="dateTo"
                  v-model:enabled-sources="enabledSources"
                  :domain-options="domainOptions"
                  :filtered-visits="filteredVisits"
                  :total-count="visits.length"
                />

                <v-divider />

                <UnifiedVisitsTable :items="filteredVisits" @row-click="openDetail" />
              </v-card>
            </v-col>

            <v-col cols="12" md="3">
              <TopDomains :top-domains="topDomains" />
              <VisitTrends :weekday-trend="weekdayTrend" :hourly-trend="hourlyTrend" class="mt-4" />
            </v-col>
          </v-row>
        </template>

        <v-empty-state
          v-else
          icon="mdi-magnify"
          size="56"
          class="mt-6"
          :title="t('pages.all.emptyTitle')"
          :text="sourceCards.length ? t('pages.all.emptyText') : t('pages.all.noSourcesText')"
        />
      </v-container>
    </v-main>

    <UnifiedVisitDetailDialog v-model="detailDialog" :visit="selectedVisit" />
  </div>
</template>
