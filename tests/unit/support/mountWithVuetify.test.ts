import { describe, expect, it } from 'vitest'
import { defineComponent, h } from 'vue'
import { VBtn } from 'vuetify/components'
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
})
