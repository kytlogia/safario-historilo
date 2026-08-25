<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { formatDateTime, formatNumber } from '~/utils/format'
import type { HistoryVisit } from '~/types/history'
import { useAppLocale } from '~/composables/useAppLocale'
import TruncatedCell from './TruncatedCell.vue'

defineProps<{
  items: HistoryVisit[]
}>()

const emit = defineEmits<{
  'row-click': [visit: HistoryVisit]
}>()

const { t } = useI18n()
const { intlLocale } = useAppLocale()

const headers = computed(() => [
  { title: t('components.visitsTable.headerTitle'), key: 'title', width: '28%' },
  { title: t('components.visitsTable.headerUrl'), key: 'url', width: '28%' },
  { title: t('components.visitsTable.headerDomain'), key: 'domain', width: 170 },
  { title: t('components.visitsTable.headerVisitTime'), key: 'visitTime', width: 190 },
  {
    title: t('components.visitsTable.headerVisitCount'),
    key: 'visitCount',
    width: 130,
    align: 'end' as const
  },
  { title: t('components.visitsTable.headerStatus'), key: 'flags', width: 150, sortable: false },
  {
    title: t('components.visitsTable.headerActions'),
    key: 'actions',
    width: 56,
    sortable: false,
    align: 'center' as const
  }
])
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
      {{ formatDateTime(item.visitTime, intlLocale) }}
    </template>
    <template #item.visitCount="{ item }">
      {{ formatNumber(item.visitCount, intlLocale) }}
    </template>
    <template #item.flags="{ item }">
      <v-chip
        v-if="!item.loadSuccessful"
        size="x-small"
        color="error"
        variant="flat"
        class="mr-1"
        >{{ t('components.visitsTable.flagFailed') }}</v-chip
      >
      <v-chip
        v-if="item.redirectSource !== null || item.redirectDestination !== null"
        size="x-small"
        color="warning"
        variant="flat"
        class="mr-1"
      >
        {{ t('components.visitsTable.flagRedirect') }}
      </v-chip>
      <v-chip v-if="item.synthesized" size="x-small" color="secondary" variant="flat">{{
        t('components.visitsTable.flagSynthesized')
      }}</v-chip>
    </template>
    <template #item.actions="{ item }">
      <v-btn
        icon="mdi-information-outline"
        variant="text"
        size="small"
        :aria-label="t('components.visitsTable.detailAriaLabel')"
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
