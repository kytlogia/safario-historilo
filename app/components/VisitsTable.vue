<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useDisplay } from 'vuetify'
import type { HistoryVisit } from '~/types/history'
import BaseVisitsTable, { type VisitsTableHeader } from './BaseVisitsTable.vue'

defineProps<{
  items: HistoryVisit[]
}>()

const emit = defineEmits<{
  'row-click': [visit: HistoryVisit]
}>()

const { t } = useI18n()

// md未満はカラムが縦積みになりv-rowの高さストレッチが効かない(親要素が
// 実際の高さを持たない)ため、100%指定では高さが確定できない。その幅では
// 従来通り固定pxに戻す(#126)。
const { mdAndUp } = useDisplay()
const tableHeight = computed(() => (mdAndUp.value ? '100%' : 600))

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
  { title: t('components.visitsTable.headerStatus'), key: 'flags', width: 150, sortable: false },
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
    :height="tableHeight"
    class="flex-grow-1"
    @row-click="emit('row-click', $event)"
  >
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
  </BaseVisitsTable>
</template>
