import { computed } from 'vue'
import { useTheme } from 'vuetify'

const STORAGE_KEY = 'safari-history-theme'
const LIGHT_THEME = 'safariHistory'
const DARK_THEME = 'safariHistoryDark'

// localStorage can throw (Safari private mode, blocked storage, restrictive
// browser policies) — a thrown error here must not break theme switching,
// nor (via initTheme, called synchronously from app.vue's root setup) the
// whole app.
function readStoredTheme(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY)
  } catch {
    return null
  }
}

function writeStoredTheme(name: string) {
  try {
    localStorage.setItem(STORAGE_KEY, name)
  } catch {
    // Ignore: theme still applies for this session, just isn't persisted.
  }
}

export function useAppTheme() {
  const theme = useTheme()

  const isDark = computed(() => theme.global.name.value === DARK_THEME)

  function applyTheme(name: typeof LIGHT_THEME | typeof DARK_THEME) {
    void theme.change(name)
    if (typeof window !== 'undefined') {
      writeStoredTheme(name)
    }
  }

  function initTheme() {
    if (typeof window === 'undefined') return

    const stored = readStoredTheme()
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
