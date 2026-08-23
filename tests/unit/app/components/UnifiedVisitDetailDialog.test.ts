import { DOMWrapper } from '@vue/test-utils'
import { afterEach, describe, expect, it } from 'vitest'
import UnifiedVisitDetailDialog from '~/components/UnifiedVisitDetailDialog.vue'
import type { UnifiedHistoryVisit } from '~/types/history'
import { formatDateTime } from '~/utils/format'
import { mountWithVuetify } from '../../support/mountWithVuetify'

function makeVisit(overrides: Partial<UnifiedHistoryVisit> = {}): UnifiedHistoryVisit {
  return {
    source: 'firefox',
    sourceLabel: 'Firefox',
    url: 'https://example.com/',
    domain: 'example.com',
    title: 'Example Domain',
    visitTime: new Date('2024-01-02T03:04:05.000Z'),
    visitCount: 7,
    ...overrides
  }
}

let mountedWrappers: Array<{ unmount: () => void }> = []

async function mountDialog(visit: UnifiedHistoryVisit | null, open = true) {
  // v-dialog teleports its content to document.body — see the equivalent
  // comment in VisitDetailDialog.test.ts for why this attaches there and
  // tracks the wrapper for cleanup.
  const wrapper = mountWithVuetify(UnifiedVisitDetailDialog, {
    props: { visit, modelValue: open },
    attachTo: document.body
  })
  mountedWrappers.push(wrapper)
  await wrapper.vm.$nextTick()
  return { wrapper, body: new DOMWrapper(document.body) }
}

describe('UnifiedVisitDetailDialog', () => {
  afterEach(() => {
    for (const wrapper of mountedWrappers) wrapper.unmount()
    mountedWrappers = []
  })

  it('renders nothing when there is no visit selected', async () => {
    const { body } = await mountDialog(null)

    expect(body.find('.detail-dialog').exists()).toBe(false)
  })

  it('renders the source label, title, URL, domain, visit time and visit count', async () => {
    const visitTime = new Date('2024-01-02T03:04:05.000Z')
    const { body } = await mountDialog(
      makeVisit({ sourceLabel: 'Firefox', visitTime, visitCount: 7 })
    )

    expect(body.text()).toContain('Firefox')
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
    const link = httpBody.find('[data-testid="unified-detail-url-link"]')
    expect(link.exists()).toBe(true)
    expect(link.attributes('href')).toBe('https://example.com/')
    httpWrapper.unmount()

    const { body: jsBody } = await mountDialog(makeVisit({ url: 'javascript:alert(1)' }))
    expect(jsBody.find('[data-testid="unified-detail-url-link"]').exists()).toBe(false)
    expect(jsBody.find('[data-testid="unified-detail-url-text"]').text()).toBe(
      'javascript:alert(1)'
    )
  })

  it('emits update:modelValue(false) when the close button is clicked', async () => {
    const { wrapper, body } = await mountDialog(makeVisit())

    await body.find('[data-testid="unified-detail-close-button"]').trigger('click')

    expect(wrapper.emitted('update:modelValue')).toEqual([[false]])
  })
})
