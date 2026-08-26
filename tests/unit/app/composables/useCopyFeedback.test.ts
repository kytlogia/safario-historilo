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

  it('sets copyFailedField (not copiedField) when the clipboard write is rejected, then clears it after 1500ms', async () => {
    Object.assign(navigator, {
      clipboard: { writeText: vi.fn().mockRejectedValue(new Error('denied')) }
    })
    const isOpen = ref(true)
    const { copiedField, copyFailedField, copyToClipboard } = useCopyFeedback(isOpen)

    await copyToClipboard('hello', 'title')

    expect(copiedField.value).toBeNull()
    expect(copyFailedField.value).toBe('title')

    vi.advanceTimersByTime(1500)
    expect(copyFailedField.value).toBeNull()
  })

  it('clears a stale success/failure state as soon as a new copy attempt starts', async () => {
    const writeText = vi.fn().mockResolvedValueOnce(undefined)
    Object.assign(navigator, { clipboard: { writeText } })
    const isOpen = ref(true)
    const { copiedField, copyToClipboard } = useCopyFeedback(isOpen)

    await copyToClipboard('hello', 'title')
    expect(copiedField.value).toBe('title')

    // Starting a new attempt must reset synchronously, before the new
    // result is known, so cancelling the previous timer can't leave the
    // old icon lingering.
    let resolveSecond: () => void = () => {}
    writeText.mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          resolveSecond = resolve
        })
    )
    const secondCopy = copyToClipboard('hello', 'title')
    expect(copiedField.value).toBeNull()

    resolveSecond()
    await secondCopy
  })

  it('provides copyIcon/copyColor helpers reflecting the current state', async () => {
    const isOpen = ref(true)
    const { copyToClipboard, copyIcon, copyColor } = useCopyFeedback(isOpen)

    expect(copyIcon('title')).toBe('mdi-content-copy')
    expect(copyColor('title')).toBeUndefined()

    await copyToClipboard('hello', 'title')
    expect(copyIcon('title')).toBe('mdi-check')
    expect(copyColor('title')).toBeUndefined()

    Object.assign(navigator, {
      clipboard: { writeText: vi.fn().mockRejectedValue(new Error('denied')) }
    })
    await copyToClipboard('hello', 'title')
    expect(copyIcon('title')).toBe('mdi-alert')
    expect(copyColor('title')).toBe('error')
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

  // Same race as above, but for a rejection arriving late: a denied
  // clipboard write must not flip copyFailedField for a session the user
  // has already closed and reopened.
  it('ignores a writeText rejection that arrives after close + reopen', async () => {
    let rejectWriteText: (error: unknown) => void = () => {}
    const writeText = vi.fn(
      () =>
        new Promise<void>((_resolve, reject) => {
          rejectWriteText = reject
        })
    )
    Object.assign(navigator, { clipboard: { writeText } })

    const isOpen = ref(true)
    const { copyFailedField, copyToClipboard } = useCopyFeedback(isOpen)

    const copyPromise = copyToClipboard('hello', 'title')

    isOpen.value = false
    await nextTick()
    isOpen.value = true
    await nextTick()

    rejectWriteText(new Error('denied'))
    await copyPromise

    expect(copyFailedField.value).toBeNull()
  })
})
