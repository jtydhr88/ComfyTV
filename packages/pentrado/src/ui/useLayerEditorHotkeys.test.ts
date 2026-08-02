import { describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'

import type { LayerEditorController } from './useLayerEditorStage'
import { isTextEditingTarget, useLayerEditorHotkeys } from './useLayerEditorHotkeys'

function makeEditor() {
  return {
    activeId: ref<string | null>('layer-1'),
    floating: ref<unknown>(null),
    tool: ref<string>('select'),
    undo: vi.fn(),
    redo: vi.fn(),
    removeLayer: vi.fn(),
    nudgeActive: vi.fn(),
    anchorFloating: vi.fn(),
    cancelFloating: vi.fn(),
    startTransform: vi.fn(),
    transformApply: vi.fn(),
    transformCancel: vi.fn(),
    hasSelection: vi.fn(() => false),
    clearSelectionPixels: vi.fn(),
    cutSelection: vi.fn(),
    copySelection: vi.fn(),
    pasteClipboard: vi.fn(),
    swapColors: vi.fn(),
    resetColors: vi.fn(),
  }
}

function setup() {
  const editor = makeEditor()
  const opts = {
    setSpaceDown: vi.fn(),
    isFullscreen: vi.fn(() => false),
    exitFullscreen: vi.fn(),
  }
  const api = useLayerEditorHotkeys(editor as unknown as LayerEditorController, opts)
  return { editor, opts, api }
}

function key(over: Partial<{
  key: string
  code: string
  ctrlKey: boolean
  metaKey: boolean
  shiftKey: boolean
  target: unknown
}> = {}) {
  return {
    key: '',
    code: '',
    ctrlKey: false,
    metaKey: false,
    shiftKey: false,
    target: { tagName: 'DIV' },
    stopPropagation: vi.fn(),
    preventDefault: vi.fn(),
    ...over,
  } as unknown as KeyboardEvent
}

describe('isTextEditingTarget', () => {
  it('detects inputs, textareas, and contenteditable elements', () => {
    expect(isTextEditingTarget({ tagName: 'INPUT' } as never)).toBe(true)
    expect(isTextEditingTarget({ tagName: 'TEXTAREA' } as never)).toBe(true)
    expect(isTextEditingTarget({ tagName: 'DIV', isContentEditable: true } as never)).toBe(true)
    expect(isTextEditingTarget({ tagName: 'DIV' } as never)).toBe(false)
    expect(isTextEditingTarget(null)).toBe(false)
  })
})

describe('useLayerEditorHotkeys', () => {
  it('always stops propagation', () => {
    const { api } = setup()
    const e = key()
    api.onKeyDown(e)
    expect(e.stopPropagation).toHaveBeenCalled()
    const up = key()
    api.onKeyUp(up)
    expect(up.stopPropagation).toHaveBeenCalled()
  })

  it('escape exits fullscreen and short-circuits', () => {
    const { api, opts, editor } = setup()
    opts.isFullscreen.mockReturnValue(true)
    api.onKeyDown(key({ key: 'Escape' }))
    expect(opts.exitFullscreen).toHaveBeenCalled()
    expect(editor.undo).not.toHaveBeenCalled()
  })

  it('escape does nothing outside fullscreen', () => {
    const { api, opts } = setup()
    api.onKeyDown(key({ key: 'Escape' }))
    expect(opts.exitFullscreen).not.toHaveBeenCalled()
  })

  it('ignores shortcuts while typing in a text field', () => {
    const { api, editor } = setup()
    api.onKeyDown(key({ code: 'KeyZ', ctrlKey: true, target: { tagName: 'INPUT' } }))
    expect(editor.undo).not.toHaveBeenCalled()
  })

  it('space toggles pan mode down and up', () => {
    const { api, opts } = setup()
    const down = key({ code: 'Space' })
    api.onKeyDown(down)
    expect(opts.setSpaceDown).toHaveBeenCalledWith(true)
    expect(down.preventDefault).toHaveBeenCalled()
    api.onKeyUp(key({ code: 'Space' }))
    expect(opts.setSpaceDown).toHaveBeenCalledWith(false)
  })

  it('ctrl+z undoes, ctrl+shift+z and ctrl+y redo', () => {
    const { api, editor } = setup()
    api.onKeyDown(key({ code: 'KeyZ', ctrlKey: true }))
    expect(editor.undo).toHaveBeenCalledTimes(1)
    api.onKeyDown(key({ code: 'KeyZ', metaKey: true, shiftKey: true }))
    expect(editor.redo).toHaveBeenCalledTimes(1)
    api.onKeyDown(key({ code: 'KeyY', ctrlKey: true }))
    expect(editor.redo).toHaveBeenCalledTimes(2)
  })

  it('delete removes the active layer only when one is selected', () => {
    const { api, editor } = setup()
    api.onKeyDown(key({ key: 'Delete' }))
    expect(editor.removeLayer).toHaveBeenCalledWith('layer-1')
    editor.removeLayer.mockClear()
    editor.activeId.value = null
    api.onKeyDown(key({ key: 'Backspace' }))
    expect(editor.removeLayer).not.toHaveBeenCalled()
  })

  it('arrow keys nudge by 1, shift+arrow by 10', () => {
    const { api, editor } = setup()
    api.onKeyDown(key({ key: 'ArrowLeft' }))
    expect(editor.nudgeActive).toHaveBeenCalledWith(-1, 0)
    api.onKeyDown(key({ key: 'ArrowRight', shiftKey: true }))
    expect(editor.nudgeActive).toHaveBeenCalledWith(10, 0)
    api.onKeyDown(key({ key: 'ArrowUp' }))
    expect(editor.nudgeActive).toHaveBeenCalledWith(0, -1)
    api.onKeyDown(key({ key: 'ArrowDown', shiftKey: true }))
    expect(editor.nudgeActive).toHaveBeenCalledWith(0, 10)
  })

  it('ctrl+t starts a transform session', () => {
    const { api, editor } = setup()
    api.onKeyDown(key({ code: 'KeyT', ctrlKey: true }))
    expect(editor.startTransform).toHaveBeenCalled()
  })

  it('enter applies and escape cancels an active transform session', () => {
    const { api, editor } = setup()
    editor.tool.value = 'transform'
    api.onKeyDown(key({ key: 'Enter' }))
    expect(editor.transformApply).toHaveBeenCalled()
    expect(editor.tool.value).toBe('select')

    editor.tool.value = 'transform'
    api.onKeyDown(key({ key: 'Escape' }))
    expect(editor.transformCancel).toHaveBeenCalled()
    expect(editor.tool.value).toBe('select')
  })

  it('x swaps colors and d resets them (no ctrl)', () => {
    const { api, editor } = setup()
    api.onKeyDown(key({ code: 'KeyX' }))
    expect(editor.swapColors).toHaveBeenCalled()
    expect(editor.cutSelection).not.toHaveBeenCalled()
    api.onKeyDown(key({ code: 'KeyD' }))
    expect(editor.resetColors).toHaveBeenCalled()
    api.onKeyDown(key({ code: 'KeyX', ctrlKey: true }))
    expect(editor.cutSelection).toHaveBeenCalled()
    expect(editor.swapColors).toHaveBeenCalledTimes(1)
  })

  it('leaves unrelated keys alone', () => {
    const { api, editor, opts } = setup()
    const e = key({ key: 'a', code: 'KeyA' })
    api.onKeyDown(e)
    expect(e.preventDefault).not.toHaveBeenCalled()
    expect(editor.undo).not.toHaveBeenCalled()
    expect(editor.nudgeActive).not.toHaveBeenCalled()
    expect(opts.setSpaceDown).not.toHaveBeenCalled()
  })
})
