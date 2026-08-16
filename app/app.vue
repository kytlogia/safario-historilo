<template>
  <v-app>
    <NuxtRouteAnnouncer />
    <NuxtPage />
  </v-app>
</template>

<style>
/*
 * v-dialog のスクロールロックは <html> を position: fixed にして背景スクロールを止める
 * (Vuetify の block scroll strategy)。iOS Safari 等ではラバーバンド/慣性スクロール時に
 * スクロールチェイニングが発生し背景が動いて見えることがあるため、overscroll-behavior で
 * 明示的にチェイニングを遮断する (#36)。
 */
html,
body {
  overscroll-behavior: contain;
}
</style>
