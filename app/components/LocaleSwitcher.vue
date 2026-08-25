<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { useAppLocale } from '~/composables/useAppLocale'

const { t } = useI18n()
const { currentLocale, availableLocales, setLocale } = useAppLocale()
</script>

<template>
  <v-menu>
    <template #activator="{ props: menuProps }">
      <v-btn
        icon="mdi-translate"
        :aria-label="t('common.switchLanguage')"
        variant="text"
        data-testid="locale-switcher-button"
        v-bind="menuProps"
      />
    </template>
    <v-list density="compact" data-testid="locale-switcher-menu">
      <v-list-item
        v-for="option in availableLocales"
        :key="option.code"
        :active="option.code === currentLocale"
        :data-testid="`locale-option-${option.code}`"
        @click="setLocale(option.code)"
      >
        <v-list-item-title>{{ option.name }}</v-list-item-title>
      </v-list-item>
    </v-list>
  </v-menu>
</template>
