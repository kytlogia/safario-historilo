import { describe, expect, it } from 'vitest'
import UnifiedSourceCard from '~/components/UnifiedSourceCard.vue'
import { mountWithVuetify } from '../../support/mountWithVuetify'

function mountCard(overrides: Partial<Record<string, unknown>> = {}) {
  return mountWithVuetify(UnifiedSourceCard, {
    props: {
      label: 'Safari',
      icon: 'mdi-compass-outline',
      color: 'primary',
      isLoading: false,
      loadError: '',
      hasData: false,
      visitCount: 0,
      fileName: '',
      serverAutoLoadAvailable: false,
      serverDbPath: '',
      serverPermissionHint: false,
      serverStatusWarning: '',
      ...overrides
    }
  })
}

describe('UnifiedSourceCard', () => {
  it('shows the load controls when no data is loaded yet', () => {
    const wrapper = mountCard()

    expect(wrapper.find('[data-testid="source-card-file-input"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="source-card-reset-button"]').exists()).toBe(false)
  })

  it('shows the loaded file name, visit count chip, and a reset button once data is loaded', () => {
    const wrapper = mountCard({ hasData: true, visitCount: 42, fileName: 'History.db' })

    expect(wrapper.text()).toContain('History.db')
    expect(wrapper.text()).toContain('42 件')
    expect(wrapper.find('[data-testid="source-card-reset-button"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="source-card-file-input"]').exists()).toBe(false)
  })

  it('emits reset when the reset button is clicked', async () => {
    const wrapper = mountCard({ hasData: true, visitCount: 1, fileName: 'History.db' })

    await wrapper.find('[data-testid="source-card-reset-button"]').trigger('click')

    expect(wrapper.emitted('reset')).toHaveLength(1)
  })

  it('emits close when the close button is clicked', async () => {
    const wrapper = mountCard()

    await wrapper.find('[data-testid="source-card-close-button"]').trigger('click')

    expect(wrapper.emitted('close')).toHaveLength(1)
  })

  it('emits file-selected with the chosen file from the file input', async () => {
    const wrapper = mountCard()
    const file = new File(['dummy'], 'History.db')

    await wrapper.findComponent({ name: 'VFileInput' }).vm.$emit('update:modelValue', file)

    expect(wrapper.emitted('file-selected')).toEqual([[file]])
  })

  it('shows the server auto-load button and db path when available, and emits load-from-server on click', async () => {
    const wrapper = mountCard({
      serverAutoLoadAvailable: true,
      serverDbPath: '/Users/example/Library/Application Support/Google/Chrome/Default/History'
    })

    const button = wrapper.find('[data-testid="source-card-server-load-button"]')
    expect(button.exists()).toBe(true)
    expect(wrapper.find('[data-testid="source-card-server-db-path"]').text()).toBe(
      '/Users/example/Library/Application Support/Google/Chrome/Default/History'
    )

    await button.trigger('click')
    expect(wrapper.emitted('load-from-server')).toHaveLength(1)
  })

  it('shows a permission-hint alert when the db was detected but is unreadable', () => {
    const wrapper = mountCard({ serverAutoLoadAvailable: false, serverPermissionHint: true })

    expect(wrapper.find('[data-testid="source-card-permission-hint"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="source-card-server-load-button"]').exists()).toBe(false)
  })

  it('shows the load error message when loadError is set', () => {
    const wrapper = mountCard({ loadError: '不明なエラーが発生しました。' })

    expect(wrapper.find('[data-testid="source-card-load-error"]').text()).toContain(
      '不明なエラーが発生しました。'
    )
  })

  it('hides the profile picker when only one profile exists, shows it when there are more', () => {
    const single = mountCard({ serverProfiles: [{ id: 'default', name: 'デフォルト' }] })
    expect(single.find('[data-testid="source-card-profile-select"]').exists()).toBe(false)

    const multiple = mountCard({
      serverProfiles: [
        { id: 'default', name: 'デフォルト' },
        { id: 'p1', name: 'プロファイルA' }
      ]
    })
    expect(multiple.find('[data-testid="source-card-profile-select"]').exists()).toBe(true)
  })

  it('emits update:selectedProfileId when a different profile is chosen', async () => {
    const wrapper = mountCard({
      serverProfiles: [
        { id: 'default', name: 'デフォルト' },
        { id: 'p1', name: 'プロファイルA' }
      ],
      selectedProfileId: 'default'
    })

    await wrapper.findComponent({ name: 'VSelect' }).vm.$emit('update:modelValue', 'p1')

    expect(wrapper.emitted('update:selectedProfileId')).toEqual([['p1']])
  })
})
