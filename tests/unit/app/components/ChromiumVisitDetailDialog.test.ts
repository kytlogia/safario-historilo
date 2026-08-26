import { DOMWrapper } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import ChromiumVisitDetailDialog from '~/components/ChromiumVisitDetailDialog.vue'
import type { ChromiumHistoryVisit } from '~/types/history'
import { mountWithVuetify } from '../../support/mountWithVuetify'

// Only covers the copy-feedback behavior shared via useCopyFeedback (see
// useCopyFeedback.test.ts for the composable's own logic tests and
// VisitDetailDialog.test.ts for this dialog family's full rendering
// coverage) — this dialog previously had no dedicated test file at all.
function makeVisit(overrides: Partial<ChromiumHistoryVisit> = {}): ChromiumHistoryVisit {
  return {
    visitId: 1,
    urlId: 1,
    url: 'https://example.com/',
    domain: 'example.com',
    title: 'Example Domain',
    visitTime: new Date('2024-01-02T03:04:05.000Z'),
    visitTimeRaw: '123',
    visitCount: 7,
    typedCount: 0,
    transition: 0,
    fromVisit: null,
    visitDuration: 0,
    hidden: false,
    typed: false,
    ...overrides
  }
}

let mountedWrappers: Array<{ unmount: () => void }> = []

async function mountDialog(visit: ChromiumHistoryVisit | null, open = true) {
  const wrapper = mountWithVuetify(ChromiumVisitDetailDialog, {
    props: { visit, modelValue: open },
    attachTo: document.body
  })
  mountedWrappers.push(wrapper)
  await wrapper.vm.$nextTick()
  return { wrapper, body: new DOMWrapper(document.body) }
}

describe('ChromiumVisitDetailDialog', () => {
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
