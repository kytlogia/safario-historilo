import { nextTick } from 'vue'
import { afterEach, describe, expect, it } from 'vitest'
import { useAppSnackbar } from '~/composables/useAppSnackbar'

describe('useAppSnackbar', () => {
  afterEach(() => {
    // visible/messageKey are module-level singletons shared with the real
    // app.vue snackbar — reset both so tests don't leak into each other.
    const { visible, messageKey } = useAppSnackbar()
    visible.value = false
    messageKey.value = ''
  })

  it('showError sets the message key and makes the snackbar visible', async () => {
    const { visible, messageKey, showError } = useAppSnackbar()

    showError('error.exportFailed')
    await nextTick()

    expect(visible.value).toBe(true)
    expect(messageKey.value).toBe('error.exportFailed')
  })

  it('hide() hides the snackbar', async () => {
    const { visible, showError, hide } = useAppSnackbar()
    showError('error.exportFailed')
    await nextTick()

    hide()

    expect(visible.value).toBe(false)
  })

  // Vuetify's VSnackbar only restarts its auto-hide timeout on an observed
  // isActive (v-model) transition — a second showError() while the
  // snackbar is already open must still produce a real false -> true
  // transition, or the new message would be cut off by the first error's
  // timer instead of getting its own full display window.
  it('forces a fresh visible transition when a second error arrives while already showing', async () => {
    const { visible, showError } = useAppSnackbar()

    showError('error.exportFailed')
    await nextTick()
    expect(visible.value).toBe(true)

    showError('error.exportFailed')
    // Synchronously (before the second call's own nextTick flush), visible
    // must already be back to false — the actual "off" edge a watcher (or
    // Vuetify's VSnackbar) would observe.
    expect(visible.value).toBe(false)

    await nextTick()
    expect(visible.value).toBe(true)
  })
})
