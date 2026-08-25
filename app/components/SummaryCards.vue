<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { formatNumber } from '~/utils/format'
import { useAppLocale } from '~/composables/useAppLocale'

defineProps<{
  totalVisits: number
  uniqueUrlCount: number
  uniqueDomainCount: number
  dateRangeLabel: string
}>()

const { t } = useI18n()
const { intlLocale } = useAppLocale()
</script>

<template>
  <v-row>
    <v-col cols="6" sm="3">
      <v-card variant="tonal" color="primary">
        <v-card-text>
          <div class="text-caption">{{ t('components.summaryCards.totalVisits') }}</div>
          <div class="text-h5 font-weight-bold">{{ formatNumber(totalVisits, intlLocale) }}</div>
        </v-card-text>
      </v-card>
    </v-col>
    <v-col cols="6" sm="3">
      <v-card variant="tonal">
        <v-card-text>
          <div class="text-caption">{{ t('components.summaryCards.uniqueUrlCount') }}</div>
          <div class="text-h5 font-weight-bold">{{ formatNumber(uniqueUrlCount, intlLocale) }}</div>
        </v-card-text>
      </v-card>
    </v-col>
    <v-col cols="6" sm="3">
      <v-card variant="tonal">
        <v-card-text>
          <div class="text-caption">{{ t('components.summaryCards.uniqueDomainCount') }}</div>
          <div class="text-h5 font-weight-bold">
            {{ formatNumber(uniqueDomainCount, intlLocale) }}
          </div>
        </v-card-text>
      </v-card>
    </v-col>
    <v-col cols="6" sm="3">
      <v-card variant="tonal">
        <v-card-text>
          <div class="text-caption">{{ t('components.summaryCards.dateRange') }}</div>
          <div class="text-body-1 font-weight-medium">{{ dateRangeLabel }}</div>
        </v-card-text>
      </v-card>
    </v-col>
  </v-row>
</template>
