import { computed } from 'vue'

import type { BatchImage, ItemClickPayload, StoryboardShot, TimelineSeg } from '@/types/payloads'
import type { MaterialParams } from '@/widgets/material/types'

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
  COMFYTV_AUDIOS:     'AUDIO',
  COMFYTV_VIDEOS:     'VID',
  COMFYTV_TIMELINE:   'TIMELINE',
  COMFYTV_MODEL:      '3D',
  COMFYTV_MATERIAL:   'MAT',
  COMFYTV_FXSPEC:     'FX',
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

const PREVIEW_MEDIA_TYPES: Record<string, string> = {
  COMFYTV_AUDIO:  'audio',
  COMFYTV_AUDIOS: 'audio',
  COMFYTV_VIDEO:  'video',
  COMFYTV_VIDEOS: 'video',
  COMFYTV_MODEL:  'model',
}

export function previewMediaTypeOf(type: string): string {
  return PREVIEW_MEDIA_TYPES[type] ?? 'image'
}

export function batchItemTag(img: BatchImage, i: number): string {
  return img.label ?? `#${img.index ?? i + 1}`
}

export function batchItemPayload(img: BatchImage, i: number): ItemClickPayload {
  return {
    index: img.index ?? String(i + 1),
    label: img.label,
    prompt: img.prompt,
    imageUrl: img.image_url,
  }
}

export function isActivationKey(key: string): boolean {
  return key === 'Enter' || key === ' ' || key === 'Spacebar'
}

export function isUpstreamBatchItem(img: BatchImage, upstreamUrls?: string[]): boolean {
  return (upstreamUrls ?? []).includes(img.image_url)
}

export function canRemoveBatchItem(
  img: BatchImage,
  i: number,
  opts: {
    removable?: boolean
    selectedIndex?: string | number | null
    upstreamUrls?: string[]
  },
): boolean {
  return !!opts.removable
    && !isBatchItemSelected(img, i, opts.selectedIndex)
    && !isUpstreamBatchItem(img, opts.upstreamUrls)
}

export function batchLightboxItems(
  images: BatchImage[],
  fallbackName: (url: string) => string,
): { url: string; label: string }[] {
  return images.map((b) => ({
    url: b.image_url,
    label: b.label || b.prompt || fallbackName(b.image_url),
  }))
}

export function materialSwatchStyleOf(
  p: Pick<MaterialParams, 'color' | 'transmission' | 'opacity'>,
): Record<string, string> {
  const alpha = p.transmission > 0 ? 0.55 : p.opacity
  return {
    background: `radial-gradient(circle at 35% 30%, rgb(255 255 255 / 0.85), ${p.color} 45%, color-mix(in srgb, ${p.color} 45%, black) 100%)`,
    opacity: String(Math.max(0.35, alpha)),
    boxShadow: 'inset 0 -4px 8px rgb(0 0 0 / 0.35)',
  }
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
    if (t !== 'COMFYTV_IMAGES' && t !== 'COMFYTV_AUDIOS' && t !== 'COMFYTV_VIDEOS') return []
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
