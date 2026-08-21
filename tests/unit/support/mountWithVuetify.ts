import { mount, type ComponentMountingOptions } from '@vue/test-utils'
import { createVuetify, type VuetifyOptions } from 'vuetify'
import { mergeDeep } from 'vuetify/lib/util/helpers.js'

// Mirrors Vuetify's own internal test helper
// (vuetify/packages/vuetify/test/index.ts) so components mount with the
// stubs/plugins Vuetify itself relies on when testing its components.
export function mountWithVuetify<T>(
  component: T,
  options?: ComponentMountingOptions<T>,
  vuetifyOptions?: VuetifyOptions
) {
  const vuetify = createVuetify(vuetifyOptions)

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
