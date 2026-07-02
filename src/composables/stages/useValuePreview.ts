import { computed } from 'vue'

import type { BatchImage, StoryboardShot, TimelineSeg } from '@/types/payloads'

export function parsePayloadList<T>(
  type: string,
  content: string | null | undefined,
  wantType: string,
  key: string,
): T[] {
  if (type !== wantType || !content) return []
  try {
    const parsed = JSON.parse(String(content))
    const list = (parsed as Record<string, unknown>)?.[key]
    return Array.isArray(list) ? (list as T[]) : []
  } catch {
    return []
  }
}

export function sumShotDurations(shots: StoryboardShot[]): number {
  let total = 0
  for (const s of shots) {
    if (s.duration == null) continue
    const n = parseFloat(String(s.duration).replace(/s$/i, ''))
    if (Number.isFinite(n)) total += n
  }
  return Math.round(total)
}

export function shotSummary(s: StoryboardShot): string {
  return String(s.scene_purpose || s.prompt || s.image_prompt || '')
    .trim()
    .replace(/\s+/g, ' ')
    .slice(0, 60)
}

const SHORT_TYPE: Record<string, string> = {
  COMFYTV_TEXT:       'TEXT',
  COMFYTV_IMAGE:      'IMG',
  COMFYTV_VIDEO:      'VID',
  COMFYTV_AUDIO:      'AUDIO',
  COMFYTV_PANORAMA:   '360°',
  COMFYTV_STORYBOARD: 'BOARD',
  COMFYTV_IMAGES:     'BATCH',
  COMFYTV_TIMELINE:   'TIMELINE',
}

export function shortTypeLabel(type: string): string {
  return SHORT_TYPE[type] ?? type
}

export function batchItemIndex(img: BatchImage, i: number): string | number {
  return img.index ?? String(i + 1)
}

export function isBatchItemSelected(
  img: BatchImage,
  i: number,
  selectedIndex: string | number | null | undefined,
): boolean {
  if (selectedIndex == null) return false
  return Number(batchItemIndex(img, i)) === Number(selectedIndex)
}

export function useValuePreview(
  getType: () => string,
  getContent: () => string | null | undefined,
) {
  const hasContent = computed(() => {
    const c = getContent()
    return c != null && String(c).length > 0
  })

  const shortType = computed(() => shortTypeLabel(getType()))

  const batchImages = computed<BatchImage[]>(() => {
    const t = getType()
    if (t !== 'COMFYTV_IMAGES' && t !== 'COMFYTV_AUDIOS') return []
    return parsePayloadList(t, getContent(), t, 'images')
  })

  const storyboardShots = computed<StoryboardShot[]>(() =>
    parsePayloadList(getType(), getContent(), 'COMFYTV_STORYBOARD', 'shots'))

  const timelineSegs = computed<TimelineSeg[]>(() =>
    parsePayloadList(getType(), getContent(), 'COMFYTV_TIMELINE', 'segments'))

  const storyboardTotalSec = computed(() => sumShotDurations(storyboardShots.value))

  return {
    hasContent,
    shortType,
    batchImages,
    storyboardShots,
    timelineSegs,
    storyboardTotalSec,
  }
}
