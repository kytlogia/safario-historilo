import { DOMWrapper } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import FirefoxVisitDetailDialog from '~/components/FirefoxVisitDetailDialog.vue'
import type { FirefoxHistoryVisit } from '~/types/history'
import { mountWithVuetify } from '../../support/mountWithVuetify'

// Only covers the copy-feedback behavior shared via useCopyFeedback (see
// useCopyFeedback.test.ts for the composable's own logic tests and
// VisitDetailDialog.test.ts for this dialog family's full rendering
// coverage) — this dialog previously had no dedicated test file at all.
function makeVisit(overrides: Partial<FirefoxHistoryVisit> = {}): FirefoxHistoryVisit {
  return {
    visitId: 1,
    placeId: 1,
    url: 'https://example.com/',
    domain: 'example.com',
    title: 'Example Domain',
    visitTime: new Date('2024-01-02T03:04:05.000Z'),
    visitTimeRaw: 123,
    visitCount: 7,
    visitType: 1,
    fromVisit: null,
    session: 0,
    hidden: false,
    typed: false,
    frecency: 0,
    guid: 'guid-1',
    ...overrides
  }
}

let mountedWrappers: Array<{ unmount: () => void }> = []

async function mountDialog(visit: FirefoxHistoryVisit | null, open = true) {
  const wrapper = mountWithVuetify(FirefoxVisitDetailDialog, {
    props: { visit, modelValue: open },
    attachTo: document.body
  })
  mountedWrappers.push(wrapper)
  await wrapper.vm.$nextTick()
  return { wrapper, body: new DOMWrapper(document.body) }
}

describe('FirefoxVisitDetailDialog', () => {
  afterEach(() => {
    for (const wrapper of mountedWrappers) wrapper.unmount()
    mountedWrappers = []
  })

  describe('copy to clipboard', () => {
    beforeEach(() => {
      vi.useFakeTimers()
      Object.assign(navigator, { clipboard: { writeText: vi.fn().mockResolvedValue(undefined) } })
    })

    afterEach(() => {
      vi.useRealTimers()
      vi.restoreAllMocks()
    })

    it('copies the title and briefly swaps the copy icon for a check icon', async () => {
      const { wrapper, body } = await mountDialog(makeVisit({ title: 'Example Domain' }))

      await body.find('[data-testid="copy-title-button"]').trigger('click')
      await vi.waitFor(() =>
        expect(navigator.clipboard.writeText).toHaveBeenCalledWith('Example Domain')
      )
      await wrapper.vm.$nextTick()

      expect(body.find('[data-testid="copy-title-button"] .mdi-check').exists()).toBe(true)

      vi.advanceTimersByTime(1500)
      await wrapper.vm.$nextTick()

      expect(body.find('[data-testid="copy-title-button"] .mdi-check').exists()).toBe(false)
    })

    it('briefly shows an error icon when the clipboard write fails', async () => {
      Object.assign(navigator, {
        clipboard: { writeText: vi.fn().mockRejectedValue(new Error('denied')) }
      })
      const { wrapper, body } = await mountDialog(makeVisit({ title: 'Example Domain' }))

      await body.find('[data-testid="copy-title-button"]').trigger('click')
      await vi.waitFor(() =>
        expect(navigator.clipboard.writeText).toHaveBeenCalledWith('Example Domain')
      )
      await wrapper.vm.$nextTick()

      const button = body.find('[data-testid="copy-title-button"]')
      expect(button.find('.mdi-alert').exists()).toBe(true)
      expect(button.find('.mdi-check').exists()).toBe(false)

      vi.advanceTimersByTime(1500)
      await wrapper.vm.$nextTick()

      expect(body.find('[data-testid="copy-title-button"] .mdi-alert').exists()).toBe(false)
    })

    it('clears a stale success icon as soon as a new copy attempt starts', async () => {
      const writeText = vi.fn().mockResolvedValueOnce(undefined)
      Object.assign(navigator, { clipboard: { writeText } })
      const { wrapper, body } = await mountDialog(makeVisit({ title: 'Example Domain' }))

      await body.find('[data-testid="copy-title-button"]').trigger('click')
      await vi.waitFor(() => expect(writeText).toHaveBeenCalledTimes(1))
      await wrapper.vm.$nextTick()
      expect(body.find('[data-testid="copy-title-button"] .mdi-check').exists()).toBe(true)

      // Start a second attempt well before the first one's 1.5s timer would
      // fire. Cancelling that timer must not leave the stale check icon
      // visible until a new result (or timer) arrives.
      let resolveSecond: () => void = () => {}
      writeText.mockImplementationOnce(
        () =>
          new Promise<void>((resolve) => {
            resolveSecond = resolve
          })
      )
      await body.find('[data-testid="copy-title-button"]').trigger('click')
      await wrapper.vm.$nextTick()

      expect(body.find('[data-testid="copy-title-button"] .mdi-check').exists()).toBe(false)
      expect(body.find('[data-testid="copy-title-button"] .mdi-content-copy').exists()).toBe(true)

      resolveSecond()
      await vi.waitFor(() => expect(writeText).toHaveBeenCalledTimes(2))
    })

    it('does not show the check icon after closing before writeText resolves and reopening', async () => {
      let resolveWriteText: () => void = () => {}
      const writeText = vi.fn(
        () =>
          new Promise<void>((resolve) => {
            resolveWriteText = resolve
          })
      )
      Object.assign(navigator, { clipboard: { writeText } })

      const { wrapper, body } = await mountDialog(makeVisit({ title: 'Example Domain' }))

      await body.find('[data-testid="copy-title-button"]').trigger('click')
      expect(writeText).toHaveBeenCalledWith('Example Domain')

      await wrapper.setProps({ modelValue: false })
      await wrapper.vm.$nextTick()

      await wrapper.setProps({ modelValue: true })
      await wrapper.vm.$nextTick()

      resolveWriteText()
      await vi.advanceTimersByTimeAsync(0)
      await wrapper.vm.$nextTick()

      expect(body.find('[data-testid="copy-title-button"] .mdi-check').exists()).toBe(false)
      expect(body.find('[data-testid="copy-title-button"] .mdi-content-copy').exists()).toBe(true)
    })
  })
})
