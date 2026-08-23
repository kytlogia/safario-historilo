<script setup lang="ts">
import { formatDateTime } from '~/utils/format'
import type { UnifiedHistoryVisit } from '~/types/history'
import { unifiedSourceMeta } from '~/utils/unifiedHistory'
import TruncatedCell from './TruncatedCell.vue'

defineProps<{
  items: UnifiedHistoryVisit[]
}>()

const emit = defineEmits<{
  'row-click': [visit: UnifiedHistoryVisit]
}>()

// UnifiedHistoryVisit has no stable id of its own (it's a merged projection
// of four different visit types) — key rows by source + url + timestamp,
// which is unique enough to satisfy v-data-table-virtual's internal tracking.
function rowKey(item: UnifiedHistoryVisit) {
  return `${item.source}:${item.url}:${item.visitTime.getTime()}`
}

const headers = [
  { title: 'ソース', key: 'source', width: 120 },
  { title: 'タイトル', key: 'title', width: '26%' },
  { title: 'URL', key: 'url', width: '26%' },
  { title: 'ドメイン', key: 'domain', width: 160 },
  { title: '訪問日時', key: 'visitTime', width: 190 },
  { title: '累計訪問回数', key: 'visitCount', width: 110, align: 'end' as const }
]
</script>

<template>
  <v-data-table-virtual
    :headers="headers"
    :items="items"
    :item-value="rowKey"
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
      {{ formatDateTime(item.visitTime) }}
    </template>
    <template #item.visitCount="{ item }">
      {{ item.visitCount.toLocaleString() }}
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
