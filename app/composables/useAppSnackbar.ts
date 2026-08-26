import { nextTick, ref } from 'vue'

// Module-level (not per-call) state: app.vue renders a single <v-snackbar>
// bound to this, while callers with no component context of their own
// (e.g. app/utils/export.ts's downloadBlob, which can throw outside any
// component setup) just need to trigger it — a per-call composable would
// give each caller its own isolated ref that app.vue never sees.
//
// messageKey (not pre-translated text) so a caller without i18n context
// (downloadBlob, see above) can still report a locale-aware error — app.vue
// resolves the key to text at render time, where useI18n() is available.
const visible = ref(false)
const messageKey = ref('')

export function useAppSnackbar() {
  // Vue refs only notify watchers on an actual value change, so setting
  // visible.value = true while it's already true (a second export failing
  // while the first error is still showing) would leave Vuetify's VSnackbar
  // unaware anything happened — it only restarts its auto-hide timeout on an
  // observed isActive transition, so the new message would be cut off by the
  // original timer instead of getting its own full display window. Forcing
  // a real false -> (next tick) -> true transition guarantees that watcher
  // fires again, so each new error gets a fresh timeout.
  function showError(key: string) {
    visible.value = false
    void nextTick(() => {
      messageKey.value = key
      visible.value = true
    })
  }

  function hide() {
    visible.value = false
  }

  return { visible, messageKey, showError, hide }
}
