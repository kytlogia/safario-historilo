import { computed, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useLocale as useVuetifyLocale } from 'vuetify'
import type { VisitFilterEngineI18n } from '~/composables/useVisitFilterEngine'
import { safeLocalStorage } from '~/utils/safeLocalStorage'

export const APP_LOCALES = ['ja', 'en', 'zh'] as const
export type AppLocale = (typeof APP_LOCALES)[number]

const STORAGE_KEY = 'safari-history-locale'

function isAppLocale(value: unknown): value is AppLocale {
  return typeof value === 'string' && (APP_LOCALES as readonly string[]).includes(value)
}

function readStoredLocale(): AppLocale | null {
  const stored = safeLocalStorage.get(STORAGE_KEY)
  return isAppLocale(stored) ? stored : null
}

// Maps this app's own locale codes to the Intl/BCP-47 tags consumed by
// app/utils/format.ts's Intl.DateTimeFormat-based helpers.
const INTL_LOCALES: Record<AppLocale, string> = {
  ja: 'ja-JP',
  en: 'en-US',
  zh: 'zh-CN'
}

// Vuetify's own built-in locale pack for Simplified Chinese is registered
// under the key 'zh' (see nuxt.config.ts, which maps vuetify/locale's
// zhHans export to 'zh') so this app's locale codes line up 1:1 with
// Vuetify's without a translation table.
export function useAppLocale() {
  const i18n = useI18n()
  const { locale, t } = i18n
  const vuetifyLocale = useVuetifyLocale()

  const currentLocale = computed(() => locale.value as AppLocale)
  const intlLocale = computed(() => INTL_LOCALES[currentLocale.value])

  const availableLocales = computed(() =>
    APP_LOCALES.map((code) => ({ code, name: t(`common.locale.${code}`) }))
  )

  // @nuxtjs/i18n lazy-loads each locale's messages on demand — writing
  // `locale.value = code` directly changes vue-i18n's own state but skips
  // that load, so every t() call for a not-yet-loaded locale silently falls
  // back to the default (ja) with the UI looking unchanged. The module
  // patches its own async `setLocale()` onto the real app's composer
  // specifically to do both (see its plugins/i18n.js) — prefer it when
  // present. It's only that runtime patch, though, not part of vue-i18n
  // itself, so a plain composer (e.g. tests/unit/support/mountWithVuetify.ts,
  // which preloads every locale's messages upfront and has no lazy-loading
  // to trigger) falls back to a direct assignment instead.
  async function setLocale(code: AppLocale) {
    if (typeof i18n.setLocale === 'function') {
      await i18n.setLocale(code)
    } else {
      locale.value = code
    }
    if (typeof window !== 'undefined') {
      safeLocalStorage.set(STORAGE_KEY, code)
    }
  }

  // Keeps Vuetify's own internal component strings (data-table pagination,
  // date-picker, etc.) and the document's declared language in sync with
  // this app's own i18n locale, which is otherwise unrelated to either.
  function syncLocale(code: AppLocale) {
    vuetifyLocale.current.value = code
    if (typeof document !== 'undefined') {
      document.documentElement.lang = code
    }
  }

  // Returns a Promise so callers that render nothing (or a placeholder)
  // until it resolves — see app.vue/error.vue — never paint the default
  // 'ja' locale first for a returning user whose stored preference is
  // something else, only to flip languages a moment later once the
  // lazy-loaded message chunk for that locale arrives.
  async function initLocale(): Promise<void> {
    if (typeof window !== 'undefined') {
      const stored = readStoredLocale()
      if (stored && stored !== locale.value) {
        await setLocale(stored)
        return
      }
    }
    syncLocale(currentLocale.value)
  }

  // flush: 'sync' — Vuetify's own locale and <html lang> should flip in the
  // same tick as setLocale(), not on Vue's next microtask, so a caller that
  // reads either immediately after switching (as tests do) sees the update.
  watch(currentLocale, (code) => syncLocale(code), { flush: 'sync' })

  return { currentLocale, intlLocale, availableLocales, setLocale, initLocale }
}

// Builds the live i18n adapter useVisitFilterEngine.ts (and the
// useXHistoryFilters.ts wrappers around it) accept, so date-range labels and
// weekday-trend labels react to this app's locale instead of the engine's
// own ja-only default. Only meaningful when called with real component
// context (a page or page-level composable) — see useVisitFilterEngine.ts's
// own DEFAULT_I18N for the plain-unit-test fallback.
export function useVisitFilterI18n(): VisitFilterEngineI18n {
  const { t, tm } = useI18n()
  const { intlLocale } = useAppLocale()

  return {
    t: (key, params) => t(key, params ?? {}),
    // tm()'s raw array elements can be compiled message nodes rather than
    // plain strings (the bundler precompiles locale resources — see
    // nuxt.config.ts's i18n.compilation option), which blow up when later
    // interpolated as-is (e.g. VisitTrends.vue's weekdayBarLabel). Only use
    // tm() to learn the array's length, then resolve each element properly
    // through t(), which always returns a plain rendered string.
    tm: (key) => (tm(key) as unknown[]).map((_, i) => t(`${key}.${i}`)),
    intlLocale: () => intlLocale.value
  }
}
