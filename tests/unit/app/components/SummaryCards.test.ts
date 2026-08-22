import { describe, expect, it } from 'vitest'
import SummaryCards from '~/components/SummaryCards.vue'
import { mountWithVuetify } from '../../support/mountWithVuetify'

describe('SummaryCards', () => {
  it('renders each summary figure, formatted with thousands separators', () => {
    const wrapper = mountWithVuetify(SummaryCards, {
      props: {
        totalVisits: 12345,
        uniqueUrlCount: 6789,
        uniqueDomainCount: 42,
        dateRangeLabel: '2024/01/01 〜 2024/03/31'
      }
    })

    const text = wrapper.text()
    expect(text).toContain('12,345')
    expect(text).toContain('6,789')
    expect(text).toContain('42')
    expect(text).toContain('2024/01/01 〜 2024/03/31')
  })
})
