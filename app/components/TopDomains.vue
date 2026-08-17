<script setup lang="ts">
defineProps<{
  topDomains: { domain: string; count: number; ratio: number }[]
}>()
</script>

<template>
  <v-card class="h-100">
    <v-card-title class="text-subtitle-1">よく訪れたドメイン Top 10</v-card-title>
    <v-card-text>
      <div v-for="d in topDomains" :key="d.domain" class="mb-3">
        <div class="d-flex justify-space-between text-body-2 mb-1">
          <span class="text-truncate" style="max-width: 180px">{{ d.domain }}</span>
          <span class="text-medium-emphasis">{{ d.count }}</span>
        </div>
        <v-progress-linear :model-value="d.ratio" color="primary" height="6" rounded />
      </div>
      <v-empty-state
        v-if="topDomains.length === 0"
        icon="mdi-chart-bar"
        size="48"
        text="該当するデータがありません"
      />
    </v-card-text>
  </v-card>
</template>
