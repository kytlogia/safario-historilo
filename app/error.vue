<script setup lang="ts">
import type { NuxtError } from '#app'

const props = defineProps<{ error: NuxtError }>()

// error.vue replaces app.vue's whole render tree for this page load, so
// app.vue's own initTheme() call never runs here — without this, dark-mode
// users would always see the light defaultTheme flash on a fatal error.
useAppTheme().initTheme()

const isNotFound = computed(() => props.error.statusCode === 404)
const title = computed(() =>
  isNotFound.value ? 'ページが見つかりません' : '予期しないエラーが発生しました'
)
const message = computed(() =>
  isNotFound.value
    ? 'お探しのページは存在しないか、移動した可能性があります。'
    : 'アプリの処理中に問題が発生しました。お手数ですが、再読み込みしてやり直してください。'
)

function handleReload() {
  void clearError({ redirect: '/' })
}
</script>

<template>
  <v-app>
    <v-main>
      <v-container class="fill-height" fluid>
        <v-row align="center" justify="center">
          <v-col cols="12" sm="8" md="6" lg="4">
            <v-card class="pa-6 text-center">
              <v-icon
                :icon="isNotFound ? 'mdi-map-marker-question-outline' : 'mdi-alert-circle-outline'"
                size="64"
                :color="isNotFound ? 'primary' : 'error'"
                class="mb-4"
              />
              <h1 class="text-h5 mb-2">{{ title }}</h1>
              <p class="text-body-2 text-medium-emphasis mb-6">{{ message }}</p>
              <v-btn color="primary" block @click="handleReload">
                {{ isNotFound ? 'トップに戻る' : '再読み込み' }}
              </v-btn>
            </v-card>
          </v-col>
        </v-row>
      </v-container>
    </v-main>
  </v-app>
</template>
