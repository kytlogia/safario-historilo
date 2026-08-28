import { describe, expect, it } from 'vitest'
import { createMemoryHistory, createRouter } from 'vue-router'
import BrowserNavLinks from '~/components/BrowserNavLinks.vue'
import { BROWSER_CATALOG } from '~/utils/browserCatalog'
import { mountWithVuetify } from '../../support/mountWithVuetify'

// v-btn's `to` prop renders via vue-router's RouterLink, which throws
// without an installed router instance.
const router = createRouter({
  history: createMemoryHistory(),
  routes: BROWSER_CATALOG.map((entry) => ({
    path: entry.route,
    component: { template: '<div />' }
  }))
})

function mountLinks(props?: { current?: (typeof BROWSER_CATALOG)[number]['id'] }) {
  return mountWithVuetify(BrowserNavLinks, { props, global: { plugins: [router] } })
}

describe('BrowserNavLinks', () => {
  it('renders a link for every catalog entry when no current browser is given', () => {
    const wrapper = mountLinks()

    for (const entry of BROWSER_CATALOG) {
      const link = wrapper.find(`[data-testid="browser-nav-link-${entry.id}"]`)
      expect(link.exists()).toBe(true)
      expect(link.attributes('href')).toBe(entry.route)
    }
  })

  it('excludes the current browser from its own nav bar', () => {
    const wrapper = mountLinks({ current: 'chrome' })

    expect(wrapper.find('[data-testid="browser-nav-link-chrome"]').exists()).toBe(false)
    for (const entry of BROWSER_CATALOG.filter((b) => b.id !== 'chrome')) {
      expect(wrapper.find(`[data-testid="browser-nav-link-${entry.id}"]`).exists()).toBe(true)
    }
  })
})
