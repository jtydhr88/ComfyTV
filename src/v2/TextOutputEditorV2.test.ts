import { mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick, reactive } from 'vue'

const saveText = vi.fn()
vi.mock('@/composables/stages/useTextOutputEdit', () => ({
  useTextOutputEdit: () => ({ saveText: (...a: unknown[]) => saveText(...a) }),
}))

import TextOutputEditorV2 from './TextOutputEditorV2.vue'

function open() {
  const state = reactive({ output: 'generated', running: false, textEditing: true }) as any
  const wrapper = mount(TextOutputEditorV2, { props: { state }, attachTo: document.body })
  return { state, wrapper, area: wrapper.find('textarea') }
}

describe('TextOutputEditorV2', () => {
  beforeEach(() => {
    saveText.mockReset()
    document.body.innerHTML = ''
  })

  it('starts focused on the current text', () => {
    const { wrapper, area } = open()
    expect((area.element as HTMLTextAreaElement).value).toBe('generated')
    expect(document.activeElement).toBe(area.element)
    wrapper.unmount()
  })

  it('saves when a press outside is stopped before reaching the document, like the canvas does', async () => {
    const { state, wrapper, area } = open()
    await area.setValue('changed')
    const canvas = document.body.appendChild(document.createElement('canvas'))
    canvas.addEventListener('pointerdown', e => { e.stopPropagation(); e.preventDefault() })
    canvas.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, cancelable: true }))
    expect(saveText).toHaveBeenCalledWith('changed')
    expect(state.textEditing).toBe(false)
    wrapper.unmount()
  })

  it('keeps editing when the press is inside', async () => {
    const { state, wrapper, area } = open()
    area.element.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }))
    await nextTick()
    expect(saveText).not.toHaveBeenCalled()
    expect(state.textEditing).toBe(true)
    wrapper.unmount()
  })

  it('saves once on Ctrl+Enter, even though blur follows', async () => {
    const { state, wrapper, area } = open()
    await area.setValue('changed')
    await area.trigger('keydown', { key: 'Enter', ctrlKey: true })
    await area.trigger('blur')
    expect(saveText).toHaveBeenCalledTimes(1)
    expect(state.textEditing).toBe(false)
    wrapper.unmount()
  })

  it('discards on Escape, even though blur follows', async () => {
    const { state, wrapper, area } = open()
    await area.setValue('changed')
    await area.trigger('keydown', { key: 'Escape' })
    await area.trigger('blur')
    expect(saveText).not.toHaveBeenCalled()
    expect(state.textEditing).toBe(false)
    wrapper.unmount()
  })

  it('stops editing without saving when a run starts', async () => {
    const { state, wrapper, area } = open()
    await area.setValue('changed')
    state.running = true
    await nextTick()
    expect(saveText).not.toHaveBeenCalled()
    expect(state.textEditing).toBe(false)
    wrapper.unmount()
  })
})
