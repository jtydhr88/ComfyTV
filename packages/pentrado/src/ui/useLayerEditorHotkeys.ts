import type { LayerEditorController } from './useLayerEditorStage'

export function isTextEditingTarget(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null
  const tag = el?.tagName
  return tag === 'INPUT' || tag === 'TEXTAREA' || Boolean(el?.isContentEditable)
}

export interface LayerEditorHotkeyOptions {
  setSpaceDown: (v: boolean) => void
  isFullscreen: () => boolean
  exitFullscreen: () => void
}

export function useLayerEditorHotkeys(
  editor: LayerEditorController,
  opts: LayerEditorHotkeyOptions,
) {
  function onKeyDown(e: KeyboardEvent): void {
    e.stopPropagation()
    if (editor.floating.value && !isTextEditingTarget(e.target)) {
      if (e.key === 'Enter') {
        e.preventDefault()
        editor.anchorFloating()
        return
      }
      if (e.key === 'Escape' || e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault()
        editor.cancelFloating()
        return
      }
    }
    if (editor.tool.value === 'pen' && !isTextEditingTarget(e.target)) {
      if (e.key === 'Enter' && editor.penDrafting()) {
        e.preventDefault()
        editor.penCommit()
        return
      }
      if (e.key === 'Escape' && editor.penCancel()) {
        e.preventDefault()
        return
      }
    }
    if (editor.tool.value === 'transform' && !isTextEditingTarget(e.target)) {
      if (e.key === 'Enter') {
        e.preventDefault()
        editor.transformApply()
        editor.tool.value = 'select'
        return
      }
      if (e.key === 'Escape') {
        e.preventDefault()
        editor.transformCancel()
        editor.tool.value = 'select'
        return
      }
    }
    if (e.key === 'Escape' && opts.isFullscreen()) {
      opts.exitFullscreen()
      return
    }
    if (isTextEditingTarget(e.target)) return

    if (e.code === 'Space') {
      opts.setSpaceDown(true)
      e.preventDefault()
      return
    }
    const ctrl = e.ctrlKey || e.metaKey
    if (ctrl && e.code === 'KeyT') {
      e.preventDefault()
      editor.startTransform()
      return
    }
    if (ctrl && e.code === 'KeyA') {
      e.preventDefault()
      editor.selectAll()
      return
    }
    if (ctrl && e.code === 'KeyD') {
      e.preventDefault()
      editor.selectNone()
      return
    }
    if (ctrl && e.shiftKey && e.code === 'KeyI') {
      e.preventDefault()
      editor.invertSelection()
      return
    }
    if (ctrl && e.code === 'KeyZ') {
      e.preventDefault()
      if (e.shiftKey) editor.redo()
      else editor.undo()
      return
    }
    if (ctrl && e.code === 'KeyY') {
      e.preventDefault()
      editor.redo()
      return
    }
    if (ctrl && e.code === 'KeyX') {
      e.preventDefault()
      editor.cutSelection()
      return
    }
    if (ctrl && e.code === 'KeyC') {
      e.preventDefault()
      editor.copySelection()
      return
    }
    if (ctrl && e.code === 'KeyV') {
      e.preventDefault()
      editor.pasteClipboard()
      return
    }
    if (!ctrl && e.code === 'KeyX') {
      e.preventDefault()
      editor.swapColors()
      return
    }
    if (!ctrl && e.code === 'KeyD') {
      e.preventDefault()
      editor.resetColors()
      return
    }
    if ((e.key === 'Delete' || e.key === 'Backspace') && editor.activeId.value) {
      e.preventDefault()
      if (editor.hasSelection()) editor.clearSelectionPixels()
      else editor.removeLayer(editor.activeId.value)
      return
    }
    const nudge = e.shiftKey ? 10 : 1
    if (e.key === 'ArrowLeft') { e.preventDefault(); editor.nudgeActive(-nudge, 0) }
    else if (e.key === 'ArrowRight') { e.preventDefault(); editor.nudgeActive(nudge, 0) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); editor.nudgeActive(0, -nudge) }
    else if (e.key === 'ArrowDown') { e.preventDefault(); editor.nudgeActive(0, nudge) }
  }

  function onKeyUp(e: KeyboardEvent): void {
    e.stopPropagation()
    if (e.code === 'Space') opts.setSpaceDown(false)
  }

  return { onKeyDown, onKeyUp }
}
