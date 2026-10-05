import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import ComfyTVNumber from './ComfyTVNumber.vue'

async function commit(props: Record<string, unknown>, typed: string) {
  const wrapper = mount(ComfyTVNumber, { props: { modelValue: null, ...props } })
  const input = wrapper.find('input')
  await input.setValue(typed)
  await input.trigger('blur')
  return wrapper.emitted('update:modelValue')?.at(-1)?.[0]
}

describe('ComfyTVNumber step snapping', () => {
  it('snaps typed values to the step by default', async () => {
    expect(await commit({}, '1.5')).toBe(2)
  })

  it('keeps decimals when step snapping is off', async () => {
    expect(await commit({ stepSnapping: false }, '0.15')).toBe(0.15)
  })
})
