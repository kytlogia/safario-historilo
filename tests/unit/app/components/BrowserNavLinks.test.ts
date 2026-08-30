import { afterEach, describe, expect, it, vi } from 'vitest'
import { createMemoryHistory, createRouter } from 'vue-router'
import { flushPromises } from '@vue/test-utils'
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
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('hides a browser whose status endpoint reports it as not present', async () => {
    vi.stubGlobal(
      '$fetch',
      vi.fn(async (url: string) => ({ present: !url.includes('/chrome/') }))
    )
    const wrapper = mountLinks()
    try {
      await flushPromises()
      await wrapper.get('[data-testid="browser-nav-menu-button"]').trigger('click')

      expect(document.querySelector('[data-testid="browser-nav-link-chrome"]')).toBeNull()
      for (const entry of BROWSER_CATALOG.filter((b) => b.id !== 'chrome')) {
        expect(
          document.querySelector(`[data-testid="browser-nav-link-${entry.id}"]`)
        ).not.toBeNull()
      }
    } finally {
      wrapper.unmount()
    }
  })

  it('keeps showing a link when its status check fails (fail-safe)', async () => {
    vi.stubGlobal(
      '$fetch',
      vi.fn(async () => {
        throw new Error('403 Forbidden')
      })
    )
    const wrapper = mountLinks()
    try {
      await flushPromises()
      await wrapper.get('[data-testid="browser-nav-menu-button"]').trigger('click')

      for (const entry of BROWSER_CATALOG) {
        expect(
          document.querySelector(`[data-testid="browser-nav-link-${entry.id}"]`)
        ).not.toBeNull()
      }
    } finally {
      wrapper.unmount()
    }
  })

  it('never status-checks an upload-only browser, and always shows its link', async () => {
    // Netscape is discontinued, so it has no /status endpoint to ask and can
    // never be "installed" — its link must not depend on one (issue #160).
    const fetchMock = vi.fn(async () => ({ present: true }))
    vi.stubGlobal('$fetch', fetchMock)
    const wrapper = mountLinks()
    try {
      await flushPromises()
      await wrapper.get('[data-testid="browser-nav-menu-button"]').trigger('click')

      const uploadOnly = BROWSER_CATALOG.filter((b) => !b.apiBase)
      expect(uploadOnly.length).toBeGreaterThan(0)
      for (const entry of uploadOnly) {
        expect(
          document.querySelector(`[data-testid="browser-nav-link-${entry.id}"]`)
        ).not.toBeNull()
      }
      expect(fetchMock).toHaveBeenCalledTimes(BROWSER_CATALOG.length - uploadOnly.length)
    } finally {
      wrapper.unmount()
    }
  })

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
        expect(
          document.querySelector(`[data-testid="browser-nav-link-${entry.id}"]`)
        ).not.toBeNull()
      }
    } finally {
      wrapper.unmount()
    }
  })
})
