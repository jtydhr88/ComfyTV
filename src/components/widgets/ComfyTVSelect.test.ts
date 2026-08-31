import { mount } from '@vue/test-utils'
import { afterEach, describe, expect, it } from 'vitest'
import { nextTick } from 'vue'

import ComfyTVSelect from './ComfyTVSelect.vue'

const MANY = Array.from({ length: 24 }, (_, i) => `model-${i}.safetensors`)
const FEW = ['a', 'b', 'c']

async function open(props: Record<string, unknown>) {
  const wrapper = mount(ComfyTVSelect, {
    props: { modelValue: null, options: FEW, ...props },
    attachTo: document.body,
  })
  await wrapper.find('button').trigger('click')
  await nextTick()
  return wrapper
}

const filterInput = () =>
  document.body.querySelector('input[placeholder="Filter…"]')

describe('ComfyTVSelect auto filter', () => {
  afterEach(() => { document.body.innerHTML = '' })

  it('shows the filter input for 10+ options without an explicit prop', async () => {
    await open({ options: MANY })
    expect(filterInput()).toBeTruthy()
  })

  it('hides the filter input for short lists', async () => {
    await open({ options: FEW })
    expect(filterInput()).toBeNull()
  })

  it('respects an explicit filterable=false on long lists', async () => {
    await open({ options: MANY, filterable: false })
    expect(filterInput()).toBeNull()
  })

  it('filters the option list by query', async () => {
    await open({ options: MANY })
    const input = filterInput() as HTMLInputElement
    input.value = 'model-13'
    input.dispatchEvent(new Event('input', { bubbles: true }))
    await nextTick()
    const items = [...document.body.querySelectorAll('[role=option]')]
    expect(items.map(i => i.textContent?.trim())).toEqual(['model-13.safetensors'])
  })
})
