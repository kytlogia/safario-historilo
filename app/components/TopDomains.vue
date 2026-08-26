<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { formatNumber } from '~/utils/format'
import { useAppLocale } from '~/composables/useAppLocale'
import TruncatedCell from './TruncatedCell.vue'

defineProps<{
  topDomains: { domain: string; count: number; ratio: number }[]
}>()

const { t } = useI18n()
const { intlLocale } = useAppLocale()
</script>

<template>
  <v-card class="h-100">
    <v-card-title class="text-subtitle-1">{{ t('components.topDomains.title') }}</v-card-title>
    <v-card-text>
      <div v-for="d in topDomains" :key="d.domain" class="domain-row">
        <div class="d-flex justify-space-between text-body-2 domain-row__header">
          <div class="domain-row__name">
            <TruncatedCell :text="d.domain" />
          </div>
          <span class="text-medium-emphasis">{{ formatNumber(d.count, intlLocale) }}</span>
        </div>
        <v-progress-linear :model-value="d.ratio" color="primary" height="6" rounded />
      </div>
      <v-empty-state
        v-if="topDomains.length === 0"
        icon="mdi-chart-bar"
        size="48"
        :text="t('common.noData')"
      />
    </v-card-text>
  </v-card>
</template>

<style scoped lang="scss">
// index.vue で親のv-colがflex縦積みになった場合に、このカードを
// flex-grow-1で残り高さまで縮められるようにする。v-cardは
// overflow:hiddenなので中身は溢れず、他ページ(flexコンテナでない
// v-col)では単に無害(#126)。
.v-card-text {
  min-height: 0;
}

.domain-row {
  margin-bottom: 12px; // mb-3

  &__header {
    margin-bottom: 4px; // mb-1
  }

  &__name {
    max-width: 180px;
  }
}
</style>
