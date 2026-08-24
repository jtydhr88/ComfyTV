import { useEventListener } from '@vueuse/core'
import { effectScope, type EffectScope } from 'vue'

export const CTV_MEDIA_ATTR = 'data-ctv-media'

const SELECTOR = `video[${CTV_MEDIA_ATTR}]`

function groupOf(v: HTMLVideoElement): Element {
  return v.closest('[data-node-id]') ?? v
}

let scope: EffectScope | null = null

export function installPlaybackArbiter(root: Document = document): () => void {
  if (scope) return uninstallPlaybackArbiter
  scope = effectScope(true)
  scope.run(() => {
    useEventListener(root, 'play', (e: Event) => {
      const target = e.target
      if (!(target instanceof HTMLVideoElement)) return
      if (!target.matches(SELECTOR)) return
      if (target.paused) return
      const group = groupOf(target)
      for (const v of root.querySelectorAll<HTMLVideoElement>(SELECTOR)) {
        if (v === target || v.paused) continue
        if (groupOf(v) === group) continue
        v.pause()
      }
    }, { capture: true, passive: true })
  })
  return uninstallPlaybackArbiter
}

export function uninstallPlaybackArbiter(): void {
  scope?.stop()
  scope = null
}
