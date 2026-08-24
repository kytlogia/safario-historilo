<script setup lang="ts">
const {
  safari,
  firefox,
  chrome,
  edge,
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
  uniqueUrlCount,
  uniqueDomainCount,
  selectedVisit,
  detailDialog,
  openDetail,
  resetFilters
} = useUnifiedHistoryPage()

const { isDark, toggleTheme } = useAppTheme()

function resetAllSources() {
  safari.reset()
  firefox.reset()
  chrome.reset()
  edge.reset()
  resetFilters()
}
</script>

<template>
  <div>
    <v-app-bar flat density="comfortable" color="surface">
      <v-app-bar-title>
        <v-icon icon="mdi-magnify" class="mr-2" />
        横断検索
      </v-app-bar-title>
      <template #append>
        <v-btn
          v-if="hasData"
          variant="tonal"
          prepend-icon="mdi-refresh"
          class="mr-2"
          data-testid="unified-reset-all-button"
          @click="resetAllSources"
          >すべてクリア</v-btn
        >
        <v-btn variant="text" to="/" prepend-icon="mdi-compass-outline" class="mr-2"
          >Safariの履歴を見る</v-btn
        >
        <v-btn variant="text" to="/firefox" prepend-icon="mdi-fire" class="mr-2"
          >Firefoxの履歴を見る</v-btn
        >
        <v-btn variant="text" to="/chrome" prepend-icon="mdi-google-chrome" class="mr-2"
          >Chromeの履歴を見る</v-btn
        >
        <v-btn variant="text" to="/edge" prepend-icon="mdi-microsoft-edge" class="mr-2"
          >Edgeの履歴を見る</v-btn
        >
        <v-btn
          :icon="isDark ? 'mdi-weather-sunny' : 'mdi-weather-night'"
          :aria-label="isDark ? 'ライトテーマに切り替え' : 'ダークテーマに切り替え'"
          variant="text"
          @click="toggleTheme"
        />
      </template>
    </v-app-bar>

    <v-main>
      <v-container fluid class="py-6">
        <v-row>
          <v-col cols="12" sm="6" lg="3">
            <UnifiedSourceCard
              label="Safari"
              icon="mdi-compass-outline"
              color="primary"
              :is-loading="safari.isLoading.value"
              :load-error="safari.loadError.value"
              :has-data="safari.hasData.value"
              :visit-count="safari.unifiedVisits.value.length"
              :file-name="safari.fileName.value"
              :server-auto-load-available="safari.serverAutoLoadAvailable.value"
              :server-db-path="safari.serverDbPath.value"
              :server-permission-hint="safari.serverPermissionHint.value"
              :server-status-warning="safari.serverStatusWarning.value"
              :server-profiles="safari.serverProfiles.value"
              :selected-profile-id="safari.selectedProfileId.value"
              @file-selected="safari.loadFile"
              @load-from-server="safari.loadFromServer"
              @update:selected-profile-id="safari.onProfileChange"
              @reset="safari.reset"
            />
          </v-col>
          <v-col cols="12" sm="6" lg="3">
            <UnifiedSourceCard
              label="Firefox"
              icon="mdi-fire"
              color="orange"
              :is-loading="firefox.isLoading.value"
              :load-error="firefox.loadError.value"
              :has-data="firefox.hasData.value"
              :visit-count="firefox.unifiedVisits.value.length"
              :file-name="firefox.fileName.value"
              :server-auto-load-available="firefox.serverAutoLoadAvailable.value"
              :server-db-path="firefox.serverDbPath.value"
              :server-permission-hint="firefox.serverPermissionHint.value"
              :server-status-warning="firefox.serverStatusWarning.value"
              :server-profiles="firefox.serverProfiles.value"
              :selected-profile-id="firefox.selectedProfileId.value"
              @file-selected="firefox.loadFile"
              @load-from-server="firefox.loadFromServer"
              @update:selected-profile-id="firefox.onProfileChange"
              @reset="firefox.reset"
            />
          </v-col>
          <v-col cols="12" sm="6" lg="3">
            <UnifiedSourceCard
              label="Chrome"
              icon="mdi-google-chrome"
              color="blue"
              :is-loading="chrome.isLoading.value"
              :load-error="chrome.loadError.value"
              :has-data="chrome.hasData.value"
              :visit-count="chrome.unifiedVisits.value.length"
              :file-name="chrome.fileName.value"
              :server-auto-load-available="chrome.serverAutoLoadAvailable.value"
              :server-db-path="chrome.serverDbPath.value"
              :server-permission-hint="chrome.serverPermissionHint.value"
              :server-status-warning="chrome.serverStatusWarning.value"
              :server-profiles="chrome.serverProfiles.value"
              :selected-profile-id="chrome.selectedProfileId.value"
              @file-selected="chrome.loadFile"
              @load-from-server="chrome.loadFromServer"
              @update:selected-profile-id="chrome.onProfileChange"
              @reset="chrome.reset"
            />
          </v-col>
          <v-col cols="12" sm="6" lg="3">
            <UnifiedSourceCard
              label="Edge"
              icon="mdi-microsoft-edge"
              color="teal"
              :is-loading="edge.isLoading.value"
              :load-error="edge.loadError.value"
              :has-data="edge.hasData.value"
              :visit-count="edge.unifiedVisits.value.length"
              :file-name="edge.fileName.value"
              :server-auto-load-available="edge.serverAutoLoadAvailable.value"
              :server-db-path="edge.serverDbPath.value"
              :server-permission-hint="edge.serverPermissionHint.value"
              :server-status-warning="edge.serverStatusWarning.value"
              :server-profiles="edge.serverProfiles.value"
              :selected-profile-id="edge.selectedProfileId.value"
              @file-selected="edge.loadFile"
              @load-from-server="edge.loadFromServer"
              @update:selected-profile-id="edge.onProfileChange"
              @reset="edge.reset"
            />
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
            </v-col>
          </v-row>
        </template>

        <v-empty-state
          v-else
          icon="mdi-magnify"
          size="56"
          class="mt-6"
          title="読み込み済みのデータがありません"
          text="上のカードから、横断検索したいブラウザの履歴ファイルを1つ以上読み込んでください。"
        />
      </v-container>
    </v-main>

    <UnifiedVisitDetailDialog v-model="detailDialog" :visit="selectedVisit" />
  </div>
</template>
