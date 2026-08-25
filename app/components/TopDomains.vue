<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import TruncatedCell from './TruncatedCell.vue'

defineProps<{
  topDomains: { domain: string; count: number; ratio: number }[]
}>()

const { t } = useI18n()
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
          <span class="text-medium-emphasis">{{ d.count }}</span>
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
