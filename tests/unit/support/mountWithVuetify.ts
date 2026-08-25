import { mount, type ComponentMountingOptions } from '@vue/test-utils'
import { createVuetify, type VuetifyOptions } from 'vuetify'
import * as components from 'vuetify/components'
import * as directives from 'vuetify/directives'
import { mergeDeep } from 'vuetify/lib/util/helpers.js'
import { createI18n } from 'vue-i18n'
import ja from '../../../i18n/locales/ja.json'
import en from '../../../i18n/locales/en.json'
import zh from '../../../i18n/locales/zh.json'

// Every app component that displays translated text calls useI18n() (from
// 'vue-i18n' directly, not Nuxt's auto-imported '#i18n' wrapper, so it also
// works outside the Nuxt runtime here) — without a real vue-i18n instance
// installed, mounting any of them throws. Defaults to 'ja' (matching the
// app's own default locale) so existing assertions against the untranslated
// Japanese UI text keep passing unchanged; en/zh are loaded too so tests
// that exercise locale switching (e.g. LocaleSwitcher.vue) don't need their
// own i18n setup. Exported so such tests can reset the shared locale back
// to 'ja' in an afterEach, since this instance is a module-level singleton
// reused by every mountWithVuetify() call within a test file.
export const i18n = createI18n({ legacy: false, locale: 'ja', messages: { ja, en, zh } })

// Mirrors Vuetify's own internal test helper
// (vuetify/packages/vuetify/test/index.ts) so components mount with the
// stubs/plugins Vuetify itself relies on when testing its components.
// `components`/`directives` are registered globally by default (unlike
// createVuetify() itself, which registers none unless told to) so that app
// components using <v-text-field> etc. as plain template tags resolve to
// real Vuetify components instead of Vue rendering them as unknown elements.
export function mountWithVuetify<T>(
  component: T,
  options?: ComponentMountingOptions<T>,
  vuetifyOptions?: VuetifyOptions
) {
  const vuetify = createVuetify({ components, directives, ...vuetifyOptions })

  return mount(
    component,
    mergeDeep(
      {
        global: {
          stubs: { transition: false, 'transition-group': false },
          plugins: [vuetify, i18n]
        }
      },
      options,
      (a, b) => a.concat(b)
    )
  )
}
