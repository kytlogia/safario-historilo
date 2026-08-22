import { mount, type ComponentMountingOptions } from '@vue/test-utils'
import { createVuetify, type VuetifyOptions } from 'vuetify'
import * as components from 'vuetify/components'
import * as directives from 'vuetify/directives'
import { mergeDeep } from 'vuetify/lib/util/helpers.js'

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
          plugins: [vuetify]
        }
      },
      options,
      (a, b) => a.concat(b)
    )
  )
}
