import { ref } from 'vue'

// Module-level (not per-call) state: app.vue renders a single <v-snackbar>
// bound to this, while callers with no component context of their own
// (e.g. useFilterBarFormat.ts's exportSafely, invoked from a template
// @click) just need to trigger it — a per-call composable would give each
// caller its own isolated ref that app.vue never sees.
const visible = ref(false)
const message = ref('')

export function useAppSnackbar() {
  function showError(text: string) {
    message.value = text
    visible.value = true
  }

  return { visible, message, showError }
}
