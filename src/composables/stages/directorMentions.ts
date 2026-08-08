import {
  expandMentionTokens,
  MENTION_TOKEN_RE,
  mentionOrdinalText,
  type MentionOrders,
  type MentionSlotType,
  type MentionStyle,
} from '@/composables/stages/imageSlotMentions'
import type { MentionSource } from '@/composables/stages/useMentionSuggestion'
import {
  parseTimeline,
  type ChainMode,
  type DirectorClip,
} from '@/composables/stages/useDirectorTimeline'

export interface SharedRefs {
  images: string[]
  videos: string[]
  audio: string[]
}

export const EMPTY_SHARED: SharedRefs = { images: [], videos: [], audio: [] }

function positions(n: number): number[] {
  return Array.from({ length: n }, (_, i) => i)
}

export function mergedMentionOrders(clip: DirectorClip, shared: SharedRefs): MentionOrders {
  return {
    image: positions(shared.images.length + clip.images.length),
    video: positions(shared.videos.length + clip.videos.length),
    audio: positions(shared.audio.length + clip.audio.length),
  }
}

export function clipMentionSource(
  getClip: () => DirectorClip | null,
  getShared: () => SharedRefs = () => EMPTY_SHARED,
): MentionSource {
  return {
    orders() {
      const clip = getClip()
      if (!clip) return { image: [], video: [], audio: [] }
      return mergedMentionOrders(clip, getShared())
    },
    previewUrl(type, slot) {
      const clip = getClip()
      if (!clip || type !== 'image') return null
      const shared = getShared().images
      return slot < shared.length
        ? shared[slot] ?? null
        : clip.images[slot - shared.length] ?? null
    },
  }
}

export interface ExpandTimelineOpts {
  defaultWorkflow: string
  shared?: SharedRefs
  expandEntries: (text: string) => string
  styleFor: (workflowLabel: string) => Promise<MentionStyle>
  naturalText: (type: 'image' | 'video' | 'audio', n: number) => string
  onMissing?: (clipId: string, type: string, slot: number) => void
}

export function citedSlots(text: string, type: MentionSlotType): number[] {
  const out = new Set<number>()
  for (const m of text.matchAll(MENTION_TOKEN_RE)) {
    if (m[1] === type) out.add(Number(m[2]))
  }
  return [...out].sort((a, b) => a - b)
}

const TYPES: MentionSlotType[] = ['image', 'video', 'audio']
const CLIP_KEY = { image: 'images', video: 'videos', audio: 'audio' } as const

export async function expandDirectorTimeline(
  raw: string,
  opts: ExpandTimelineOpts,
): Promise<string> {
  const parsed = parseTimeline(raw)
  if (parsed.clips.length === 0) return raw
  const shared = opts.shared ?? EMPTY_SHARED

  const enabled = parsed.clips.filter(c => c.enabled)
  for (const clip of parsed.clips) {
    if (!clip.enabled) continue
    const index = enabled.indexOf(clip)
    const pool = {
      image: [...shared.images, ...clip.images],
      video: [...shared.videos, ...clip.videos],
      audio: [...shared.audio, ...clip.audio],
    }
    const text0 = opts.expandEntries(clip.prompt)
    const cited = {
      image: citedSlots(text0, 'image'),
      video: citedSlots(text0, 'video'),
      audio: citedSlots(text0, 'audio'),
    }
    const manual = TYPES.some(t => cited[t].length > 0)

    const chain = parsed.settings.chain
    const chained = index > 0 && chain !== 'off'
    const chainOffset = chained ? 1 : 0

    const orders: MentionOrders = { image: [], video: [], audio: [] }
    for (const t of TYPES) {
      orders[t] = manual
        ? cited[t].filter(slot => slot < pool[t].length)
        : positions(pool[t].length)
      clip[CLIP_KEY[t]] = orders[t].map(slot => pool[t][slot])
    }
    if (chained && chain === 'replace') {
      orders.image = []
      clip.images = []
    }

    if (text0.includes('@')) {
      const label = clip.workflow || opts.defaultWorkflow
      const style = await opts.styleFor(label)
      const videosSent = clip.videos.length
      const imageText = mentionOrdinalText(
        style, n => opts.naturalText('image', n), 'image', chainOffset)
      const videoText = mentionOrdinalText(
        style, n => opts.naturalText('video', n), 'video')
      const audioText = mentionOrdinalText(
        style, n => opts.naturalText('audio', n), 'audio',
        style === 'minimax_tags' ? videosSent : 0)
      const { text, missing } = expandMentionTokens(
        text0, orders, { image: imageText, video: videoText, audio: audioText })
      for (const m of missing) opts.onMissing?.(clip.id, m.type, m.slot)
      clip.prompt = text
    } else {
      clip.prompt = text0
    }
  }
  return JSON.stringify({ version: 1, settings: parsed.settings, clips: parsed.clips })
}
