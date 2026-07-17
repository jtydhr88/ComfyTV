import type { LayerEditorController } from '@/composables/widgets/useLayerEditorStage'

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
    if ((e.key === 'Delete' || e.key === 'Backspace') && editor.activeId.value) {
      e.preventDefault()
      editor.removeLayer(editor.activeId.value)
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
