import { nextTick, ref } from 'vue'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useCopyFeedback } from '~/composables/useCopyFeedback'

describe('useCopyFeedback', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    Object.assign(navigator, { clipboard: { writeText: vi.fn().mockResolvedValue(undefined) } })
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('sets copiedField after a successful write, then clears it after 1500ms', async () => {
    const isOpen = ref(true)
    const { copiedField, copyToClipboard } = useCopyFeedback(isOpen)

    await copyToClipboard('hello', 'title')

    expect(copiedField.value).toBe('title')

    vi.advanceTimersByTime(1500)
    expect(copiedField.value).toBeNull()
  })

  it('leaves copiedField untouched when the clipboard write is rejected', async () => {
    Object.assign(navigator, {
      clipboard: { writeText: vi.fn().mockRejectedValue(new Error('denied')) }
    })
    const isOpen = ref(true)
    const { copiedField, copyToClipboard } = useCopyFeedback(isOpen)

    await copyToClipboard('hello', 'title')

    expect(copiedField.value).toBeNull()
  })

  // Regression for issue #130: a writeText() call still in flight when the
  // dialog closes (and is reopened before it settles) must not flip
  // copiedField for the new open — see useCopyFeedback.ts's session counter.
  it('ignores a writeText resolution that arrives after close + reopen', async () => {
    let resolveWriteText: () => void = () => {}
    const writeText = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          resolveWriteText = resolve
        })
    )
    Object.assign(navigator, { clipboard: { writeText } })

    const isOpen = ref(true)
    const { copiedField, copyToClipboard } = useCopyFeedback(isOpen)

    const copyPromise = copyToClipboard('hello', 'title')

    isOpen.value = false // closes before writeText resolves
    await nextTick() // let the watch(isOpen) handler bump the session
    isOpen.value = true // reopened within the 1500ms window
    await nextTick()

    resolveWriteText()
    await copyPromise

    expect(copiedField.value).toBeNull()
  })
})
