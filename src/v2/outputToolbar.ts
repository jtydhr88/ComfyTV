import type { ComfyNode } from '@/lib/comfyApp'
import { attachImageToolbar, isImageOutputKind } from '@/v2/imageToolbar'
import { createIslandGroup } from '@/v2/islands'
import { el } from '@/v2/shellCommon'
import MediaToolbarV2, { type MediaToolbarFlavor } from '@/v2/MediaToolbarV2.vue'
import type { StageKind, StageState } from '@/stores/stageStore'

export type { MediaToolbarFlavor }
export type VideoToolbarFlavor = 'video' | 'vfx'

export function isVideoOutputKind(kind: StageKind): boolean {
  return kind === 'video' || kind === 'video-picker'
}

export function isAudioOutputKind(kind: StageKind): boolean {
  return kind === 'audio' || kind === 'audio-picker'
}

export function hasOutputToolbar(kind: StageKind): boolean {
  return isImageOutputKind(kind) || isVideoOutputKind(kind) || isAudioOutputKind(kind)
}

export function attachOutputToolbar(
  node: ComfyNode,
  card: HTMLElement,
  kind: StageKind,
  state: StageState,
  onAction: (actionId: string, context?: any) => void,
  opts: { video?: VideoToolbarFlavor } = {},
) {
  if (isImageOutputKind(kind)) return attachImageToolbar(card, kind, state, onAction)
  const flavor: MediaToolbarFlavor | null = isVideoOutputKind(kind)
    ? (opts.video ?? 'video')
    : isAudioOutputKind(kind) ? 'audio' : null
  if (!flavor) return null

  const bar = el('div', 'v2-toolbar')
  card.appendChild(bar)
  const islands = createIslandGroup()
  islands.mount(bar, MediaToolbarV2, { state, flavor, onAction })

  const anyNode = node as any
  const prevRemoved = anyNode.onRemoved
  anyNode.onRemoved = function (...args: unknown[]) {
    islands.unmountAll()
    prevRemoved?.apply(this, args)
  }
  return bar
}
