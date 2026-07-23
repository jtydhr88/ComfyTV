import { isTextEditingTarget } from '@/composables/widgets/useLayerEditorHotkeys'
import type { StoryboardEditorController } from '@/composables/widgets/useStoryboardEditor'

/**
 * Board-level hotkeys layered in front of the layer-editor ones
 * (Storyboarder-style, remapped where they'd collide with canvas keys):
 * , / .  prev / next board · N new · D duplicate · P play/stop
 * O / Shift+O onion prev/next · C captions · / new-shot
 * Shift+H / Shift+V flip board
 */
export function useStoryboardHotkeys(
  sb: StoryboardEditorController,
  next: { onKeyDown: (e: KeyboardEvent) => void; onKeyUp: (e: KeyboardEvent) => void },
) {
  function navigate(dir: -1 | 1): void {
    const target = sb.boards.value[sb.currentIndex.value + dir]
    if (target) sb.selectBoard(target.uid)
  }

  function onKeyDown(e: KeyboardEvent): void {
    if (!isTextEditingTarget(e.target) && !e.ctrlKey && !e.metaKey && !e.altKey) {
      const uid = sb.currentBoard.value.uid
      switch (e.code) {
        case 'Comma':
          e.preventDefault(); e.stopPropagation(); navigate(-1); return
        case 'Period':
          e.preventDefault(); e.stopPropagation(); navigate(1); return
        case 'KeyN':
          e.preventDefault(); e.stopPropagation(); sb.addBoard(); return
        case 'KeyD':
          e.preventDefault(); e.stopPropagation(); sb.duplicateBoard(uid); return
        case 'KeyP':
          e.preventDefault(); e.stopPropagation()
          if (sb.playing.value) sb.stopPlayback()
          else sb.play()
          return
        case 'KeyO':
          e.preventDefault(); e.stopPropagation()
          if (e.shiftKey) sb.onionNext.value = !sb.onionNext.value
          else sb.onionPrev.value = !sb.onionPrev.value
          return
        case 'KeyC':
          e.preventDefault(); e.stopPropagation(); sb.captions.value = !sb.captions.value; return
        case 'Slash':
          e.preventDefault(); e.stopPropagation(); sb.toggleNewShot(uid); return
        case 'KeyH':
          if (e.shiftKey) { e.preventDefault(); e.stopPropagation(); sb.flipBoard('h'); return }
          break
        case 'KeyV':
          if (e.shiftKey) { e.preventDefault(); e.stopPropagation(); sb.flipBoard('v'); return }
          break
      }
      if (sb.playing.value && e.code === 'Escape') {
        e.preventDefault(); e.stopPropagation(); sb.stopPlayback(); return
      }
    }
    next.onKeyDown(e)
  }

  function onKeyUp(e: KeyboardEvent): void {
    next.onKeyUp(e)
  }

  return { onKeyDown, onKeyUp }
}
