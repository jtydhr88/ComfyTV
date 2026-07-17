import type { ResolvedInput } from '@/stores/stageStore'
import { slotColor } from '@/composables/stages/imageSlotMentions'

export interface VideoClip {
  key: string
  url: string
  color: string
}

const SLOT_RE = /^videos\.video(\d+)$/

export function videoClipsFromInputs(inputs: ResolvedInput[]): VideoClip[] {
  return inputs
    .filter(i => SLOT_RE.test(i.slot) && i.source === 'upstream' && i.content)
    .map(i => {
      const key = i.slot.split('.').pop()!
      const slot = Number(SLOT_RE.exec(i.slot)![1])
      return { key, url: i.content!, color: slotColor(slot) }
    })
}
