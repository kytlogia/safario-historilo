<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import type { UnifiedHistorySource } from '~/types/history'
import { BROWSER_CATALOG } from '~/utils/browserCatalog'
import type { LocalHistoryStatusResponse } from '~/composables/useUnifiedHistorySource'

const props = defineProps<{
  /** Current page's browser, hidden from its own nav bar. Omit on non-browser pages (e.g. /all). */
  current?: UnifiedHistorySource
}>()

const { t } = useI18n()
const candidates = computed(() => BROWSER_CATALOG.filter((b) => b.id !== props.current))

// Browsers whose status endpoint explicitly reported no profile/history DB
// at the OS-default path (issue #158). Anything not in this set stays
// visible — while the check is still in flight, and if it errors (e.g.
// assertLocalRequest's 403 on a non-local request) — so a failed check
// never hides a link the user might actually need (fail-safe).
//
// ponytail: a browser installed at a non-default path is indistinguishable
// from "not installed" here, so it silently disappears from the menu; the
// per-page manual file upload (UploadPanel) still works if the user
// navigates there directly. Add a "パスを指定して追加" escape hatch if that
// turns out to bite real users.
const absent = ref(new Set<UnifiedHistorySource>())

onMounted(async () => {
  const next = new Set<UnifiedHistorySource>()
  await Promise.all(
    candidates.value.map(async (b) => {
      try {
        const status = await $fetch<LocalHistoryStatusResponse>(`${b.apiBase}/status`)
        if (!status.present) next.add(b.id)
      } catch {
        // fail-safe: a failed check (403 from assertLocalRequest on a
        // non-local request, a network error, ...) never hides a link.
      }
    })
  )
  absent.value = next
})

const links = computed(() => candidates.value.filter((b) => !absent.value.has(b.id)))
</script>

<template>
  <v-menu>
    <template #activator="{ props: menuProps }">
      <v-btn
        variant="text"
        append-icon="mdi-chevron-down"
        class="mr-2"
        data-testid="browser-nav-menu-button"
        v-bind="menuProps"
        >{{ t('nav.viewHistory') }}</v-btn
      >
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
