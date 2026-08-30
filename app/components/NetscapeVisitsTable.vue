<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import type { NetscapeHistoryVisit } from '~/types/history'
import BaseVisitsTable, { type VisitsTableHeader } from './BaseVisitsTable.vue'

defineProps<{
  items: NetscapeHistoryVisit[]
}>()

const emit = defineEmits<{
  'row-click': [visit: NetscapeHistoryVisit]
}>()

const { t } = useI18n()

// No "種別" column: history.dat records no per-visit transition type, only
// the two per-URL flags below.
const headers = computed<VisitsTableHeader[]>(() => [
  { title: t('components.visitsTable.headerTitle'), key: 'title', width: '28%' },
  { title: t('components.visitsTable.headerUrl'), key: 'url', width: '28%' },
  { title: t('components.visitsTable.headerDomain'), key: 'domain', width: 170 },
  { title: t('components.visitsTable.headerVisitTime'), key: 'visitTime', width: 190 },
  {
    title: t('components.visitsTable.headerVisitCount'),
    key: 'visitCount',
    width: 130,
    align: 'end'
  },
  { title: t('components.visitsTable.headerStatus'), key: 'flags', width: 170, sortable: false }
])
</script>

<template>
  <BaseVisitsTable
    :headers="headers"
    :items="items"
    item-value="rowId"
    show-actions
    @row-click="emit('row-click', $event)"
  >
    <template #item.flags="{ item }">
      <v-chip v-if="item.typed" size="x-small" color="success" variant="flat" class="mr-1">{{
        t('components.visitsTable.flagTyped')
      }}</v-chip>
      <v-chip v-if="item.hidden" size="x-small" color="secondary" variant="flat">{{
        t('components.visitsTable.flagHidden')
      }}</v-chip>
    </template>
  </BaseVisitsTable>
</template>
