<script setup lang="ts">
import { exportUnifiedVisitsAsCsv, exportUnifiedVisitsAsJson } from '~/utils/export'
import type { UnifiedHistorySource, UnifiedHistoryVisit } from '~/types/history'
import { unifiedSourceMeta, UNIFIED_HISTORY_SOURCES } from '~/utils/unifiedHistory'
import BaseFilterBar from './BaseFilterBar.vue'

const props = defineProps<{
  domainOptions: { title: string; value: string }[]
  filteredVisits: UnifiedHistoryVisit[]
  totalCount: number
}>()

const search = defineModel<string>('search', { required: true })
const domainFilter = defineModel<string[]>('domainFilter', { required: true })
const dateFrom = defineModel<Date | null>('dateFrom', { required: true })
const dateTo = defineModel<Date | null>('dateTo', { required: true })
const enabledSources = defineModel<UnifiedHistorySource[]>('enabledSources', { required: true })
</script>

<template>
  <BaseFilterBar
    v-model:search="search"
    v-model:domain-filter="domainFilter"
    v-model:date-from="dateFrom"
    v-model:date-to="dateTo"
    testid-prefix="unified-"
    :domain-options="domainOptions"
    :filtered-count="filteredVisits.length"
    :total-count="totalCount"
    @export-json="exportUnifiedVisitsAsJson(props.filteredVisits)"
    @export-csv="exportUnifiedVisitsAsCsv(props.filteredVisits)"
  >
    <template #filters>
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
    </template>
  </BaseFilterBar>
</template>
