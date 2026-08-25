<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import type { TrendBucket } from '~/composables/useVisitFilterEngine'

const props = defineProps<{
  weekdayTrend: TrendBucket[]
  hourlyTrend: TrendBucket[]
}>()

const { t } = useI18n()

const hasData = computed(() => props.weekdayTrend.some((b) => b.count > 0))
</script>

<template>
  <v-card class="h-100">
    <v-card-title class="text-subtitle-1">{{ t('components.visitTrends.title') }}</v-card-title>
    <v-card-text>
      <template v-if="hasData">
        <div class="text-caption text-medium-emphasis mb-1">
          {{ t('components.visitTrends.byWeekday') }}
        </div>
        <div
          class="trend-chart"
          role="list"
          :aria-label="t('components.visitTrends.weekdayChartLabel')"
        >
          <div
            v-for="bucket in weekdayTrend"
            :key="bucket.label"
            class="trend-bar"
            role="listitem"
            :aria-label="
              t('components.visitTrends.weekdayBarLabel', {
                label: bucket.label,
                count: bucket.count
              })
            "
            :title="
              t('components.visitTrends.weekdayBarLabel', {
                label: bucket.label,
                count: bucket.count
              })
            "
          >
            <div class="trend-bar__fill" :style="{ height: `${bucket.ratio}%` }" />
            <div class="trend-bar__label text-caption">{{ bucket.label }}</div>
          </div>
        </div>

        <div class="text-caption text-medium-emphasis mb-1 mt-4">
          {{ t('components.visitTrends.byHour') }}
        </div>
        <div
          class="trend-chart trend-chart--hourly"
          role="list"
          :aria-label="t('components.visitTrends.hourChartLabel')"
        >
          <div
            v-for="bucket in hourlyTrend"
            :key="bucket.label"
            class="trend-bar trend-bar--narrow"
            role="listitem"
            :aria-label="
              t('components.visitTrends.hourBarLabel', { label: bucket.label, count: bucket.count })
            "
            :title="
              t('components.visitTrends.hourBarLabel', { label: bucket.label, count: bucket.count })
            "
          >
            <div class="trend-bar__fill" :style="{ height: `${bucket.ratio}%` }" />
            <div v-if="Number(bucket.label) % 4 === 0" class="trend-bar__label text-caption">
              {{ bucket.label }}
            </div>
          </div>
        </div>
      </template>
      <v-empty-state v-else icon="mdi-chart-bar" size="48" :text="t('common.noData')" />
    </v-card-text>
  </v-card>
</template>

<style scoped lang="scss">
.trend-chart {
  display: flex;
  align-items: flex-end;
  gap: 4px;
  height: 72px;

  &--hourly {
    gap: 1px;
  }
}

.trend-bar {
  flex: 1;
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: flex-end;
  min-width: 0;

  &__fill {
    width: 100%;
    min-height: 2px;
    background-color: rgb(var(--v-theme-primary));
    border-radius: 2px 2px 0 0;
  }

  &__label {
    margin-top: 4px;
    line-height: 1;
    white-space: nowrap;
  }

  &--narrow &__label {
    font-size: 9px;
  }
}
</style>
