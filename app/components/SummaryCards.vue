<script setup lang="ts">
import { useI18n } from 'vue-i18n'

defineProps<{
  totalVisits: number
  uniqueUrlCount: number
  uniqueDomainCount: number
  dateRangeLabel: string
}>()

const { t } = useI18n()
</script>

<template>
  <v-row>
    <v-col cols="6" sm="3">
      <v-card variant="tonal" color="primary">
        <v-card-text>
          <div class="text-caption">{{ t('components.summaryCards.totalVisits') }}</div>
          <div class="text-h5 font-weight-bold">{{ totalVisits.toLocaleString() }}</div>
        </v-card-text>
      </v-card>
    </v-col>
    <v-col cols="6" sm="3">
      <v-card variant="tonal">
        <v-card-text>
          <div class="text-caption">{{ t('components.summaryCards.uniqueUrlCount') }}</div>
          <div class="text-h5 font-weight-bold">{{ uniqueUrlCount.toLocaleString() }}</div>
        </v-card-text>
      </v-card>
    </v-col>
    <v-col cols="6" sm="3">
      <v-card variant="tonal">
        <v-card-text>
          <div class="text-caption">{{ t('components.summaryCards.uniqueDomainCount') }}</div>
          <div class="text-h5 font-weight-bold">
            {{ uniqueDomainCount.toLocaleString() }}
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
