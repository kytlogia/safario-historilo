<script setup lang="ts">
import { formatDateTime } from '~/utils/format'
import { formatFirefoxVisitType } from '~/utils/firefoxVisitType'
import type { FirefoxHistoryVisit } from '~/types/history'
import TruncatedCell from './TruncatedCell.vue'

defineProps<{
  items: FirefoxHistoryVisit[]
}>()

const emit = defineEmits<{
  'row-click': [visit: FirefoxHistoryVisit]
}>()

const headers = [
  { title: 'タイトル', key: 'title', width: '28%' },
  { title: 'URL', key: 'url', width: '28%' },
  { title: 'ドメイン', key: 'domain', width: 170 },
  { title: '訪問日時', key: 'visitTime', width: 190 },
  { title: 'URL累計訪問回数', key: 'visitCount', width: 130, align: 'end' as const },
  { title: '種別', key: 'flags', width: 170, sortable: false },
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
    @click:row="(_e: Event, row: { item: FirefoxHistoryVisit }) => emit('row-click', row.item)"
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
      <v-chip size="x-small" variant="flat" class="mr-1">{{
        formatFirefoxVisitType(item.visitType)
      }}</v-chip>
      <v-chip v-if="item.hidden" size="x-small" color="secondary" variant="flat">非表示</v-chip>
    </template>
    <template #item.actions="{ item }">
      <v-btn
        icon="mdi-information-outline"
        variant="text"
        size="small"
        aria-label="詳細を見る"
        data-testid="row-detail-button"
        @click.stop="emit('row-click', item)"
      />
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
