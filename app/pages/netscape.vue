<script setup lang="ts">
import { useI18n } from 'vue-i18n'

const { t } = useI18n()
const {
  visits,
  fileName,
  isLoading,
  loadError,
  search,
  domainFilter,
  dateFrom,
  dateTo,
  onlyTyped,
  onlyHidden,
  selectedVisit,
  detailDialog,
  hasData,
  domainOptions,
  filteredVisits,
  topDomains,
  dateRangeLabel,
  weekdayTrend,
  hourlyTrend,
  uniqueUrlCount,
  uniqueDomainCount,
  loadFile,
  openDetail,
  resetAll
} = useNetscapeHistoryPage()

const { isDark, toggleTheme } = useAppTheme()
</script>

<template>
  <div>
    <v-app-bar flat density="comfortable" color="surface">
      <v-app-bar-title>
        <v-icon icon="mdi-sail-boat" class="mr-2" />
        Netscape History Detail
      </v-app-bar-title>
      <template #append>
        <template v-if="hasData">
          <span class="text-body-2 text-medium-emphasis mr-4">{{ fileName }}</span>
          <v-btn variant="tonal" prepend-icon="mdi-refresh" class="mr-2" @click="resetAll">{{
            t('common.loadAnotherFile')
          }}</v-btn>
        </template>
        <BrowserNavLinks current="netscape" />
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
        <!-- Upload-only: Netscape is discontinued, so there is no local
        database to auto-load and no profile picker to show. -->
        <UploadPanel
          v-if="!hasData"
          brand="netscape"
          :is-loading="isLoading"
          :load-error="loadError"
          :server-auto-load-available="false"
          server-db-path=""
          :server-permission-hint="false"
          server-status-warning=""
          @file-selected="loadFile"
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
                <NetscapeFilterBar
                  v-model:search="search"
                  v-model:domain-filter="domainFilter"
                  v-model:date-from="dateFrom"
                  v-model:date-to="dateTo"
                  v-model:only-typed="onlyTyped"
                  v-model:only-hidden="onlyHidden"
                  :domain-options="domainOptions"
                  :filtered-visits="filteredVisits"
                  :total-count="visits.length"
                />

                <v-divider />

                <NetscapeVisitsTable :items="filteredVisits" @row-click="openDetail" />
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

    <NetscapeVisitDetailDialog v-model="detailDialog" :visit="selectedVisit" />
  </div>
</template>
