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

// v-menu's list is a v-overlay that teleports to document.body when open,
// so its content lives outside the mounted wrapper's own element tree —
// attach to the body and query it directly rather than via wrapper.find().
function mountLinks(props?: { current?: (typeof BROWSER_CATALOG)[number]['id'] }) {
  return mountWithVuetify(BrowserNavLinks, {
    props,
    attachTo: document.body,
    global: { plugins: [router] }
  })
}

describe('BrowserNavLinks', () => {
  it('renders a link for every catalog entry when no current browser is given', async () => {
    const wrapper = mountLinks()
    try {
      await wrapper.get('[data-testid="browser-nav-menu-button"]').trigger('click')

      for (const entry of BROWSER_CATALOG) {
        const link = document.querySelector(`[data-testid="browser-nav-link-${entry.id}"]`)
        expect(link).not.toBeNull()
        expect(link?.getAttribute('href')).toBe(entry.route)
      }
    } finally {
      wrapper.unmount()
    }
  })

  it('excludes the current browser from its own nav bar', async () => {
    const wrapper = mountLinks({ current: 'chrome' })
    try {
      await wrapper.get('[data-testid="browser-nav-menu-button"]').trigger('click')

      expect(document.querySelector('[data-testid="browser-nav-link-chrome"]')).toBeNull()
      for (const entry of BROWSER_CATALOG.filter((b) => b.id !== 'chrome')) {
        expect(document.querySelector(`[data-testid="browser-nav-link-${entry.id}"]`)).not.toBeNull()
      }
    } finally {
      wrapper.unmount()
    }
  })
})
