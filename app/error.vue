<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import type { NuxtError } from '#app'

const props = defineProps<{ error: NuxtError }>()

// error.vue replaces app.vue's whole render tree for this page load, so
// app.vue's own initTheme()/initLocale() calls never run here — without
// this, dark-mode/non-Japanese users would always see the light
// defaultTheme and the wrong <html lang> flash on a fatal error.
useAppTheme().initTheme()
useAppLocale().initLocale()

const { t } = useI18n()

const isNotFound = computed(() => props.error.statusCode === 404)
const title = computed(() =>
  isNotFound.value ? t('error.notFoundTitle') : t('error.unexpectedTitle')
)
const message = computed(() =>
  isNotFound.value ? t('error.notFoundMessage') : t('error.unexpectedMessage')
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
                {{ isNotFound ? t('error.backToTop') : t('error.reload') }}
              </v-btn>
            </v-card>
          </v-col>
        </v-row>
      </v-container>
    </v-main>
  </v-app>
</template>
