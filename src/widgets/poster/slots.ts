import { AUTOGROW_IMAGE_KEY_RE } from '@/composables/stages/assetSlots'

export interface SlotEl { slot?: number; bind?: string }
export interface SlotOverride { slot?: number }
export interface NodeInput { name?: string; link?: number | null }

export function defaultSlot(el: SlotEl): number {
  if (Number.isInteger(el.slot)) return el.slot as number
  const m = /image:(\d+)/.exec(el.bind || '')
  return m ? parseInt(m[1]!, 10) : 0
}

export function curSlot(el: SlotEl, override?: SlotOverride | null): number {
  const o = override || {}
  return Number.isInteger(o.slot) ? (o.slot as number) : defaultSlot(el)
}

export function connectedImageCount(inputs: NodeInput[]): number {
  let maxIdx = -1
  for (const inp of inputs || []) {
    const m = AUTOGROW_IMAGE_KEY_RE.exec(inp.name || '')
    if (m && inp.link != null) maxIdx = Math.max(maxIdx, parseInt(m[1]!, 10))
  }
  return maxIdx + 1
}
