import { DOMWrapper } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import VisitDetailDialog from '~/components/VisitDetailDialog.vue'
import type { HistoryVisit } from '~/types/history'
import { formatDateTime } from '~/utils/format'
import { mountWithVuetify } from '../../support/mountWithVuetify'

function makeVisit(overrides: Partial<HistoryVisit> = {}): HistoryVisit {
  return {
    visitId: 1,
    itemId: 1,
    url: 'https://example.com/',
    domain: 'example.com',
    title: 'Example Domain',
    visitTime: new Date('2024-01-02T03:04:05.000Z'),
    visitTimeRaw: 123,
    visitCount: 7,
    domainExpansion: null,
    statusCode: 200,
    loadSuccessful: true,
    httpNonGet: false,
    synthesized: false,
    redirectSource: null,
    redirectDestination: null,
    origin: 0,
    generation: 0,
    attributes: 0,
    score: 0,
    ...overrides
  }
}

let mountedWrappers: Array<{ unmount: () => void }> = []

async function mountDialog(visit: HistoryVisit | null, open = true) {
  // v-dialog teleports its content to document.body (outside the wrapper's
  // own root element) and mounts it asynchronously, so callers must query
  // through the returned body wrapper, after awaiting a tick. Since this
  // attaches to the real document.body, it's tracked for unmounting in
  // afterEach — otherwise a test mounting more than once (or a later test)
  // would find stale elements left behind by an earlier mount.
  const wrapper = mountWithVuetify(VisitDetailDialog, {
    props: { visit, modelValue: open },
    attachTo: document.body
  })
  mountedWrappers.push(wrapper)
  await wrapper.vm.$nextTick()
  return { wrapper, body: new DOMWrapper(document.body) }
}

describe('VisitDetailDialog', () => {
  afterEach(() => {
    for (const wrapper of mountedWrappers) wrapper.unmount()
    mountedWrappers = []
  })

  it('renders nothing when there is no visit selected', async () => {
    const { body } = await mountDialog(null)

    expect(body.find('.detail-dialog').exists()).toBe(false)
  })

  it('renders the visit title, URL, domain and formatted visit time', async () => {
    const visitTime = new Date('2024-01-02T03:04:05.000Z')
    const { body } = await mountDialog(makeVisit({ visitTime }))

    expect(body.text()).toContain('Example Domain')
    expect(body.text()).toContain('https://example.com/')
    expect(body.text()).toContain('example.com')
    expect(body.text()).toContain(formatDateTime(visitTime))
    expect(body.text()).toContain('7')
  })

  it('renders the URL as a clickable link only when it is http(s)', async () => {
    const { wrapper: httpWrapper, body: httpBody } = await mountDialog(
      makeVisit({ url: 'https://example.com/' })
    )
    const link = httpBody.find('[data-testid="detail-url-link"]')
    expect(link.exists()).toBe(true)
    expect(link.attributes('href')).toBe('https://example.com/')
    expect(link.attributes('target')).toBe('_blank')
    expect(link.attributes('rel')).toBe('noopener noreferrer')
    httpWrapper.unmount()

    const { body: jsBody } = await mountDialog(makeVisit({ url: 'javascript:alert(1)' }))
    expect(jsBody.find('[data-testid="detail-url-link"]').exists()).toBe(false)
    expect(jsBody.find('[data-testid="detail-url-text"]').text()).toBe('javascript:alert(1)')
  })

  it('emits update:modelValue(false) when the close button is clicked', async () => {
    const { wrapper, body } = await mountDialog(makeVisit())

    await body.find('[data-testid="detail-close-button"]').trigger('click')

    expect(wrapper.emitted('update:modelValue')).toEqual([[false]])
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

    it('copies the URL when its copy button is clicked', async () => {
      const { body } = await mountDialog(makeVisit({ url: 'https://example.com/path' }))

      await body.find('[data-testid="copy-url-button"]').trigger('click')
      await vi.waitFor(() =>
        expect(navigator.clipboard.writeText).toHaveBeenCalledWith('https://example.com/path')
      )
    })
  })
})
