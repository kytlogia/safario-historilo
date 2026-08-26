<script setup lang="ts">
import { ref } from 'vue'
import { useAppSnackbar } from '~/composables/useAppSnackbar'

useAppTheme().initTheme()

const { visible: snackbarVisible, message: snackbarMessage } = useAppSnackbar()

// Gates <NuxtPage> until the locale is actually settled: initLocale() is
// synchronous for the common case (no stored preference, or it already
// matches the default), but for a returning user who previously switched
// away from ja it awaits that locale's lazy-loaded message chunk — without
// this gate, the page would render once in ja, then flash to the stored
// locale a moment later once that chunk arrives.
const localeReady = ref(false)
void useAppLocale()
  .initLocale()
  .finally(() => {
    localeReady.value = true
  })
</script>

<template>
  <v-app>
    <NuxtRouteAnnouncer />
    <NuxtPage v-if="localeReady" />
    <v-snackbar
      v-model="snackbarVisible"
      data-testid="app-snackbar"
      color="error"
      location="bottom"
    >
      {{ snackbarMessage }}
    </v-snackbar>
  </v-app>
</template>

<style>
/*
 * v-dialog のスクロールロックは <html> を position: fixed にして背景スクロールを止める
 * (Vuetify の block scroll strategy、ロック中は <html> に v-overlay-scroll-blocked が付与
 * される)。iOS Safari 等ではラバーバンド/慣性スクロール時にスクロールチェイニングが発生し
 * 背景が動いて見えることがあるため、overscroll-behavior で明示的にチェイニングを遮断する
 * (#36)。常時ではなくオーバーレイ表示中に限定し、通常時の pull-to-refresh 等への影響を避ける。
 */
html.v-overlay-scroll-blocked,
html.v-overlay-scroll-blocked body {
  overscroll-behavior: contain;
}
</style>
