import { describe, expect, it } from 'vitest'
import UploadPanel from '~/components/UploadPanel.vue'
import { mountWithVuetify } from '../../support/mountWithVuetify'

function mountPanel(overrides: Partial<Record<string, unknown>> = {}) {
  return mountWithVuetify(UploadPanel, {
    props: {
      isLoading: false,
      loadError: '',
      serverAutoLoadAvailable: false,
      serverDbPath: '',
      serverPermissionHint: false,
      serverStatusWarning: '',
      ...overrides
    }
  })
}

describe('UploadPanel', () => {
  it('shows the server auto-load button with its db path when available, and hides the permission/status alerts', () => {
    const wrapper = mountPanel({
      serverAutoLoadAvailable: true,
      serverDbPath: '/Users/example/Library/Safari/History.db'
    })

    expect(wrapper.find('[data-testid="load-from-server-button"]').exists()).toBe(true)
    expect(wrapper.text()).toContain('/Users/example/Library/Safari/History.db')
    expect(wrapper.find('[data-testid="permission-hint-alert"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="status-warning-alert"]').exists()).toBe(false)
  })

  it('emits load-from-server when the auto-load button is clicked', async () => {
    const wrapper = mountPanel({ serverAutoLoadAvailable: true, serverDbPath: '/x' })

    await wrapper.find('[data-testid="load-from-server-button"]').trigger('click')

    expect(wrapper.emitted('load-from-server')).toHaveLength(1)
  })

  it('shows a permission-hint alert when the db was detected but is unreadable', () => {
    const wrapper = mountPanel({ serverAutoLoadAvailable: false, serverPermissionHint: true })

    expect(wrapper.find('[data-testid="permission-hint-alert"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="load-from-server-button"]').exists()).toBe(false)
  })

  it('shows a status-warning alert with its message when the server check itself failed', () => {
    const wrapper = mountPanel({
      serverAutoLoadAvailable: false,
      serverPermissionHint: false,
      serverStatusWarning: 'サーバー側の制限により自動読み込みが利用できません。'
    })

    expect(wrapper.find('[data-testid="status-warning-alert"]').text()).toContain(
      'サーバー側の制限により自動読み込みが利用できません。'
    )
  })

  it('shows the load error message when loadError is set', () => {
    const wrapper = mountPanel({ loadError: '不明なエラーが発生しました。' })

    expect(wrapper.find('[data-testid="load-error-alert"]').text()).toContain(
      '不明なエラーが発生しました。'
    )
  })

  it('disables the auto-load button and file input while loading', () => {
    const wrapper = mountPanel({
      isLoading: true,
      serverAutoLoadAvailable: true,
      serverDbPath: '/x'
    })

    expect(
      wrapper.find('[data-testid="load-from-server-button"]').attributes('disabled')
    ).toBeDefined()
    expect(
      wrapper.find('[data-testid="history-file-input"] input').attributes('disabled')
    ).toBeDefined()
  })

  // jsdom's File/DragEvent implementations are incomplete, so per the project's
  // test policy these only verify that the component's own handlers run and
  // emit file-selected — actual file-content reading stays covered by
  // tests/e2e/upload.spec.ts.
  it('emits file-selected with the chosen file from the file input', async () => {
    const wrapper = mountPanel()
    const file = new File(['dummy'], 'History.db')

    await wrapper.findComponent({ name: 'VFileInput' }).vm.$emit('update:modelValue', file)

    expect(wrapper.emitted('file-selected')).toEqual([[file]])
  })

  it('emits file-selected with the dropped file, and toggles the active class on dragover/dragleave', async () => {
    const wrapper = mountPanel()
    const dropZone = wrapper.find('[data-testid="drop-zone"]')
    const file = new File(['dummy'], 'History.db')

    await dropZone.trigger('dragover')
    expect(dropZone.classes()).toContain('drop-zone--active')

    await dropZone.trigger('dragleave')
    expect(dropZone.classes()).not.toContain('drop-zone--active')

    await dropZone.trigger('drop', { dataTransfer: { files: [file] } })

    expect(wrapper.emitted('file-selected')).toEqual([[file]])
    expect(dropZone.classes()).not.toContain('drop-zone--active')
  })

  describe('profile picker', () => {
    const profiles = [
      { id: 'default', name: 'デフォルト', dbPath: '/x/History.db' },
      {
        id: '11111111-1111-1111-1111-111111111111',
        name: 'プロファイルA',
        dbPath: '/x/profile-a/History.db'
      }
    ]

    it('hides the profile picker when only the default profile exists', () => {
      const wrapper = mountPanel({ serverAutoLoadAvailable: true, serverDbPath: '/x' })

      expect(wrapper.find('[data-testid="profile-select"]').exists()).toBe(false)
    })

    it('shows the profile picker when more than one profile is available', () => {
      const wrapper = mountPanel({
        serverAutoLoadAvailable: true,
        serverDbPath: '/x',
        serverProfiles: profiles
      })

      expect(wrapper.find('[data-testid="profile-select"]').exists()).toBe(true)
    })

    it('emits update:selectedProfileId when a different profile is chosen', async () => {
      const wrapper = mountPanel({
        serverAutoLoadAvailable: true,
        serverDbPath: '/x',
        serverProfiles: profiles,
        selectedProfileId: 'default'
      })

      await wrapper
        .findComponent({ name: 'VSelect' })
        .vm.$emit('update:modelValue', '11111111-1111-1111-1111-111111111111')

      expect(wrapper.emitted('update:selectedProfileId')).toEqual([
        ['11111111-1111-1111-1111-111111111111']
      ])
    })
  })

  // The 'safari' branch (this component's default brand) is covered above;
  // these guard the other three BRAND_META branches — the {app}/{path}
  // interpolation shared by chrome/edge, and Safari's one structural
  // difference from firefox/chrome/edge (no "open profile folder" step).
  describe('brand variants', () => {
    it('uses Safari-specific copy and skips the profile-folder step by default', () => {
      const wrapper = mountPanel()

      expect(wrapper.text()).toContain('Safariの History.db をドラッグ&ドロップ')
      expect(wrapper.text()).not.toContain('プロファイルのフォルダ')
    })

    it('uses Firefox-specific copy and includes the profile-folder step', () => {
      const wrapper = mountPanel({ brand: 'firefox' })

      expect(wrapper.text()).toContain('Firefoxの places.sqlite をドラッグ&ドロップ')
      expect(wrapper.text()).toContain('使用しているプロファイルのフォルダを開く')
    })

    it('interpolates the Chrome app name/path and includes the profile-folder step', () => {
      const wrapper = mountPanel({ brand: 'chrome' })

      expect(wrapper.text()).toContain('Google Chrome の History をドラッグ&ドロップ')
      expect(wrapper.text()).toContain('Google Chrome を終了する')
      expect(wrapper.text()).toContain('~/Library/Application Support/Google/Chrome/')
      expect(wrapper.text()).toContain('プロファイルのフォルダ')
    })

    it('interpolates the Edge app name/path and includes the profile-folder step', () => {
      const wrapper = mountPanel({ brand: 'edge' })

      expect(wrapper.text()).toContain('Microsoft Edge の History をドラッグ&ドロップ')
      expect(wrapper.text()).toContain('Microsoft Edge を終了する')
      expect(wrapper.text()).toContain('~/Library/Application Support/Microsoft Edge/')
      expect(wrapper.text()).toContain('プロファイルのフォルダ')
    })

    it.each([
      ['opera', 'Opera', '~/Library/Application Support/com.operasoftware.Opera/'],
      ['arc', 'Arc', '~/Library/Application Support/Arc/User Data/'],
      ['brave', 'Brave', '~/Library/Application Support/BraveSoftware/Brave-Browser/'],
      ['vivaldi', 'Vivaldi', '~/Library/Application Support/Vivaldi/']
    ] as const)(
      'interpolates the %s app name/path and includes the profile-folder step',
      (brand, appName, path) => {
        const wrapper = mountPanel({ brand })

        expect(wrapper.text()).toContain(`${appName} の History をドラッグ&ドロップ`)
        expect(wrapper.text()).toContain(`${appName} を終了する`)
        expect(wrapper.text()).toContain(path)
        expect(wrapper.text()).toContain('プロファイルのフォルダ')
      }
    )
  })
})
