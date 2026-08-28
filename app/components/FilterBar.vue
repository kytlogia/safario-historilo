<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { exportVisitsAsCsv, exportVisitsAsJson } from '~/utils/export'
import type { HistoryVisit } from '~/types/history'
import BaseFilterBar from './BaseFilterBar.vue'

const { t } = useI18n()

const props = defineProps<{
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
</script>

<template>
  <BaseFilterBar
    v-model:search="search"
    v-model:domain-filter="domainFilter"
    v-model:date-from="dateFrom"
    v-model:date-to="dateTo"
    :domain-options="domainOptions"
    :filtered-count="filteredVisits.length"
    :total-count="totalCount"
    @export-json="exportVisitsAsJson(props.filteredVisits)"
    @export-csv="exportVisitsAsCsv(props.filteredVisits)"
  >
    <template #filters>
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
    </template>
  </BaseFilterBar>
</template>
