import { AUTOGROW_IMAGE_KEY_RE, wiredImageSlots } from '@/composables/stages/assetSlots'
import { readImageRefs, refType } from '@/composables/stages/imageRefs'

export type MentionSlotType = 'image' | 'video' | 'audio'

export const IMAGE_SLOT_LABEL_RE = /^image_(\d+)$/

export const IMAGE_SLOT_TOKEN_RE = /@image_(\d+)(?![0-9a-zA-Z_-])/gu

const SLOT_TOKEN_RES: Record<MentionSlotType, RegExp> = {
  image: IMAGE_SLOT_TOKEN_RE,
  video: /@video_(\d+)(?![0-9a-zA-Z_-])/gu,
  audio: /@audio_(\d+)(?![0-9a-zA-Z_-])/gu,
}

const SLOT_LABEL_RE = /^(image|video|audio)_(\d+)$/

export function imageSlotLabel(slot: number): string {
  return `image_${slot}`
}

export function mentionSlotLabel(type: MentionSlotType, slot: number): string {
  return `${type}_${slot}`
}

export function imageSlotFromLabel(label: string): number | null {
  const m = IMAGE_SLOT_LABEL_RE.exec(label)
  return m ? Number(m[1]) : null
}

export function mentionSlotFromLabel(
  label: string,
): { type: MentionSlotType; slot: number } | null {
  const m = SLOT_LABEL_RE.exec(label)
  return m ? { type: m[1] as MentionSlotType, slot: Number(m[2]) } : null
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
  for (const r of readImageRefs(node)) {
    if (refType(r) === 'image') slots.add(r.slot)
  }
  return [...slots].sort((a, b) => a - b)
}

const AUTOGROW_VIDEO_KEY_RE = /^videos\.video(\d+)$/

export function videoSendOrder(node: unknown): number[] {
  const slots = new Set<number>()
  const inputs = (node as { inputs?: Array<{ name?: unknown; link?: unknown }> } | null)?.inputs
  if (Array.isArray(inputs)) {
    for (const i of inputs) {
      if (typeof i?.name !== 'string') continue
      const m = AUTOGROW_VIDEO_KEY_RE.exec(i.name)
      if (m && i.link != null) slots.add(Number(m[1]))
    }
  }
  for (const r of readImageRefs(node)) {
    if (refType(r) === 'video') slots.add(r.slot)
  }
  return [...slots].sort((a, b) => a - b)
}

const AUTOGROW_AUDIO_KEY_RE = /^audio\.audio(\d+)$/

export function audioSendOrder(node: unknown): number[] {
  const slots = new Set<number>()
  const inputs = (node as { inputs?: Array<{ name?: unknown; link?: unknown }> } | null)?.inputs
  if (Array.isArray(inputs)) {
    for (const i of inputs) {
      if (typeof i?.name !== 'string' || i.link == null) continue
      if (i.name === 'audio') { slots.add(0); continue }
      const m = AUTOGROW_AUDIO_KEY_RE.exec(i.name)
      if (m) slots.add(Number(m[1]))
    }
  }
  for (const r of readImageRefs(node)) {
    if (refType(r) === 'audio') slots.add(r.slot)
  }
  return [...slots].sort((a, b) => a - b)
}

export function mentionSendOrders(node: unknown): MentionOrders {
  return {
    image: imageSendOrder(node),
    video: videoSendOrder(node),
    audio: audioSendOrder(node),
  }
}

export function mentionSendOrderOf(node: unknown, type: MentionSlotType): number[] {
  if (type === 'image') return imageSendOrder(node)
  if (type === 'video') return videoSendOrder(node)
  return audioSendOrder(node)
}

export type MentionStyle = 'natural' | 'minimax_tags'

export function normalizeMentionStyle(value: unknown): MentionStyle {
  return value === 'minimax_tags' ? 'minimax_tags' : 'natural'
}

const MINIMAX_TAGS: Record<MentionSlotType, string> = {
  image: 'Picture',
  video: 'Video',
  audio: 'Audio',
}

export function mentionOrdinalText(
  style: MentionStyle,
  localeText: (ordinal: number) => string,
  type: MentionSlotType = 'image',
  ordinalOffset = 0,
): (ordinal: number) => string {
  if (style === 'minimax_tags') return n => `<${MINIMAX_TAGS[type]} ${n + ordinalOffset}>`
  return n => localeText(n + ordinalOffset)
}

export function minimaxAudioOffset(orders: MentionOrders): number {
  return orders.video.length
}

const RAW_SLOT_TOKEN_RE = /[@＠](图片|视频|音频|image|video|audio)[\s#＃_]*([0-9０-９]+)(?![0-9０-９a-zA-Z_-])/giu

const RAW_TYPE_MAP: Record<string, MentionSlotType> = {
  '图片': 'image', 'image': 'image',
  '视频': 'video', 'video': 'video',
  '音频': 'audio', 'audio': 'audio',
}

function toAsciiDigits(s: string): string {
  return s.replace(/[０-９]/g, d => String(d.charCodeAt(0) - 0xff10))
}

export function normalizeMentionText(text: string): string {
  return text.replace(RAW_SLOT_TOKEN_RE, (_m, word: string, digits: string) => {
    const type = RAW_TYPE_MAP[word.toLowerCase()]
    return `@${type}_${Number(toAsciiDigits(digits))}`
  })
}

export function hasRawMentionTokens(text: string): boolean {
  return normalizeMentionText(text) !== text
}

export const MENTION_TOKEN_RE =
  /@(?:(image|video|audio)_(\d+)(?![0-9a-zA-Z_-])|([\p{L}_][\p{L}\p{N}_-]*))/gu

export function mentionTokenLabel(m: RegExpMatchArray): string {
  return m[1] ? `${m[1]}_${m[2]}` : m[3]!
}

export function nonSlotMentionLabels(text: string): string[] {
  const out = new Set<string>()
  for (const m of text.matchAll(MENTION_TOKEN_RE)) {
    if (!m[1]) out.add(m[3]!)
  }
  return [...out]
}

export interface MentionOrders {
  image: number[]
  video: number[]
  audio: number[]
}

export interface ExpandedImageTokens {
  text: string
  missing: number[]
}

export interface ExpandedMentionTokens {
  text: string
  missing: Array<{ type: MentionSlotType; slot: number }>
}

export function expandMentionTokens(
  text: string,
  orders: MentionOrders,
  ordinalTexts: Record<MentionSlotType, (ordinal: number) => string>,
): ExpandedMentionTokens {
  const missing: Array<{ type: MentionSlotType; slot: number }> = []
  let out = text
  for (const type of Object.keys(SLOT_TOKEN_RES) as MentionSlotType[]) {
    out = out.replace(SLOT_TOKEN_RES[type], (_m, slotStr: string) => {
      const slot = Number(slotStr)
      const pos = orders[type].indexOf(slot)
      if (pos < 0) {
        missing.push({ type, slot })
        return ''
      }
      return ordinalTexts[type](pos + 1)
    })
  }
  return { text: out, missing }
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
