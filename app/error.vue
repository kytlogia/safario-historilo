<script setup lang="ts">
import type { NuxtError } from '#app'

defineProps<{ error: NuxtError }>()

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
              <v-icon icon="mdi-alert-circle-outline" size="64" color="error" class="mb-4" />
              <h1 class="text-h5 mb-2">予期しないエラーが発生しました</h1>
              <p class="text-body-2 text-medium-emphasis mb-6">
                アプリの処理中に問題が発生しました。お手数ですが、再読み込みしてやり直してください。
              </p>
              <v-btn color="primary" block @click="handleReload">再読み込み</v-btn>
            </v-card>
          </v-col>
        </v-row>
      </v-container>
    </v-main>
  </v-app>
</template>
