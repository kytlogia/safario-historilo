import { en, ja, zhHans } from 'vuetify/locale'
import type { AppLocale } from './app/composables/useAppLocale'

// vuetify-nuxt-module auto-detects @nuxtjs/i18n and wires Vuetify's own
// internal component strings (data-table pagination, file-input's "Clear",
// etc.) through this same vue-i18n instance under the `$vuetify` namespace,
// instead of Vuetify's own separate locale system — see
// vuetify-nuxt-module's runtime/plugins/i18n.js createAdapter(). Without
// these merged in here, every `$vuetify.*` lookup fails. Keyed by
// Record<AppLocale, ...> (not a plain object literal) so leaving out an
// entry for one of this app's locales is a compile error instead of a
// silent runtime "not found" fallback for every $vuetify.* string in it.
const vuetifyMessages: Record<AppLocale, { $vuetify: typeof ja }> = {
  ja: { $vuetify: ja },
  en: { $vuetify: en },
  zh: { $vuetify: zhHans }
}

export default defineI18nConfig(() => ({
  legacy: false,
  fallbackLocale: 'ja',
  messages: vuetifyMessages
}))
