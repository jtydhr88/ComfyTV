import { mount } from '@vue/test-utils'
import { afterEach, describe, expect, it } from 'vitest'
import { nextTick } from 'vue'

import { makeI18n } from '@/__tests__/renderHelpers'

import GenOptionsV2 from './GenOptionsV2.vue'

const RATIOS = ['1:1', '9:16', '16:9', '3:4', '4:3']
const RES = ['1K', '2K', '4K']

async function openPopup(props: Record<string, unknown>) {
  const wrapper = mount(GenOptionsV2, {
    props,
    global: { plugins: [makeI18n()] },
    attachTo: document.body,
  })
  await wrapper.find('button.v2-genopt__chip').trigger('click')
  await nextTick()
  return wrapper
}

const pop = () => document.body.querySelector('.v2-genopt__pop')

describe('GenOptionsV2', () => {
  afterEach(() => { document.body.innerHTML = '' })

  it('chip summarises ratio, resolution and count', async () => {
    const wrapper = await openPopup({
      ratio: '16:9', ratioOptions: RATIOS,
      resolution: '2K', resolutionOptions: RES,
      batch: '4',
    })
    expect(wrapper.find('.v2-genopt__label').text()).toContain('16:9')
    expect(wrapper.find('.v2-genopt__label').text()).toContain('2K')
    expect(wrapper.find('.v2-genopt__chip .v2-genopt__icon > span').exists()).toBe(true)
  })

  it('renders sections only for present widgets', async () => {
    await openPopup({ ratio: '1:1', ratioOptions: RATIOS })
    expect(pop()!.querySelectorAll('.v2-genopt__cell').length).toBe(RATIOS.length)
    expect(pop()!.querySelectorAll('.v2-genopt__title').length).toBe(1)
  })

  it('ratio cells carry proportional icons (wide vs tall)', async () => {
    await openPopup({ ratio: '16:9', ratioOptions: ['16:9', '9:16'] })
    const boxes = [...pop()!.querySelectorAll('.v2-genopt__cell .v2-genopt__icon > span')]
    const dims = boxes.map(b => (b as HTMLElement).style)
    expect(parseInt(dims[0].width)).toBeGreaterThan(parseInt(dims[0].height))
    expect(parseInt(dims[1].height)).toBeGreaterThan(parseInt(dims[1].width))
  })

  it('clicking an option emits update with the widget name', async () => {
    const wrapper = await openPopup({
      ratio: '1:1', ratioOptions: RATIOS,
      resolution: '1K', resolutionOptions: RES,
      batch: '1',
    })
    const cells = [...pop()!.querySelectorAll('.v2-genopt__cell')]
    ;(cells[2] as HTMLElement).click()
    const rows = [...pop()!.querySelectorAll('.v2-genopt__row')]
    ;(rows[0].children[1] as HTMLElement).click()
    ;(rows[1].children[3] as HTMLElement).click()
    await nextTick()
    expect(wrapper.emitted('update')).toEqual([
      ['aspect_ratio', '16:9'],
      ['resolution', '2K'],
      ['batch_size', '4'],
    ])
  })
})
