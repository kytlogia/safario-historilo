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
  <v-btn
    v-for="link in links"
    :key="link.id"
    variant="text"
    :to="link.route"
    :prepend-icon="link.icon"
    class="mr-2"
    >{{ t(link.navLabelKey) }}</v-btn
  >
</template>
