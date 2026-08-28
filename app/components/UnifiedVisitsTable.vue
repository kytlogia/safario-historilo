<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import type { UnifiedHistoryVisit } from '~/types/history'
import { unifiedSourceMeta } from '~/utils/unifiedHistory'
import BaseVisitsTable, { type VisitsTableHeader } from './BaseVisitsTable.vue'

const props = defineProps<{
  items: UnifiedHistoryVisit[]
}>()

const emit = defineEmits<{
  'row-click': [visit: UnifiedHistoryVisit]
}>()

const { t } = useI18n()

// UnifiedHistoryVisit has no stable id of its own (it's a merged projection
// of four different visit types), and a composite key like
// `source:url:visitTime` can still collide — e.g. the same URL visited twice
// in the same source within the same millisecond. Decorate each row with its
// position in the current `items` array instead: it's guaranteed unique for
// any given render, which is all v-data-table-virtual's internal tracking
// needs (it isn't persisted across items array changes, e.g. re-filtering).
const indexedItems = computed(() => props.items.map((item, rowIndex) => ({ ...item, rowIndex })))

const headers = computed<VisitsTableHeader[]>(() => [
  { title: t('components.visitsTable.headerSource'), key: 'source', width: 120 },
  { title: t('components.visitsTable.headerTitle'), key: 'title', width: '26%' },
  { title: t('components.visitsTable.headerUrl'), key: 'url', width: '26%' },
  { title: t('components.visitsTable.headerDomain'), key: 'domain', width: 160 },
  { title: t('components.visitsTable.headerVisitTime'), key: 'visitTime', width: 190 },
  {
    title: t('components.visitsTable.headerVisitCountUnified'),
    key: 'visitCount',
    width: 110,
    align: 'end'
  }
])
</script>

<template>
  <BaseVisitsTable
    :headers="headers"
    :items="indexedItems"
    item-value="rowIndex"
    @row-click="emit('row-click', $event)"
  >
    <template #item.source="{ item }">
      <v-chip
        size="small"
        variant="tonal"
        :color="unifiedSourceMeta(item.source).color"
        :prepend-icon="unifiedSourceMeta(item.source).icon"
      >
        {{ item.sourceLabel }}
      </v-chip>
    </template>
  </BaseVisitsTable>
</template>
