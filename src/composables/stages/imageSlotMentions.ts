import { AUTOGROW_IMAGE_KEY_RE, wiredImageSlots } from '@/composables/stages/assetSlots'
import { readImageRefs } from '@/composables/stages/imageRefs'

export const IMAGE_SLOT_LABEL_RE = /^image_(\d+)$/

export const IMAGE_SLOT_TOKEN_RE = /@image_(\d+)(?![\p{L}\p{N}_-])/gu

export function imageSlotLabel(slot: number): string {
  return `image_${slot}`
}

export function imageSlotFromLabel(label: string): number | null {
  const m = IMAGE_SLOT_LABEL_RE.exec(label)
  return m ? Number(m[1]) : null
}

export function imageInputSlotIndex(inputName: string): number | null {
  const m = AUTOGROW_IMAGE_KEY_RE.exec(inputName)
  return m ? Number(m[1]) : null
}

export const SLOT_COLORS = [
  '#60A5FA',
  '#FB923C',
  '#4ADE80',
  '#F472B6',
  '#A78BFA',
  '#22D3EE',
  '#FACC15',
  '#F87171',
] as const

export function slotColor(slot: number): string {
  return SLOT_COLORS[((slot % SLOT_COLORS.length) + SLOT_COLORS.length) % SLOT_COLORS.length]
}

export function imageSendOrder(node: unknown): number[] {
  const slots = new Set<number>(wiredImageSlots(node))
  for (const r of readImageRefs(node)) slots.add(r.slot)
  return [...slots].sort((a, b) => a - b)
}

export interface ExpandedImageTokens {
  text: string
  missing: number[]
}

export function expandImageTokens(
  text: string,
  order: number[],
  ordinalText: (ordinal: number) => string,
): ExpandedImageTokens {
  const missing: number[] = []
  const out = text.replace(IMAGE_SLOT_TOKEN_RE, (_m, slotStr: string) => {
    const slot = Number(slotStr)
    const pos = order.indexOf(slot)
    if (pos < 0) {
      missing.push(slot)
      return ''
    }
    return ordinalText(pos + 1)
  })
  return { text: out, missing }
}
