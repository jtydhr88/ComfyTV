import { mount } from '@vue/test-utils'
import { afterEach, describe, expect, it } from 'vitest'
import { nextTick } from 'vue'

import ComfyTVPopover from './ComfyTVPopover.vue'

const Host = {
  components: { ComfyTVPopover },
  template: `
    <div class="card">
      <ComfyTVPopover width="200px">
        <template #trigger><button class="t">open</button></template>
        <div class="panel">body</div>
      </ComfyTVPopover>
    </div>`,
}

const AnchorHost = {
  components: { ComfyTVPopover },
  data: () => ({ shown: false }),
  template: `
    <ComfyTVPopover v-model:open="shown">
      <template #anchor><div class="a">anchored</div></template>
      <div class="panel">body</div>
    </ComfyTVPopover>`,
}

const flush = async () => { for (let i = 0; i < 3; i++) { await nextTick(); await new Promise(r => setTimeout(r, 5)) } }

const mounted: Array<{ unmount: () => void }> = []
const track = <T extends { unmount: () => void }>(w: T): T => { mounted.push(w); return w }

async function open() {
  const wrapper = track(mount(Host, { attachTo: document.body }))
  document.querySelector('button.t')!.dispatchEvent(new MouseEvent('click', { bubbles: true }))
  await flush()
  return wrapper
}

describe('ComfyTVPopover', () => {
  afterEach(() => {
    while (mounted.length) mounted.pop()!.unmount()
    document.body.innerHTML = ''
  })

  it('keeps the panel out of the card, so it cannot resize the node', async () => {
    const wrapper = await open()
    expect(document.body.querySelector('.v2-pop .panel')).toBeTruthy()
    expect(wrapper.find('.card').element.querySelector('.panel')).toBeNull()
  })

  it('closes on escape and on a pointer down outside', async () => {
    await open()
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    await flush()
    expect(document.body.querySelector('.panel')).toBeNull()

    await open()
    document.body.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }))
    await flush()
    expect(document.body.querySelector('.panel')).toBeNull()
  })

  it('closes when the pressed element stops propagation, like the canvas does', async () => {
    await open()
    const canvas = document.body.appendChild(document.createElement('canvas'))
    canvas.addEventListener('pointerdown', e => e.stopPropagation())
    canvas.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }))
    await flush()
    expect(document.body.querySelector('.panel')).toBeNull()
  })

  it('pressing the trigger leaves closing to the trigger click', async () => {
    await open()
    document.querySelector('button.t')!.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }))
    await flush()
    expect(document.body.querySelector('.panel')).toBeTruthy()
    document.querySelector('button.t')!.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    await flush()
    expect(document.body.querySelector('.panel')).toBeNull()
  })

  it('stays open when the anchor is pressed', async () => {
    const wrapper = track(mount(AnchorHost, { attachTo: document.body }))
    ;(wrapper.vm as any).shown = true
    await flush()
    const anchor = document.querySelector('.a')!
    anchor.addEventListener('pointerdown', e => e.stopPropagation())
    anchor.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }))
    await flush()
    expect(document.body.querySelector('.panel')).toBeTruthy()
  })

  it('stays open when a nested portaled layer is pressed', async () => {
    await open()
    const layer = document.body.appendChild(document.createElement('div'))
    layer.setAttribute('data-reka-popper-content-wrapper', '')
    layer.addEventListener('pointerdown', e => e.stopPropagation())
    layer.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }))
    await flush()
    expect(document.body.querySelector('.panel')).toBeTruthy()
  })

  it('still dismisses outside after the panel itself was clicked', async () => {
    await open()
    document.body.querySelector('.v2-pop')!
      .dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }))
    await flush()
    expect(document.body.querySelector('.panel')).toBeTruthy()

    document.body.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }))
    await flush()
    expect(document.body.querySelector('.panel')).toBeNull()
  })

  it('an anchor slot can stand in for the trigger', async () => {
    const wrapper = track(mount(AnchorHost, { attachTo: document.body }))
    ;(wrapper.vm as any).shown = true
    await nextTick()
    expect(document.body.querySelector('.v2-pop .panel')).toBeTruthy()
  })

  it('opening one panel closes the panel already open', async () => {
    const first = track(mount(AnchorHost, { attachTo: document.body }))
    ;(first.vm as any).shown = true
    await flush()
    const second = track(mount(AnchorHost, { attachTo: document.body }))
    ;(second.vm as any).shown = true
    await flush()
    expect(document.body.querySelectorAll('.v2-pop').length).toBe(1)
    expect((first.vm as any).shown).toBe(false)
  })
})
