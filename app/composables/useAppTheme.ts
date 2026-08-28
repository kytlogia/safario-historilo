import { computed } from 'vue'
import { useTheme } from 'vuetify'
import { safeLocalStorage } from '~/utils/safeLocalStorage'

const STORAGE_KEY = 'safari-history-theme'
const LIGHT_THEME = 'safariHistory'
const DARK_THEME = 'safariHistoryDark'

export function useAppTheme() {
  const theme = useTheme()

  const isDark = computed(() => theme.global.name.value === DARK_THEME)

  function applyTheme(name: typeof LIGHT_THEME | typeof DARK_THEME) {
    void theme.change(name)
    if (typeof window !== 'undefined') {
      safeLocalStorage.set(STORAGE_KEY, name)
    }
  }

  function initTheme() {
    if (typeof window === 'undefined') return

    const stored = safeLocalStorage.get(STORAGE_KEY)
    if (stored === LIGHT_THEME || stored === DARK_THEME) {
      void theme.change(stored)
      return
    }

    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
    void theme.change(prefersDark ? DARK_THEME : LIGHT_THEME)
  }

  function toggleTheme() {
    applyTheme(isDark.value ? LIGHT_THEME : DARK_THEME)
  }

  return { isDark, toggleTheme, initTheme }
}
