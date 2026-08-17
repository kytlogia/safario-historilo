<script setup lang="ts">
import { formatDateTime } from '~/utils/format'
import type { HistoryVisit } from '~/types/history'

defineProps<{
  items: HistoryVisit[]
}>()

const emit = defineEmits<{
  'row-click': [visit: HistoryVisit]
}>()

const headers = [
  { title: 'タイトル', key: 'title', width: '28%' },
  { title: 'URL', key: 'url', width: '28%' },
  { title: 'ドメイン', key: 'domain', width: 170 },
  { title: '訪問日時', key: 'visitTime', width: 190 },
  { title: 'URL累計訪問回数', key: 'visitCount', width: 130, align: 'end' as const },
  { title: '状態', key: 'flags', width: 150, sortable: false },
  { title: '操作', key: 'actions', width: 56, sortable: false, align: 'center' as const }
]
</script>

<template>
  <v-data-table-virtual
    :headers="headers"
    :items="items"
    item-value="visitId"
    height="600"
    fixed-header
    @click:row="(_e: Event, row: { item: HistoryVisit }) => emit('row-click', row.item)"
  >
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
    <template #item.flags="{ item }">
      <v-chip v-if="!item.loadSuccessful" size="x-small" color="error" variant="flat" class="mr-1"
        >失敗</v-chip
      >
      <v-chip
        v-if="item.redirectSource !== null || item.redirectDestination !== null"
        size="x-small"
        color="warning"
        variant="flat"
        class="mr-1"
      >
        リダイレクト
      </v-chip>
      <v-chip v-if="item.synthesized" size="x-small" color="secondary" variant="flat">自動</v-chip>
    </template>
    <template #item.actions="{ item }">
      <v-btn
        icon="mdi-information-outline"
        variant="text"
        size="small"
        aria-label="詳細を見る"
        @click.stop="emit('row-click', item)"
      />
    </template>
  </v-data-table-virtual>
</template>

<style scoped>
:deep(tr) {
  cursor: pointer;
}
:deep(table) {
  table-layout: fixed;
}
</style>
