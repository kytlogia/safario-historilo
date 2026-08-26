import { afterEach, describe, expect, it } from 'vitest'
import TopDomains from '~/components/TopDomains.vue'
import { i18n, mountWithVuetify } from '../../support/mountWithVuetify'

describe('TopDomains', () => {
  afterEach(() => {
    i18n.global.locale.value = 'ja'
  })

  it("formats the count with the current locale's thousands separator", () => {
    i18n.global.locale.value = 'en'
    const wrapper = mountWithVuetify(TopDomains, {
      props: { topDomains: [{ domain: 'example.com', count: 1234, ratio: 1 }] }
    })

    expect(wrapper.text()).toContain('1,234')
  })

  it('renders one row per domain with its visit count and progress ratio', () => {
    const wrapper = mountWithVuetify(TopDomains, {
      props: {
        topDomains: [
          { domain: 'example.com', count: 10, ratio: 1 },
          { domain: 'blog.example.com', count: 4, ratio: 0.4 }
        ]
      }
    })

    expect(wrapper.text()).toContain('example.com')
    expect(wrapper.text()).toContain('blog.example.com')

    const bars = wrapper.findAll('[role="progressbar"][aria-valuenow]')
    expect(bars).toHaveLength(2)
    expect(bars[0]!.attributes('aria-valuenow')).toBe('1')
    expect(bars[1]!.attributes('aria-valuenow')).toBe('0.4')
  })

  it('shows an empty state instead of any rows when there are no domains', () => {
    const wrapper = mountWithVuetify(TopDomains, { props: { topDomains: [] } })

    expect(wrapper.find('.domain-row').exists()).toBe(false)
    expect(wrapper.text()).toContain('該当するデータがありません')
  })
})
