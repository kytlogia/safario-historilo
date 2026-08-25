<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { exportVisitsAsCsv, exportVisitsAsJson } from '~/utils/export'
import { formatDateInputValue } from '~/utils/format'
import type { HistoryVisit } from '~/types/history'
import { useAppLocale } from '~/composables/useAppLocale'

const { t } = useI18n()
const { intlLocale } = useAppLocale()

defineProps<{
  domainOptions: { title: string; value: string }[]
  filteredVisits: HistoryVisit[]
  totalCount: number
}>()

const search = defineModel<string>('search', { required: true })
const domainFilter = defineModel<string | null>('domainFilter', { required: true })
const dateFrom = defineModel<Date | null>('dateFrom', { required: true })
const dateTo = defineModel<Date | null>('dateTo', { required: true })
const onlyFailed = defineModel<boolean>('onlyFailed', { required: true })
const onlyRedirects = defineModel<boolean>('onlyRedirects', { required: true })
const onlySynthesized = defineModel<boolean>('onlySynthesized', { required: true })

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
          data-testid="search-input"
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
          data-testid="domain-filter"
          :items="domainOptions"
          :custom-filter="filterDomainOption"
          :label="t('components.filterBar.domainLabel')"
          variant="outlined"
          density="comfortable"
          clearable
          hide-details
        >
          <template #clear="{ props: clearProps }">
            <v-icon icon="$clear" data-testid="domain-filter-clear" v-bind="clearProps" />
          </template>
        </v-autocomplete>
      </v-col>
      <v-col cols="6" md="2">
        <v-date-input
          v-model="dateFrom"
          data-testid="date-from-input"
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
          data-testid="date-to-input"
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
        <v-checkbox
          v-model="onlyFailed"
          data-testid="only-failed-checkbox"
          :label="t('components.filterBar.onlyFailed')"
          density="compact"
          hide-details
        />
        <v-checkbox
          v-model="onlyRedirects"
          data-testid="only-redirects-checkbox"
          :label="t('components.filterBar.onlyRedirects')"
          density="compact"
          hide-details
        />
        <v-checkbox
          v-model="onlySynthesized"
          data-testid="only-synthesized-checkbox"
          :label="t('components.filterBar.onlySynthesized')"
          density="compact"
          hide-details
        />
        <v-spacer />
        <span class="text-body-2 text-medium-emphasis" data-testid="visible-count">
          {{
            t('components.filterBar.visibleCount', {
              shown: filteredVisits.length.toLocaleString(),
              total: totalCount.toLocaleString()
            })
          }}
        </span>
        <v-btn
          data-testid="export-json-button"
          variant="text"
          size="small"
          prepend-icon="mdi-code-json"
          @click="exportVisitsAsJson(filteredVisits)"
        >
          {{ t('components.filterBar.exportJson') }}
        </v-btn>
        <v-btn
          data-testid="export-csv-button"
          variant="text"
          size="small"
          prepend-icon="mdi-file-delimited-outline"
          @click="exportVisitsAsCsv(filteredVisits)"
        >
          {{ t('components.filterBar.exportCsv') }}
        </v-btn>
      </v-col>
    </v-row>
  </v-card-text>
</template>
