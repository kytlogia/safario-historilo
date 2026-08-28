<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { exportChromiumVisitsAsCsv, exportChromiumVisitsAsJson } from '~/utils/export'
import type { ChromiumHistoryVisit } from '~/types/history'
import BaseFilterBar from './BaseFilterBar.vue'

const { t } = useI18n()

const props = defineProps<{
  brand: 'chrome' | 'edge'
  domainOptions: { title: string; value: string }[]
  filteredVisits: ChromiumHistoryVisit[]
  totalCount: number
}>()

const search = defineModel<string>('search', { required: true })
const domainFilter = defineModel<string | null>('domainFilter', { required: true })
const dateFrom = defineModel<Date | null>('dateFrom', { required: true })
const dateTo = defineModel<Date | null>('dateTo', { required: true })
const onlyTyped = defineModel<boolean>('onlyTyped', { required: true })
const onlyRedirects = defineModel<boolean>('onlyRedirects', { required: true })
const onlyHidden = defineModel<boolean>('onlyHidden', { required: true })

function exportJson() {
  exportChromiumVisitsAsJson(props.filteredVisits, `${props.brand}-history.json`)
}

function exportCsv() {
  exportChromiumVisitsAsCsv(props.filteredVisits, `${props.brand}-history.csv`)
}
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
    @export-json="exportJson"
    @export-csv="exportCsv"
  >
    <template #filters>
      <v-checkbox
        v-model="onlyTyped"
        data-testid="only-typed-checkbox"
        :label="t('components.filterBar.onlyTyped')"
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
        v-model="onlyHidden"
        data-testid="only-hidden-checkbox"
        :label="t('components.filterBar.onlyHidden')"
        density="compact"
        hide-details
      />
    </template>
  </BaseFilterBar>
</template>
