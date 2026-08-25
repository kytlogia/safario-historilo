<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { exportUnifiedVisitsAsCsv, exportUnifiedVisitsAsJson } from '~/utils/export'
import type { UnifiedHistorySource, UnifiedHistoryVisit } from '~/types/history'
import { unifiedSourceMeta, UNIFIED_HISTORY_SOURCES } from '~/utils/unifiedHistory'
import { formatDateInputValue, formatNumber } from '~/utils/format'
import { useAppLocale } from '~/composables/useAppLocale'

const { t } = useI18n()
const { intlLocale } = useAppLocale()

defineProps<{
  domainOptions: { title: string; value: string }[]
  filteredVisits: UnifiedHistoryVisit[]
  totalCount: number
}>()

const search = defineModel<string>('search', { required: true })
const domainFilter = defineModel<string | null>('domainFilter', { required: true })
const dateFrom = defineModel<Date | null>('dateFrom', { required: true })
const dateTo = defineModel<Date | null>('dateTo', { required: true })
const enabledSources = defineModel<UnifiedHistorySource[]>('enabledSources', { required: true })

// v-autocomplete's default filter matches the displayed title, which includes
// the "(件数)" suffix — restrict matching to the domain itself so typing a
// number that happens to be another domain's visit count doesn't match it.
function filterDomainOption(_itemTitle: string, query: string, item?: { value: string }) {
  return (item?.value ?? '').toLowerCase().includes(query.toLowerCase())
}
</script>

<template>
  <v-card-text>
    <v-row>
      <v-col cols="12" sm="6" md="4">
        <v-text-field
          v-model="search"
          data-testid="unified-search-input"
          :label="t('components.filterBar.searchLabel')"
          prepend-inner-icon="mdi-magnify"
          variant="outlined"
          density="comfortable"
          clearable
          hide-details
        />
      </v-col>
      <v-col cols="12" sm="6" md="4">
        <v-autocomplete
          v-model="domainFilter"
          data-testid="unified-domain-filter"
          :items="domainOptions"
          :custom-filter="filterDomainOption"
          :label="t('components.filterBar.domainLabel')"
          variant="outlined"
          density="comfortable"
          clearable
          hide-details
        >
          <template #clear="{ props: clearProps }">
            <v-icon icon="$clear" data-testid="unified-domain-filter-clear" v-bind="clearProps" />
          </template>
        </v-autocomplete>
      </v-col>
      <v-col cols="6" md="2">
        <v-date-input
          v-model="dateFrom"
          data-testid="unified-date-from-input"
          :label="t('components.filterBar.dateFromLabel')"
          variant="outlined"
          density="comfortable"
          :display-format="(date: unknown) => formatDateInputValue(date, intlLocale)"
          hide-details
          clearable
        />
      </v-col>
      <v-col cols="6" md="2">
        <v-date-input
          v-model="dateTo"
          data-testid="unified-date-to-input"
          :label="t('components.filterBar.dateToLabel')"
          variant="outlined"
          density="comfortable"
          :display-format="(date: unknown) => formatDateInputValue(date, intlLocale)"
          hide-details
          clearable
        />
      </v-col>
    </v-row>
    <v-row class="mt-1">
      <v-col cols="12" class="d-flex flex-wrap ga-2 align-center">
        <v-chip-group v-model="enabledSources" multiple data-testid="unified-source-filter">
          <v-chip
            v-for="source in UNIFIED_HISTORY_SOURCES"
            :key="source"
            :value="source"
            :prepend-icon="unifiedSourceMeta(source).icon"
            :color="unifiedSourceMeta(source).color"
            filter
            variant="tonal"
            size="small"
            :data-testid="`unified-source-chip-${source}`"
          >
            {{ unifiedSourceMeta(source).label }}
          </v-chip>
        </v-chip-group>
        <v-spacer />
        <span class="text-body-2 text-medium-emphasis" data-testid="unified-visible-count">
          {{
            t('components.filterBar.visibleCount', {
              shown: formatNumber(filteredVisits.length, intlLocale),
              total: formatNumber(totalCount, intlLocale)
            })
          }}
        </span>
        <v-btn
          data-testid="unified-export-json-button"
          variant="text"
          size="small"
          prepend-icon="mdi-code-json"
          @click="exportUnifiedVisitsAsJson(filteredVisits)"
        >
          {{ t('components.filterBar.exportJson') }}
        </v-btn>
        <v-btn
          data-testid="unified-export-csv-button"
          variant="text"
          size="small"
          prepend-icon="mdi-file-delimited-outline"
          @click="exportUnifiedVisitsAsCsv(filteredVisits)"
        >
          {{ t('components.filterBar.exportCsv') }}
        </v-btn>
      </v-col>
    </v-row>
  </v-card-text>
</template>
