import { describe, expect, it } from 'vitest'
import { defineComponent, h } from 'vue'
import { VBtn } from 'vuetify/components'
import { useTheme } from 'vuetify'
import { mountWithVuetify } from './mountWithVuetify'

const DummyComponent = defineComponent({
  props: { label: { type: String, required: true } },
  emits: ['click'],
  setup(props, { emit }) {
    return () => h(VBtn, { onClick: () => emit('click') }, () => props.label)
  }
})

describe('mountWithVuetify', () => {
  it('renders a Vuetify component and reacts to interaction', async () => {
    const wrapper = mountWithVuetify(DummyComponent, { props: { label: 'Click me' } })

    expect(wrapper.text()).toContain('Click me')

    await wrapper.find('button').trigger('click')

    expect(wrapper.emitted('click')).toHaveLength(1)
  })

  it('keeps the default vuetify plugin installed when a caller supplies its own global.plugins', () => {
    // A no-op plugin standing in for something a real test might add (e.g. a
    // router). Regression guard for mergeDeep() silently dropping the
    // default `plugins: [vuetify]` when a caller passes their own array.
    const extraPlugin = { install() {} }
    const ProbeComponent = defineComponent({
      setup() {
        // Throws "Could not find Vuetify theme injection" if the vuetify
        // plugin from mountWithVuetify() wasn't actually installed.
        useTheme()
        return () => h('div', 'ok')
      }
    })

    expect(() =>
      mountWithVuetify(ProbeComponent, { global: { plugins: [extraPlugin] } })
    ).not.toThrow()
  })
})
