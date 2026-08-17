<script setup lang="ts">
defineProps<{
  totalVisits: number
  uniqueUrlCount: number
  uniqueDomainCount: number
  dateRangeLabel: string
}>()
</script>

<template>
  <v-row>
    <v-col cols="6" sm="3">
      <v-card variant="tonal" color="primary">
        <v-card-text>
          <div class="text-caption">総訪問数</div>
          <div class="text-h5 font-weight-bold">{{ totalVisits.toLocaleString() }}</div>
        </v-card-text>
      </v-card>
    </v-col>
    <v-col cols="6" sm="3">
      <v-card variant="tonal">
        <v-card-text>
          <div class="text-caption">ユニークURL数</div>
          <div class="text-h5 font-weight-bold">{{ uniqueUrlCount.toLocaleString() }}</div>
        </v-card-text>
      </v-card>
    </v-col>
    <v-col cols="6" sm="3">
      <v-card variant="tonal">
        <v-card-text>
          <div class="text-caption">ドメイン数</div>
          <div class="text-h5 font-weight-bold">
            {{ uniqueDomainCount.toLocaleString() }}
          </div>
        </v-card-text>
      </v-card>
    </v-col>
    <v-col cols="6" sm="3">
      <v-card variant="tonal">
        <v-card-text>
          <div class="text-caption">期間</div>
          <div class="text-body-1 font-weight-medium">{{ dateRangeLabel }}</div>
        </v-card-text>
      </v-card>
    </v-col>
  </v-row>
</template>
