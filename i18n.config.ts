import { en, ja, zhHans } from 'vuetify/locale'

// vuetify-nuxt-module auto-detects @nuxtjs/i18n and wires Vuetify's own
// internal component strings (data-table pagination, file-input's "Clear",
// etc.) through this same vue-i18n instance under the `$vuetify` namespace,
// instead of Vuetify's own separate locale system — see
// vuetify-nuxt-module's runtime/plugins/i18n.js createAdapter(). Without
// these merged in here, every `$vuetify.*` lookup fails.
export default defineI18nConfig(() => ({
  legacy: false,
  fallbackLocale: 'ja',
  messages: {
    ja: { $vuetify: ja },
    en: { $vuetify: en },
    zh: { $vuetify: zhHans }
  }
}))
