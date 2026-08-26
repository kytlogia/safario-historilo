import { onUnmounted, ref, watch, type Ref } from 'vue'

// VisitDetailDialog / ChromiumVisitDetailDialog / FirefoxVisitDetailDialog /
// UnifiedVisitDetailDialog all show a brief "copied" checkmark after a copy
// button is clicked. Shared here so the close/reopen race fix (below) can't
// drift out of sync between the four copy-pasted implementations again
// (see issue #130 / PR #166 review).
//
// `isOpen` is the dialog's own v-model: navigator.clipboard.writeText() can
// still be in flight when the dialog closes, and the user can reopen it
// (same or a different visit) before that promise resolves. A generation
// counter increments every time the dialog closes, and copyToClipboard only
// applies its result if the counter hasn't moved since the call started —
// otherwise the icon would flip to "copied" for an open session that never
// copied anything.
export function useCopyFeedback(isOpen: Ref<boolean>) {
  const copiedField = ref<string | null>(null)
  let copiedTimer: ReturnType<typeof setTimeout> | undefined
  let session = 0

  function resetCopiedState() {
    clearTimeout(copiedTimer)
    copiedTimer = undefined
    copiedField.value = null
  }

  async function copyToClipboard(text: string, field: string) {
    const startedSession = session
    try {
      await navigator.clipboard.writeText(text)
      if (startedSession !== session) return
      copiedField.value = field
      clearTimeout(copiedTimer)
      copiedTimer = setTimeout(() => {
        copiedField.value = null
      }, 1500)
    } catch {
      // クリップボードAPIが使用不可（権限拒否など）の場合は何もしない
    }
  }

  watch(isOpen, (open) => {
    if (!open) {
      session++
      resetCopiedState()
    }
  })

  onUnmounted(() => {
    clearTimeout(copiedTimer)
  })

  return { copiedField, copyToClipboard }
}
