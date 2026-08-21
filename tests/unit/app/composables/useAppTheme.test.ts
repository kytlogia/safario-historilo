import { createApp } from 'vue'
import { createVuetify } from 'vuetify'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useAppTheme } from '~/composables/useAppTheme'

function withSetup<T>(setup: () => T) {
  let result!: T
  const app = createApp({
    setup() {
      result = setup()
      return () => null
    }
  })
  app.use(
    createVuetify({
      theme: {
        defaultTheme: 'safariHistory',
        themes: {
          safariHistory: { dark: false, colors: {} },
          safariHistoryDark: { dark: true, colors: {} }
        }
      }
    })
  )
  app.mount(document.createElement('div'))
  return { result, unmount: () => app.unmount() }
}

function mockMatchMedia(matches: boolean) {
  window.matchMedia = vi.fn().mockReturnValue({ matches }) as unknown as typeof window.matchMedia
}

describe('useAppTheme', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('initTheme falls back to light when no stored theme and system prefers light', () => {
    mockMatchMedia(false)
    const { result } = withSetup(() => useAppTheme())

    result.initTheme()

    expect(result.isDark.value).toBe(false)
  })

  it('initTheme falls back to dark when no stored theme and system prefers dark', () => {
    mockMatchMedia(true)
    const { result } = withSetup(() => useAppTheme())

    result.initTheme()

    expect(result.isDark.value).toBe(true)
  })

  it('initTheme uses the stored theme over the system preference', () => {
    localStorage.setItem('safari-history-theme', 'safariHistoryDark')
    mockMatchMedia(false)
    const { result } = withSetup(() => useAppTheme())

    result.initTheme()

    expect(result.isDark.value).toBe(true)
  })

  it('toggleTheme flips the theme and persists the choice', () => {
    mockMatchMedia(false)
    const { result } = withSetup(() => useAppTheme())
    result.initTheme()

    result.toggleTheme()
    expect(result.isDark.value).toBe(true)
    expect(localStorage.getItem('safari-history-theme')).toBe('safariHistoryDark')

    result.toggleTheme()
    expect(result.isDark.value).toBe(false)
    expect(localStorage.getItem('safari-history-theme')).toBe('safariHistory')
  })

  it('toggleTheme still switches the theme when localStorage.setItem throws', () => {
    mockMatchMedia(false)
    const { result } = withSetup(() => useAppTheme())
    result.initTheme()

    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('blocked')
    })

    expect(() => result.toggleTheme()).not.toThrow()
    expect(result.isDark.value).toBe(true)
  })

  it('initTheme falls back to the system preference when localStorage.getItem throws', () => {
    mockMatchMedia(true)
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new DOMException('blocked')
    })
    const { result } = withSetup(() => useAppTheme())

    expect(() => result.initTheme()).not.toThrow()
    expect(result.isDark.value).toBe(true)
  })
})
