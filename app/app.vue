<template>
  <v-app>
    <NuxtRouteAnnouncer />
    <NuxtPage />
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
