<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import type { UnifiedHistorySource } from '~/types/history'
import { BROWSER_CATALOG } from '~/utils/browserCatalog'

const props = defineProps<{
  /** Current page's browser, hidden from its own nav bar. Omit on non-browser pages (e.g. /all). */
  current?: UnifiedHistorySource
}>()

const { t } = useI18n()
const links = computed(() => BROWSER_CATALOG.filter((b) => b.id !== props.current))
</script>

<template>
  <v-menu>
    <template #activator="{ props: menuProps }">
      <v-btn variant="text" append-icon="mdi-chevron-down" class="mr-2" v-bind="menuProps">{{
        t('nav.viewHistory')
      }}</v-btn>
    </template>
    <v-list density="compact">
      <v-list-item
        v-for="link in links"
        :key="link.id"
        :to="link.route"
        :prepend-icon="link.icon"
        :data-testid="`browser-nav-link-${link.id}`"
        :title="t(link.navLabelKey)"
      />
    </v-list>
  </v-menu>
</template>
