import { DOMWrapper } from '@vue/test-utils'
import { afterEach, describe, expect, it } from 'vitest'
import LocaleSwitcher from '~/components/LocaleSwitcher.vue'
import { i18n, mountWithVuetify } from '../../support/mountWithVuetify'

let mountedWrappers: Array<{ unmount: () => void }> = []

// v-menu teleports its content to document.body (outside the wrapper's own
// root element) and mounts it asynchronously, so callers must query through
// the returned body wrapper, after awaiting a tick and the click that opens
// it. Since this attaches to the real document.body, it's tracked for
// unmounting in afterEach — otherwise a later test would find stale
// elements left behind by an earlier mount.
async function openSwitcher() {
  const wrapper = mountWithVuetify(LocaleSwitcher, { attachTo: document.body })
  mountedWrappers.push(wrapper)
  await wrapper.find('[data-testid="locale-switcher-button"]').trigger('click')
  await wrapper.vm.$nextTick()
  return { wrapper, body: new DOMWrapper(document.body) }
}

describe('LocaleSwitcher', () => {
  afterEach(() => {
    for (const wrapper of mountedWrappers) wrapper.unmount()
    mountedWrappers = []
    i18n.global.locale.value = 'ja'
  })

  it('lists all three locales, highlighting the current one', async () => {
    const { body } = await openSwitcher()

    expect(body.find('[data-testid="locale-option-ja"]').text()).toBe('日本語')
    expect(body.find('[data-testid="locale-option-en"]').text()).toBe('English')
    expect(body.find('[data-testid="locale-option-zh"]').text()).toBe('中文')
    expect(body.find('[data-testid="locale-option-ja"]').classes()).toContain('v-list-item--active')
  })

  it('switching to English updates the app locale', async () => {
    const { body } = await openSwitcher()

    await body.find('[data-testid="locale-option-en"]').trigger('click')

    expect(i18n.global.locale.value).toBe('en')
  })
})
