import { describe, expect, it } from 'vitest'
import TruncatedCell from '~/components/TruncatedCell.vue'
import { mountWithVuetify } from '../../support/mountWithVuetify'

describe('TruncatedCell', () => {
  it('renders the text and exposes it via the title attribute for a native tooltip', () => {
    const wrapper = mountWithVuetify(TruncatedCell, {
      props: { text: 'https://example.com/very/long/path' }
    })

    expect(wrapper.text()).toBe('https://example.com/very/long/path')
    expect(wrapper.attributes('title')).toBe('https://example.com/very/long/path')
  })

  it('applies the truncation classes so overflow is clipped with an ellipsis', () => {
    const wrapper = mountWithVuetify(TruncatedCell, { props: { text: 'anything' } })

    expect(wrapper.classes()).toContain('text-truncate')
    expect(wrapper.classes()).toContain('truncated-cell')
  })
})
