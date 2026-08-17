const STORAGE_KEY = 'safari-history-theme'
const LIGHT_THEME = 'safariHistory'
const DARK_THEME = 'safariHistoryDark'

export function useAppTheme() {
  const theme = useTheme()

  const isDark = computed(() => theme.global.name.value === DARK_THEME)

  function applyTheme(name: typeof LIGHT_THEME | typeof DARK_THEME) {
    theme.global.name.value = name
    if (import.meta.client) {
      localStorage.setItem(STORAGE_KEY, name)
    }
  }

  function toggleTheme() {
    applyTheme(isDark.value ? LIGHT_THEME : DARK_THEME)
  }

  function initTheme() {
    if (!import.meta.client) return

    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored === LIGHT_THEME || stored === DARK_THEME) {
      theme.global.name.value = stored
      return
    }

    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
    theme.global.name.value = prefersDark ? DARK_THEME : LIGHT_THEME
  }

  return { isDark, toggleTheme, initTheme }
}
