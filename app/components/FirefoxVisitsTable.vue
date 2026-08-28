<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { formatFirefoxVisitType } from '~/utils/firefoxVisitType'
import type { FirefoxHistoryVisit } from '~/types/history'
import BaseVisitsTable, { type VisitsTableHeader } from './BaseVisitsTable.vue'

defineProps<{
  items: FirefoxHistoryVisit[]
}>()

const emit = defineEmits<{
  'row-click': [visit: FirefoxHistoryVisit]
}>()

const { t } = useI18n()

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
  { title: t('components.visitsTable.headerType'), key: 'flags', width: 170, sortable: false },
  {
    title: t('components.visitsTable.headerActions'),
    key: 'actions',
    width: 56,
    sortable: false,
    align: 'center'
  }
])
</script>

<template>
  <BaseVisitsTable
    :headers="headers"
    :items="items"
    item-value="visitId"
    @row-click="emit('row-click', $event)"
  >
    <template #item.flags="{ item }">
      <v-chip size="x-small" variant="flat" class="mr-1">{{
        formatFirefoxVisitType(item.visitType, t)
      }}</v-chip>
      <v-chip v-if="item.hidden" size="x-small" color="secondary" variant="flat">{{
        t('components.visitsTable.flagHidden')
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
  </BaseVisitsTable>
</template>
