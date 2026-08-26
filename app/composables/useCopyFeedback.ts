import { onUnmounted, ref, watch, type Ref } from 'vue'

// VisitDetailDialog / ChromiumVisitDetailDialog / FirefoxVisitDetailDialog /
// UnifiedVisitDetailDialog all show a brief "copied"/"failed" icon after a
// copy button is clicked. Shared here so the close/reopen race fix and the
// failure-feedback fix can't drift out of sync between the four copy-pasted
// implementations again (see issue #130 / PR #166 and issue #115 / PR #167).
//
// `isOpen` is the dialog's own v-model: navigator.clipboard.writeText() can
// still be in flight when the dialog closes, and the user can reopen it
// (same or a different visit) before that promise resolves. A generation
// counter increments every time the dialog closes, and copyToClipboard only
// applies its result if the counter hasn't moved since the call started —
// otherwise the icon would flip to "copied"/"failed" for an open session
// that never copied anything.
export function useCopyFeedback(isOpen: Ref<boolean>) {
  const copiedField = ref<string | null>(null)
  const copyFailedField = ref<string | null>(null)
  let copiedTimer: ReturnType<typeof setTimeout> | undefined
  let session = 0

  function resetCopiedState() {
    clearTimeout(copiedTimer)
    copiedTimer = undefined
    copiedField.value = null
    copyFailedField.value = null
  }

  async function copyToClipboard(text: string, field: string) {
    const startedSession = session
    // Reset synchronously (not just cancel the timer) so a new attempt can
    // never leave a stale success/failure icon from the previous one
    // lingering until this attempt's result — or its own timer — arrives.
    clearTimeout(copiedTimer)
    copiedField.value = null
    copyFailedField.value = null
    try {
      await navigator.clipboard.writeText(text)
      if (startedSession !== session) return
      copiedField.value = field
      copiedTimer = setTimeout(() => {
        copiedField.value = null
      }, 1500)
    } catch {
      // クリップボードAPIが使用不可（権限拒否など）の場合はアイコンを一時的にエラー表示にしてユーザーに知らせる
      if (startedSession !== session) return
      copyFailedField.value = field
      copiedTimer = setTimeout(() => {
        copyFailedField.value = null
      }, 1500)
    }
  }

  function copyIcon(field: string) {
    if (copiedField.value === field) return 'mdi-check'
    if (copyFailedField.value === field) return 'mdi-alert'
    return 'mdi-content-copy'
  }

  function copyColor(field: string) {
    return copyFailedField.value === field ? 'error' : undefined
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

  return { copiedField, copyFailedField, copyToClipboard, copyIcon, copyColor }
}
