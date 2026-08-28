<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { exportFirefoxVisitsAsCsv, exportFirefoxVisitsAsJson } from '~/utils/export'
import type { FirefoxHistoryVisit } from '~/types/history'
import BaseFilterBar from './BaseFilterBar.vue'

const { t } = useI18n()

const props = defineProps<{
  domainOptions: { title: string; value: string }[]
  filteredVisits: FirefoxHistoryVisit[]
  totalCount: number
}>()

const search = defineModel<string>('search', { required: true })
const domainFilter = defineModel<string | null>('domainFilter', { required: true })
const dateFrom = defineModel<Date | null>('dateFrom', { required: true })
const dateTo = defineModel<Date | null>('dateTo', { required: true })
const onlyTyped = defineModel<boolean>('onlyTyped', { required: true })
const onlyRedirects = defineModel<boolean>('onlyRedirects', { required: true })
const onlyHidden = defineModel<boolean>('onlyHidden', { required: true })
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
    @export-json="exportFirefoxVisitsAsJson(props.filteredVisits)"
    @export-csv="exportFirefoxVisitsAsCsv(props.filteredVisits)"
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
