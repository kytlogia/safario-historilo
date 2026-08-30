<script setup lang="ts">
import { useI18n } from 'vue-i18n'

const { t } = useI18n()
const {
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
  weekdayTrend,
  hourlyTrend,
  uniqueUrlCount,
  uniqueDomainCount,
  loadFile,
  onProfileChange,
  loadFromServer,
  openDetail,
  resetAll
} = useChromiumHistoryPage('vivaldi')

const { isDark, toggleTheme } = useAppTheme()
</script>

<template>
  <div>
    <v-app-bar flat density="comfortable" color="surface">
      <v-app-bar-title>
        <v-icon icon="mdi-web" class="mr-2" />
        Vivaldi History Detail
      </v-app-bar-title>
      <template #append>
        <template v-if="hasData">
          <span class="text-body-2 text-medium-emphasis mr-4">{{ fileName }}</span>
          <v-btn variant="tonal" prepend-icon="mdi-refresh" class="mr-2" @click="resetAll">{{
            t('common.loadAnotherFile')
          }}</v-btn>
        </template>
        <BrowserNavLinks current="vivaldi" />
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
          brand="vivaldi"
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
                <ChromiumFilterBar
                  v-model:search="search"
                  v-model:domain-filter="domainFilter"
                  v-model:date-from="dateFrom"
                  v-model:date-to="dateTo"
                  v-model:only-typed="onlyTyped"
                  v-model:only-redirects="onlyRedirects"
                  v-model:only-hidden="onlyHidden"
                  brand="vivaldi"
                  :domain-options="domainOptions"
                  :filtered-visits="filteredVisits"
                  :total-count="visits.length"
                />

                <v-divider />

                <ChromiumVisitsTable :items="filteredVisits" @row-click="openDetail" />
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

    <ChromiumVisitDetailDialog v-model="detailDialog" :visit="selectedVisit" />
  </div>
</template>
