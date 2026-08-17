<script setup lang="ts">
import { exportVisitsAsCsv, exportVisitsAsJson } from '~/utils/export'
import { formatDateInputValue } from '~/utils/format'
import type { HistoryVisit } from '~/types/history'

defineProps<{
  domainOptions: { title: string; value: string }[]
  filteredVisits: HistoryVisit[]
  totalCount: number
}>()

const search = defineModel<string>('search', { required: true })
const domainFilter = defineModel<string | null>('domainFilter', { required: true })
const dateFrom = defineModel<Date | null>('dateFrom', { required: true })
const dateTo = defineModel<Date | null>('dateTo', { required: true })
const onlyFailed = defineModel<boolean>('onlyFailed', { required: true })
const onlyRedirects = defineModel<boolean>('onlyRedirects', { required: true })
const onlySynthesized = defineModel<boolean>('onlySynthesized', { required: true })

// v-autocomplete's default filter matches the displayed title, which includes
// the "(件数)" suffix — restrict matching to the domain itself so typing a
// number that happens to be another domain's visit count doesn't match it.
function filterDomainOption(_itemTitle: string, query: string, item?: { value: string }) {
  return (item?.value ?? '').toLowerCase().includes(query.toLowerCase())
}
</script>

<template>
  <v-card-text>
    <v-row>
      <v-col cols="12" sm="6" md="4">
        <v-text-field
          v-model="search"
          label="タイトル・URLで検索"
          prepend-inner-icon="mdi-magnify"
          variant="outlined"
          density="comfortable"
          clearable
          hide-details
        />
      </v-col>
      <v-col cols="12" sm="6" md="4">
        <v-autocomplete
          v-model="domainFilter"
          :items="domainOptions"
          :custom-filter="filterDomainOption"
          label="ドメインで絞り込み"
          variant="outlined"
          density="comfortable"
          clearable
          hide-details
        />
      </v-col>
      <v-col cols="6" md="2">
        <v-date-input
          v-model="dateFrom"
          label="開始日"
          variant="outlined"
          density="comfortable"
          :display-format="formatDateInputValue"
          hide-details
          clearable
        />
      </v-col>
      <v-col cols="6" md="2">
        <v-date-input
          v-model="dateTo"
          label="終了日"
          variant="outlined"
          density="comfortable"
          :display-format="formatDateInputValue"
          hide-details
          clearable
        />
      </v-col>
    </v-row>
    <v-row class="mt-1">
      <v-col cols="12" class="d-flex flex-wrap ga-2 align-center">
        <v-checkbox v-model="onlyFailed" label="読み込み失敗のみ" density="compact" hide-details />
        <v-checkbox
          v-model="onlyRedirects"
          label="リダイレクトのみ"
          density="compact"
          hide-details
        />
        <v-checkbox
          v-model="onlySynthesized"
          label="自動生成された履歴のみ"
          density="compact"
          hide-details
        />
        <v-spacer />
        <span class="text-body-2 text-medium-emphasis">
          {{ filteredVisits.length.toLocaleString() }} / {{ totalCount.toLocaleString() }} 件を表示
        </span>
        <v-btn
          variant="text"
          size="small"
          prepend-icon="mdi-code-json"
          @click="exportVisitsAsJson(filteredVisits)"
        >
          JSON出力
        </v-btn>
        <v-btn
          variant="text"
          size="small"
          prepend-icon="mdi-file-delimited-outline"
          @click="exportVisitsAsCsv(filteredVisits)"
        >
          CSV出力
        </v-btn>
      </v-col>
    </v-row>
  </v-card-text>
</template>
