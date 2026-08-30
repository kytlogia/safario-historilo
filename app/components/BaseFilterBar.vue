<script setup lang="ts">
import { useFilterBarFormat } from '~/composables/useFilterBarFormat'

const { t, dateInputFormat, visibleCount } = useFilterBarFormat()

const { testidPrefix = '' } = defineProps<{
  domainOptions: { title: string; value: string }[]
  filteredCount: number
  totalCount: number
  // FilterBar/ChromiumFilterBar/FirefoxFilterBar use unprefixed testids
  // ("search-input"); UnifiedFilterBar prefixes all of its own with
  // "unified-" (see app/pages/all.vue's e2e/component tests) — kept
  // configurable here instead of picking one and breaking the other.
  testidPrefix?: string
}>()

const emit = defineEmits<{
  exportJson: []
  exportCsv: []
}>()

const search = defineModel<string>('search', { required: true })
const domainFilter = defineModel<string[]>('domainFilter', { required: true })
const dateFrom = defineModel<Date | null>('dateFrom', { required: true })
const dateTo = defineModel<Date | null>('dateTo', { required: true })

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
          :data-testid="`${testidPrefix}search-input`"
          :label="t('components.filterBar.searchLabel')"
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
          :data-testid="`${testidPrefix}domain-filter`"
          :items="domainOptions"
          :custom-filter="filterDomainOption"
          :label="t('components.filterBar.domainLabel')"
          variant="outlined"
          density="comfortable"
          multiple
          chips
          closable-chips
          clearable
          hide-details
        >
          <template #clear="{ props: clearProps }">
            <v-icon
              icon="$clear"
              :data-testid="`${testidPrefix}domain-filter-clear`"
              v-bind="clearProps"
            />
          </template>
        </v-autocomplete>
      </v-col>
      <v-col cols="6" md="2">
        <v-date-input
          v-model="dateFrom"
          :data-testid="`${testidPrefix}date-from-input`"
          :label="t('components.filterBar.dateFromLabel')"
          variant="outlined"
          density="comfortable"
          :display-format="dateInputFormat"
          hide-details
          clearable
        />
      </v-col>
      <v-col cols="6" md="2">
        <v-date-input
          v-model="dateTo"
          :data-testid="`${testidPrefix}date-to-input`"
          :label="t('components.filterBar.dateToLabel')"
          variant="outlined"
          density="comfortable"
          :display-format="dateInputFormat"
          hide-details
          clearable
        />
      </v-col>
    </v-row>
    <v-row class="mt-1">
      <v-col cols="12" class="d-flex flex-wrap ga-2 align-center">
        <slot name="filters" />
        <v-spacer />
        <span
          class="text-body-2 text-medium-emphasis"
          :data-testid="`${testidPrefix}visible-count`"
        >
          {{ visibleCount(filteredCount, totalCount) }}
        </span>
        <v-btn
          :data-testid="`${testidPrefix}export-json-button`"
          variant="text"
          size="small"
          prepend-icon="mdi-code-json"
          @click="emit('exportJson')"
        >
          {{ t('components.filterBar.exportJson') }}
        </v-btn>
        <v-btn
          :data-testid="`${testidPrefix}export-csv-button`"
          variant="text"
          size="small"
          prepend-icon="mdi-file-delimited-outline"
          @click="emit('exportCsv')"
        >
          {{ t('components.filterBar.exportCsv') }}
        </v-btn>
      </v-col>
    </v-row>
  </v-card-text>
</template>
