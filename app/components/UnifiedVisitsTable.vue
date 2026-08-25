<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { formatDateTime, formatNumber } from '~/utils/format'
import type { UnifiedHistoryVisit } from '~/types/history'
import { unifiedSourceMeta } from '~/utils/unifiedHistory'
import { useAppLocale } from '~/composables/useAppLocale'
import TruncatedCell from './TruncatedCell.vue'

const props = defineProps<{
  items: UnifiedHistoryVisit[]
}>()

const emit = defineEmits<{
  'row-click': [visit: UnifiedHistoryVisit]
}>()

const { t } = useI18n()
const { intlLocale } = useAppLocale()

// UnifiedHistoryVisit has no stable id of its own (it's a merged projection
// of four different visit types), and a composite key like
// `source:url:visitTime` can still collide — e.g. the same URL visited twice
// in the same source within the same millisecond. Decorate each row with its
// position in the current `items` array instead: it's guaranteed unique for
// any given render, which is all v-data-table-virtual's internal tracking
// needs (it isn't persisted across items array changes, e.g. re-filtering).
const indexedItems = computed(() => props.items.map((item, rowIndex) => ({ ...item, rowIndex })))

const headers = computed(() => [
  { title: t('components.visitsTable.headerSource'), key: 'source', width: 120 },
  { title: t('components.visitsTable.headerTitle'), key: 'title', width: '26%' },
  { title: t('components.visitsTable.headerUrl'), key: 'url', width: '26%' },
  { title: t('components.visitsTable.headerDomain'), key: 'domain', width: 160 },
  { title: t('components.visitsTable.headerVisitTime'), key: 'visitTime', width: 190 },
  {
    title: t('components.visitsTable.headerVisitCountUnified'),
    key: 'visitCount',
    width: 110,
    align: 'end' as const
  }
])
</script>

<template>
  <v-data-table-virtual
    :headers="headers"
    :items="indexedItems"
    item-value="rowIndex"
    height="600"
    fixed-header
    @click:row="(_e: Event, row: { item: UnifiedHistoryVisit }) => emit('row-click', row.item)"
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
    <template #item.title="{ item }">
      <TruncatedCell :text="item.title" />
    </template>
    <template #item.url="{ item }">
      <TruncatedCell :text="item.url" class="text-medium-emphasis" />
    </template>
    <template #item.domain="{ item }">
      <TruncatedCell :text="item.domain" />
    </template>
    <template #item.visitTime="{ item }">
      {{ formatDateTime(item.visitTime, intlLocale) }}
    </template>
    <template #item.visitCount="{ item }">
      {{ formatNumber(item.visitCount, intlLocale) }}
    </template>
  </v-data-table-virtual>
</template>

<style scoped>
/* tr/tableはVuetifyが内部でレンダリングするため、独自クラスを付与できず要素セレクタで指定する */
:deep(tr) {
  cursor: pointer;
}
:deep(table) {
  table-layout: fixed;
}
</style>
