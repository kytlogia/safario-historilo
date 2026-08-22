import { describe, expect, it } from 'vitest'
import TopDomains from '~/components/TopDomains.vue'
import { mountWithVuetify } from '../../support/mountWithVuetify'

describe('TopDomains', () => {
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
