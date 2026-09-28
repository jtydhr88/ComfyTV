import { mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import { createI18n } from 'vue-i18n'

import InlinePromptEditor from '../../native/components/agent/composer/InlinePromptEditor.vue'

const cleanups: (() => void)[] = []

afterEach(() => {
  for (const cleanup of cleanups.splice(0).reverse()) cleanup()
})

function mountEditor(text = '') {
  const wrapper = mount(InlinePromptEditor, {
    attachTo: document.body,
    props: {
      label: 'Message',
      modelValue: { text, references: [] }
    },
    global: {
      plugins: [createI18n({ legacy: false, locale: 'en', messages: { en: {} } })]
    }
  })
  cleanups.push(() => wrapper.unmount())
  const editor = wrapper.get('[role="textbox"]').element as HTMLElement
  editor.focus()
  return { wrapper, editor }
}

function observeCanvasClipboard(type: 'copy' | 'cut' | 'paste') {
  const handler = vi.fn()
  document.addEventListener(type, handler)
  cleanups.push(() => document.removeEventListener(type, handler))
  return handler
}

function dispatchClipboard(editor: HTMLElement, type: 'copy' | 'cut' | 'paste', text = '') {
  const clipboardData = new DataTransfer()
  clipboardData.setData('text/plain', text)
  const event = new ClipboardEvent(type, {
    bubbles: true,
    cancelable: true,
    clipboardData
  })
  editor.dispatchEvent(event)
  return { event, clipboardData }
}

describe('agent editor clipboard isolation', () => {
  it('pastes multiline text once without triggering the canvas clipboard handler', async () => {
    const onCanvasPaste = observeCanvasClipboard('paste')
    const { wrapper, editor } = mountEditor()
    const text = '粘贴到聊天输入框\nsecond line'

    dispatchClipboard(editor, 'paste', text)
    await nextTick()

    expect(wrapper.emitted('update:modelValue')?.at(-1)).toEqual([
      { text, references: [] }
    ])
    expect(editor.textContent).toBe(text)
    expect(onCanvasPaste).not.toHaveBeenCalled()
  })

  it.each(['copy', 'cut'] as const)('keeps %s inside the editor and preserves its clipboard behavior', async (type) => {
    const onCanvasClipboard = observeCanvasClipboard(type)
    const text = '聊天里的文字'
    const { wrapper, editor } = mountEditor(text)
    const isMac = /Mac|iP(hone|[oa]d)/.test(navigator.platform)
    editor.dispatchEvent(new KeyboardEvent('keydown', {
      key: 'a',
      code: 'KeyA',
      keyCode: 65,
      ctrlKey: !isMac,
      metaKey: isMac,
      bubbles: true,
      cancelable: true
    }))

    const { clipboardData } = dispatchClipboard(editor, type)
    await nextTick()

    expect(clipboardData.getData('text/plain')).toBe(text)
    expect(onCanvasClipboard).not.toHaveBeenCalled()
    expect(editor.textContent).toBe(type === 'cut' ? '' : text)
    if (type === 'cut') {
      expect(wrapper.emitted('update:modelValue')?.at(-1)).toEqual([
        { text: '', references: [] }
      ])
    }
  })
})
